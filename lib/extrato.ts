import { SupabaseClient } from '@supabase/supabase-js'
import { Cliente, OrdemServico, Fiado } from '@/types'
import { executarOperacao } from '@/lib/api-helpers'
import { carregarDadosPix } from '@/lib/configuracoes'

export interface DadosExtratoCliente {
  cliente: Cliente
  ordensAbertas: OrdemServico[]
  fiados: Fiado[]
  saldoDevedorTotal: number
  pix: { chave: string | null; titular: string | null; dadosBancarios: string | null }
}

export type ResultadoExtrato =
  | { ok: true; data: DadosExtratoCliente }
  | { ok: false; erro: string }

/** Junta tudo que compõe o "fechamento de conta" de um cliente: O.S. em aberto,
 * fiados com histórico de pagamentos, saldo devedor total e dados de PIX da
 * oficina (cadastrados em Configurações) — pronto pra exibir, imprimir ou
 * mandar por WhatsApp. */
export async function carregarExtratoCliente(supabase: SupabaseClient, clienteId: string): Promise<ResultadoExtrato> {
  const [clienteRes, ordensRes, fiadosRes, pix] = await Promise.all([
    executarOperacao(() => supabase.from('clientes').select('*').eq('id', clienteId).is('deleted_at', null).single()),
    executarOperacao(() =>
      supabase
        .from('ordens_servico')
        .select('*')
        .eq('cliente_id', clienteId)
        .in('status', ['aberta', 'em_andamento', 'aguardando'])
        .is('deleted_at', null)
        .order('data_abertura', { ascending: false })
    ),
    executarOperacao(() =>
      supabase
        .from('fiados')
        // ordem_servico(numero, itens) traz o nome real de cada serviço e o
        // número da O.S. — sem isso o extrato só mostrava a descrição genérica
        // ("OS-0048 — Cliente X") que não diz pro cliente o que foi cada cobrança.
        .select('*, pagamentos:fiado_pagamentos(*), ordem_servico:ordens_servico(numero, itens)')
        .eq('cliente_id', clienteId)
        .is('deleted_at', null)
        .order('data', { ascending: false })
    ),
    carregarDadosPix(supabase),
  ])

  if (!clienteRes.ok) return { ok: false, erro: `Não foi possível carregar o cliente: ${clienteRes.erro}` }
  if (!ordensRes.ok) return { ok: false, erro: `Não foi possível carregar as O.S. em aberto: ${ordensRes.erro}` }
  if (!fiadosRes.ok) return { ok: false, erro: `Não foi possível carregar os fiados: ${fiadosRes.erro}` }

  const fiados = (fiadosRes.data ?? []) as Fiado[]
  const saldoDevedorTotal = fiados.reduce((soma, f) => {
    const pago = (f.pagamentos ?? []).reduce((s, p) => s + p.valor, 0)
    return soma + Math.max(0, f.valor_total - pago)
  }, 0)

  return {
    ok: true,
    data: {
      cliente: clienteRes.data as Cliente,
      ordensAbertas: (ordensRes.data ?? []) as OrdemServico[],
      fiados,
      saldoDevedorTotal,
      pix,
    },
  }
}
