import { SupabaseClient } from '@supabase/supabase-js'
import { Fiado } from '@/types'
import { executarOperacao } from '@/lib/api-helpers'

/** Fiados sem data de vencimento explícita (cadastrados antes dessa coluna existir,
 * ou deixados em branco) são tratados como vencendo 30 dias após a data do fiado. */
const PRAZO_PADRAO_DIAS = 30

function somarDias(data: string, dias: number): Date {
  const d = new Date(`${data}T00:00:00`)
  d.setDate(d.getDate() + dias)
  return d
}

/** Data de vencimento "efetiva" do fiado — a cadastrada, ou o padrão de 30 dias. */
export function vencimentoEfetivo(fiado: Pick<Fiado, 'data' | 'data_vencimento'>): Date {
  if (fiado.data_vencimento) return new Date(`${fiado.data_vencimento}T00:00:00`)
  return somarDias(fiado.data, PRAZO_PADRAO_DIAS)
}

export function estaVencido(fiado: Pick<Fiado, 'data' | 'data_vencimento' | 'status'>): boolean {
  if (fiado.status === 'quitado') return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return vencimentoEfetivo(fiado) < hoje
}

export function diasEmAtraso(fiado: Pick<Fiado, 'data' | 'data_vencimento' | 'status'>): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const venc = vencimentoEfetivo(fiado)
  const diff = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export interface AlertaFiadoCliente {
  quantidadeVencidos: number
  totalVencido: number
}

/** Usado como "trava comercial": ao abrir um novo Orçamento/O.S. pra um cliente,
 * verifica se ele já tem fiado vencido em aberto, pra alertar o atendente antes
 * de fechar mais uma venda a prazo. */
export async function verificarFiadoVencidoCliente(supabase: SupabaseClient, clienteId: string): Promise<AlertaFiadoCliente | null> {
  const resultado = await executarOperacao(() =>
    supabase
      .from('fiados')
      .select('valor_total, data, data_vencimento, status, pagamentos:fiado_pagamentos(valor)')
      .eq('cliente_id', clienteId)
      .neq('status', 'quitado')
      .is('deleted_at', null)
  )
  if (!resultado.ok) return null

  type LinhaFiado = { valor_total: number; data: string; data_vencimento: string | null; status: string; pagamentos: { valor: number }[] }
  const vencidos = (resultado.data as LinhaFiado[]).filter(f => estaVencido(f as Fiado))
  if (vencidos.length === 0) return null

  const totalVencido = vencidos.reduce((soma, f) => {
    const pago = (f.pagamentos ?? []).reduce((s, p) => s + p.valor, 0)
    return soma + Math.max(0, f.valor_total - pago)
  }, 0)

  return { quantidadeVencidos: vencidos.length, totalVencido }
}
