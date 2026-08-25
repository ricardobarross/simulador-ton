import { SupabaseClient } from '@supabase/supabase-js'
import { executarOperacao } from '@/lib/api-helpers'

export interface DadosPix {
  chave: string | null
  titular: string | null
  dadosBancarios: string | null
}

/** Busca os dados de PIX/bancários da oficina cadastrados em Configurações — usados
 * no extrato do cliente e nas faturas consolidadas. */
export async function carregarDadosPix(supabase: SupabaseClient): Promise<DadosPix> {
  const resultado = await executarOperacao(() =>
    supabase.from('configuracoes').select('*').in('chave', ['pix_chave', 'pix_titular', 'dados_bancarios'])
  )
  const configs = resultado.ok ? resultado.data : []
  const valor = (chave: string) => configs.find(c => c.chave === chave)?.valor ?? null
  return { chave: valor('pix_chave'), titular: valor('pix_titular'), dadosBancarios: valor('dados_bancarios') }
}
