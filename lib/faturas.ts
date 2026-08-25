import { SupabaseClient } from '@supabase/supabase-js'
import { Fatura } from '@/types'
import { executarOperacao, ResultadoOperacao } from '@/lib/api-helpers'

export interface FaturaCriada {
  fatura_id: string
  numero_fatura: string
  valor_total: number
}

/** Gera uma fatura consolidada a partir de vários fiados do mesmo cliente, numa
 * única transação atômica no banco (criar_fatura_consolidada_atomica): valida
 * que todos pertencem ao cliente, não estão quitados nem já numa outra fatura
 * pendente, calcula o total e grava fatura + itens juntos. */
export async function criarFaturaConsolidada(
  supabase: SupabaseClient,
  clienteId: string,
  fiadoIds: string[],
  observacoes: string | null
): Promise<ResultadoOperacao<FaturaCriada>> {
  const resultado = await executarOperacao(() =>
    supabase
      .rpc('criar_fatura_consolidada_atomica', {
        p_cliente_id: clienteId,
        p_fiado_ids: fiadoIds,
        p_observacoes: observacoes,
      })
      .single()
  )
  if (!resultado.ok) return resultado
  const bruto = resultado.data as Record<string, unknown>
  return {
    ok: true,
    data: {
      fatura_id: String(bruto.fatura_id),
      numero_fatura: String(bruto.numero_fatura),
      valor_total: Number(bruto.valor_total),
    },
    erro: null,
  }
}

/** Dá baixa numa fatura: marca como paga, lança a entrada no caixa e quita TODOS
 * os fiados vinculados — tudo na mesma transação (dar_baixa_fatura_atomica). O
 * valor precisa bater com o total da fatura (sem baixa parcial de fatura). */
export async function darBaixaFatura(
  supabase: SupabaseClient,
  faturaId: string,
  formaPagamento: string,
  valor: number
): Promise<ResultadoOperacao<{ lancamento_id: string; novo_status: string }>> {
  const resultado = await executarOperacao(() =>
    supabase
      .rpc('dar_baixa_fatura_atomica', {
        p_fatura_id: faturaId,
        p_forma_pagamento: formaPagamento,
        p_valor: valor,
      })
      .single()
  )
  if (!resultado.ok) return resultado
  const bruto = resultado.data as Record<string, unknown>
  return { ok: true, data: { lancamento_id: String(bruto.lancamento_id), novo_status: String(bruto.novo_status) }, erro: null }
}

/** Cancela uma fatura pendente (não mexe em fiados nem no caixa — eles seguem em aberto). */
export async function cancelarFatura(supabase: SupabaseClient, faturaId: string): Promise<ResultadoOperacao<Fatura>> {
  return executarOperacao(() =>
    supabase.from('faturas').update({ status: 'cancelada' }).eq('id', faturaId).select().single()
  )
}

/** Carrega uma fatura com cliente, itens e os fiados de cada item — pronto pra exibir/imprimir. */
export async function carregarFatura(supabase: SupabaseClient, faturaId: string): Promise<ResultadoOperacao<Fatura>> {
  return executarOperacao(() =>
    supabase
      .from('faturas')
      // ordem_servico(numero, itens) traz o nome real de cada serviço e o
      // número da O.S. — sem isso a fatura só mostrava a descrição genérica do fiado.
      .select('*, cliente:clientes(id, nome, telefone), itens:fatura_itens(*, fiado:fiados(id, descricao, data, ordem_servico_id, ordem_servico:ordens_servico(numero, itens)))')
      .eq('id', faturaId)
      .single()
  )
}
