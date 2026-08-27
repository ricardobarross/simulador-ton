import { SupabaseClient } from '@supabase/supabase-js'
import { Cheque, StatusCheque } from '@/types'
import { executarOperacao, ResultadoOperacao } from '@/lib/api-helpers'

export interface DadosChequeManual {
  numeroCheque: string
  banco: string
  agencia: string
  numeroConta: string
  nomeTitular: string
  telefone: string
  valor: number
  dataRecebimento: string
  clienteId: string | null
  observacoes: string | null
  ordensServicoIds: string[]
}

/**
 * Cadastra um cheque que já foi recebido fisicamente, fora do fluxo normal de
 * pagamento de O.S. (ex.: cheque que cobre uma ou mais O.S. já marcadas como
 * pagas por outro meio). Chama a function atômica cadastrar_cheque_manual, que
 * já grava o cheque como "apenas_registro" — ao compensar, não duplica
 * lançamento no caixa/banco, já que o dinheiro dessas O.S. já foi contado.
 */
export async function cadastrarChequeManual(
  supabase: SupabaseClient,
  dados: DadosChequeManual
): Promise<ResultadoOperacao<Cheque>> {
  return executarOperacao(() =>
    supabase
      .rpc('cadastrar_cheque_manual', {
        p_numero_cheque: dados.numeroCheque,
        p_banco: dados.banco,
        p_agencia: dados.agencia || null,
        p_numero_conta: dados.numeroConta || null,
        p_nome_titular: dados.nomeTitular,
        p_telefone: dados.telefone || null,
        p_valor: dados.valor,
        p_data_recebimento: dados.dataRecebimento,
        p_cliente_id: dados.clienteId,
        p_observacoes: dados.observacoes,
        p_ordens_servico_ids: dados.ordensServicoIds,
      })
      .single()
  )
}

export interface ConfirmarChequeResultado {
  cheque_id: string
  novo_status: StatusCheque
  lancamento_id: string | null
  fiado_id: string | null
}

/**
 * Confirma o desfecho de um cheque depois do depósito, chamando a function
 * atômica do banco (`confirmar_cheque_atomico`):
 *  - "compensado" → cria um lançamento de entrada no Financeiro (dinheiro passa
 *    a existir de verdade).
 *  - "devolvido" → cria um fiado novo pro cliente que passou o cheque (a dívida
 *    volta a existir, já que o cheque não valeu).
 * Tudo numa transação — nunca fica um cheque "meio confirmado".
 */
export async function confirmarCheque(
  supabase: SupabaseClient,
  chequeId: string,
  novoStatus: Exclude<StatusCheque, 'aguardando'>,
  opcoes: { dataDeposito?: string; motivoDevolucao?: string | null; usuarioId?: string | null } = {}
): Promise<ResultadoOperacao<ConfirmarChequeResultado>> {
  return executarOperacao(() =>
    supabase
      .rpc('confirmar_cheque_atomico', {
        p_cheque_id: chequeId,
        p_novo_status: novoStatus,
        ...(opcoes.dataDeposito ? { p_data_deposito: opcoes.dataDeposito } : {}),
        p_motivo_devolucao: opcoes.motivoDevolucao ?? null,
        p_usuario_id: opcoes.usuarioId ?? null,
      })
      .single()
  )
}
