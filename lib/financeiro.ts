import { SupabaseClient } from '@supabase/supabase-js'
import { OrdemServico, PagamentoOS, StatusOrdem } from '@/types'

/**
 * Lança automaticamente uma O.S. recém-criada no Financeiro.
 * Suporta pagamento dividido em várias formas (ex.: parte dinheiro, parte Pix,
 * resto fiado) via `ordem.pagamentos`. Se não vier `pagamentos`, cai para o
 * comportamento antigo de uma única forma (`ordem.forma_pagamento`).
 *
 * - Cada parte com forma "Fiado" vira um registo em `fiados` (ligado à O.S.),
 *   para ser acompanhada com pagamentos parciais e NÃO entrar no caixa do dia até ser recebida.
 * - Cada parte com outra forma vira um lançamento de entrada "pendente", ligado
 *   por ordem_servico_id, que vira "pago" quando a O.S. é concluída (ver sincronizarLancamentoOrdem).
 */
export async function lancarOrdemNoFinanceiro(
  supabase: SupabaseClient,
  ordem: Pick<OrdemServico, 'id' | 'numero' | 'total' | 'forma_pagamento'> & {
    pagamentos?: PagamentoOS[] | null
    cliente_id?: string | null
    cliente_nome?: string | null
  }
) {
  if (!ordem.total || ordem.total <= 0) return

  const partes: PagamentoOS[] = ordem.pagamentos?.length
    ? ordem.pagamentos
    : [{ forma: ordem.forma_pagamento ?? 'Dinheiro', valor: ordem.total }]

  const dividido = partes.length > 1
  const hoje = new Date().toISOString().slice(0, 10)

  for (const parte of partes) {
    if (!parte.valor || parte.valor <= 0) continue
    const descricao = `${ordem.numero}${ordem.cliente_nome ? ` — ${ordem.cliente_nome}` : ''}${dividido ? ` (${parte.forma})` : ''}`

    if (parte.forma === 'Fiado') {
      if (!ordem.cliente_id) continue
      await supabase.from('fiados').insert({
        cliente_id: ordem.cliente_id,
        ordem_servico_id: ordem.id,
        descricao,
        valor_total: parte.valor,
        data: hoje,
      })
      continue
    }

    await supabase.from('lancamentos').insert({
      tipo: 'entrada',
      categoria: 'Ordem de Serviço',
      descricao,
      valor: parte.valor,
      forma_pagamento: parte.forma,
      data: hoje,
      status: 'pendente',
      ordem_servico_id: ordem.id,
    })
  }
}

/**
 * Mantém os lançamentos financeiros ligados à O.S. em sincronia com o status dela:
 * concluída -> pago, cancelada -> cancelado, qualquer outro -> pendente.
 * Não faz nada se a O.S. não tiver lançamento associado (ex.: criadas antes desta função existir,
 * ou pagas inteiramente em fiado).
 */
export async function sincronizarLancamentoOrdem(
  supabase: SupabaseClient,
  ordemId: string,
  statusOrdem: StatusOrdem
) {
  const novoStatus =
    statusOrdem === 'concluida' ? 'pago' :
    statusOrdem === 'cancelada' ? 'cancelado' :
    'pendente'

  await supabase.from('lancamentos').update({ status: novoStatus }).eq('ordem_servico_id', ordemId)
}

/** Monta um resumo textual da forma de pagamento a partir das partes (ex.: "Dinheiro + Pix"). */
export function resumoFormaPagamento(partes: PagamentoOS[]): string {
  return partes.filter(p => p.valor > 0).map(p => p.forma).join(' + ') || 'Dinheiro'
}
