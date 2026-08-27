import { SupabaseClient } from '@supabase/supabase-js'
import { OrdemServico, PagamentoOS, StatusOrdem, SituacaoPagamentoOrdem, DestinoFinanceiro, Lancamento } from '@/types'
import { executarOperacao, ResultadoOperacao } from '@/lib/api-helpers'
import { formatarMoeda } from '@/lib/utils'

export interface LancamentoOrdemResultado {
  fiados_criados: string[]
  lancamentos_criados: string[]
}

export interface PagamentoOrdemResultado {
  fiados_criados: string[]
  lancamentos_criados: string[]
  cheques_criados: string[]
}

/**
 * Lança uma O.S. no Financeiro chamando a function atômica do banco
 * (`lancar_ordem_servico_financeiro_atomico`). Toda a operação — um insert
 * por forma de pagamento (fiado e/ou lançamento) — roda dentro de UMA
 * transação no Postgres: ou tudo é gravado, ou nada é. A function também
 * garante, no próprio banco, que a soma das partes bate com o total da O.S.
 * e que a mesma O.S. nunca é lançada duas vezes.
 *
 * SEMPRE cheque `resultado.ok` antes de considerar a operação concluída.
 */
export async function lancarOrdemNoFinanceiro(
  supabase: SupabaseClient,
  ordem: Pick<OrdemServico, 'id' | 'total' | 'forma_pagamento'> & { pagamentos?: PagamentoOS[] | null }
): Promise<ResultadoOperacao<LancamentoOrdemResultado>> {
  if (!ordem.total || ordem.total <= 0) {
    return { ok: true, data: { fiados_criados: [], lancamentos_criados: [] }, erro: null }
  }

  const partes: PagamentoOS[] = ordem.pagamentos?.length
    ? ordem.pagamentos
    : [{ forma: ordem.forma_pagamento ?? 'Dinheiro', valor: ordem.total }]

  return executarOperacao(() =>
    supabase
      .rpc('lancar_ordem_servico_financeiro_atomico', {
        p_ordem_servico_id: ordem.id,
        p_pagamentos_json: partes,
      })
      .single()
  )
}

/**
 * Registra o pagamento de uma O.S. já concluída, quando o cliente vem buscar
 * e paga (podendo ser em forma diferente da combinada, e/ou dividido entre
 * várias formas). Chama a function atômica do banco
 * (`registrar_pagamento_ordem_servico_atomico`), que cria fiado (parte não
 * paga), lançamento (parte em dinheiro/pix/cartão/transferência) e/ou cheque
 * (parte em cheque) conforme as partes informadas — tudo em uma transação.
 *
 * Independente do status da O.S. (concluída, aguardando, etc.) — pagamento e
 * status da O.S. são coisas separadas agora. A function do banco só permite
 * UM registro de pagamento por O.S. (bloqueia se já houver lançamento, fiado
 * ou cheque ligado a ela) — por isso as partes têm que somar o total inteiro
 * de uma vez (pode ser dividido entre várias formas nessa mesma chamada).
 */
export async function registrarPagamentoOrdem(
  supabase: SupabaseClient,
  ordemServicoId: string,
  pagamentos: PagamentoOS[],
  usuarioId?: string | null,
  data?: string
): Promise<ResultadoOperacao<PagamentoOrdemResultado>> {
  return executarOperacao(() =>
    supabase
      .rpc('registrar_pagamento_ordem_servico_atomico', {
        p_ordem_servico_id: ordemServicoId,
        p_pagamentos_json: pagamentos,
        p_usuario_id: usuarioId ?? null,
        ...(data ? { p_data: data } : {}),
      })
      .single()
  )
}

/**
 * Mantém os lançamentos financeiros ligados à O.S. em sincronia — mas agora
 * só reage ao CANCELAMENTO da O.S. (cancela os lançamentos ligados a ela).
 * Antes essa function também forçava status='pago' quando a O.S. virava
 * "concluída", o que era o bug: concluir o serviço não é a mesma coisa que o
 * cliente ter pago. Pagamento agora só é registrado explicitamente via
 * `registrarPagamentoOrdem`, nunca automaticamente pelo status da O.S.
 */
export async function sincronizarLancamentoOrdem(
  supabase: SupabaseClient,
  ordemId: string,
  statusOrdem: StatusOrdem
): Promise<ResultadoOperacao<null>> {
  if (statusOrdem !== 'cancelada') {
    return { ok: true, data: null, erro: null }
  }

  return executarOperacao(() =>
    supabase.from('lancamentos').update({ status: 'cancelado' }).eq('ordem_servico_id', ordemId).is('deleted_at', null)
  )
}

