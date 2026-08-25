import { SupabaseClient } from '@supabase/supabase-js'
import { StatusCheque } from '@/types'
import { executarOperacao, ResultadoOperacao } from '@/lib/api-helpers'

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
