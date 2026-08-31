import { SupabaseClient } from '@supabase/supabase-js'
import { Lancamento } from '@/types'
import { executarOperacao, ResultadoOperacao } from '@/lib/api-helpers'

export interface DadosPagamentoConta {
  tipo: 'fixa' | 'variavel'
  contaId: string
  valor: number
  formaPagamento: string
  data: string
  observacoes: string | null
}

/**
 * Marca uma conta (fixa ou variável) como paga de verdade — chama a function
 * atômica pagar_conta, que cria o lançamento já vinculado à conta (pro DRE e
 * o resumo de pendências baterem certo) e, se for conta variável, atualiza o
 * status pra 'pago'. Bloqueia pagar a mesma conta fixa duas vezes no mesmo
 * mês, ou uma variável que já não está mais pendente.
 */
export async function pagarConta(
  supabase: SupabaseClient,
  dados: DadosPagamentoConta
): Promise<ResultadoOperacao<Lancamento>> {
  return executarOperacao(() =>
    supabase
      .rpc('pagar_conta', {
        p_tipo: dados.tipo,
        p_conta_id: dados.contaId,
        p_valor: dados.valor,
        p_forma_pagamento: dados.formaPagamento,
        p_data: dados.data,
        p_observacoes: dados.observacoes,
      })
      .single()
  )
}