/** Monta um resumo textual da forma de pagamento a partir das partes (ex.: "Dinheiro + Pix"). */
export function resumoFormaPagamento(partes: PagamentoOS[]): string {
  return partes.filter(p => p.valor > 0).map(p => p.forma).join(' + ') || 'Dinheiro'
}

/**
 * Corrige o saldo acumulado de uma conta (Caixa/Dinheiro ou Banco) quando ele
 * não bate com o valor real conferido pelo usuário (ex.: extrato do banco,
 * dinheiro contado na gaveta). Em vez de editar os lançamentos passados —
 * o que quebraria o histórico —, cria UM lançamento de ajuste com a diferença
 * (entrada se o real for maior, saída se for menor), já com a comparação
 * "sistema x real" registada nas observações do próprio lançamento.
 *
 * A `destino` é sempre derivada por trigger no banco a partir da
 * `forma_pagamento` (Dinheiro → caixa; qualquer outra → banco) — por isso
 * escolhemos 'Dinheiro' pra ajuste de caixa e 'Transferência' pra ajuste de
 * banco, garantindo que caia na conta certa.
 *
 * Se a diferença for zero (arredondada a centavos), não cria nada.
 */
export async function ajustarSaldoConta(
  supabase: SupabaseClient,
  conta: DestinoFinanceiro,
  saldoAtual: number,
  saldoReal: number,
  observacaoExtra?: string,
  usuarioId?: string | null
): Promise<ResultadoOperacao<Lancamento | null>> {
  const diferenca = Math.round((saldoReal - saldoAtual) * 100) / 100

  if (diferenca === 0) {
    return { ok: true, data: null, erro: null }
  }

  const nomeConta = conta === 'caixa' ? 'Caixa (Dinheiro)' : 'Banco'
  const observacoes = [
    `Ajuste de saldo — ${nomeConta}: sistema mostrava ${formatarMoeda(saldoAtual)}, ` +
      `saldo real informado ${formatarMoeda(saldoReal)} — diferença de ${formatarMoeda(Math.abs(diferenca))} ` +
      `${diferenca > 0 ? 'a mais' : 'a menos'} no sistema.`,
    observacaoExtra?.trim() || null,
  ].filter(Boolean).join('\n')

  const payload = {
    tipo: diferenca > 0 ? 'entrada' : 'saida',
    descricao: `Ajuste de saldo — ${nomeConta}`,
    categoria: 'Ajuste de saldo',
    valor: Math.abs(diferenca),
    forma_pagamento: conta === 'caixa' ? 'Dinheiro' : 'Transferência',
    data: new Date().toISOString().slice(0, 10),
    status: 'pago',
    observacoes,
    created_by: usuarioId ?? null,
  }

  return executarOperacao(() => supabase.from('lancamentos').insert(payload).select().single())
}

/**
 * Calcula a situação de pagamento de cada O.S. a partir dos lançamentos,
 * fiados e cheques ligados a elas (nunca a partir do status da O.S.).
 * Prioridade quando há mais de uma coisa ligada à mesma O.S.:
 * fiado em aberto > cheque aguardando > pago > aguardando (nada registado).
 */
export function calcularSituacoesPagamento(
  fiadosPendentesPorOrdem: Set<string>,
  lancamentos: { ordem_servico_id: string | null }[],
  cheques: { ordem_servico_id: string | null; status: string }[]
): Map<string, SituacaoPagamentoOrdem> {
  const mapa = new Map<string, SituacaoPagamentoOrdem>()

  const chequesAguardandoPorOrdem = new Set(
    cheques.filter(c => c.ordem_servico_id && c.status === 'aguardando').map(c => c.ordem_servico_id as string)
  )
  const ordensComLancamento = new Set(lancamentos.filter(l => l.ordem_servico_id).map(l => l.ordem_servico_id as string))
  const ordensComCheque = new Set(cheques.filter(c => c.ordem_servico_id).map(c => c.ordem_servico_id as string))

  const todasOrdens = new Set([...fiadosPendentesPorOrdem, ...ordensComLancamento, ...ordensComCheque])
  todasOrdens.forEach(id => {
    if (fiadosPendentesPorOrdem.has(id)) { mapa.set(id, 'fiado_pendente'); return }
    if (chequesAguardandoPorOrdem.has(id)) { mapa.set(id, 'cheque_aguardando'); return }
    mapa.set(id, 'pago')
  })

  return mapa
}
