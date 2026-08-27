import { SupabaseClient } from '@supabase/supabase-js'
import { executarOperacao } from '@/lib/api-helpers'

export interface DadosPix {
  chave: string | null
  titular: string | null
  dadosBancarios: string | null
}

export interface DadosEmpresa {
  nome: string | null
  cnpj: string | null
  endereco: string | null
  telefone: string | null
}

/**
 * Busca os dados de PIX/bancários da oficina — usados no extrato do cliente
 * e nas faturas/documentos impressos.
 *
 * Usa a RPC `get_dados_pagamento_publicos()` (SECURITY DEFINER) em vez de
 * `select * from configuracoes`: a tabela `configuracoes` guarda também
 * segredos (chave da Groq etc.) e por isso é restrita a `proprietario` via
 * RLS — um funcionário emitindo uma fatura não conseguiria ler nada dali
 * direto. A RPC libera só os 3 campos de pagamento pra qualquer usuário
 * autenticado, sem abrir a tabela inteira.
 */
export async function carregarDadosPix(supabase: SupabaseClient): Promise<DadosPix> {
  const resultado = await executarOperacao(() => supabase.rpc('get_dados_pagamento_publicos').single())
  if (!resultado.ok) return { chave: null, titular: null, dadosBancarios: null }
  const linha = resultado.data as { pix_chave: string | null; pix_titular: string | null; dados_bancarios: string | null }
  return { chave: linha.pix_chave, titular: linha.pix_titular, dadosBancarios: linha.dados_bancarios }
}

/**
 * Busca o perfil público da empresa (nome, CNPJ, endereço, telefone) —
 * usado no cabeçalho de faturas/orçamentos/O.S. impressos. Mesma lógica da
 * função acima: RPC pública em vez de ler `configuracoes` direto, porque
 * essa tabela é proprietario-only.
 */
export async function carregarDadosEmpresa(supabase: SupabaseClient): Promise<DadosEmpresa> {
  const resultado = await executarOperacao(() => supabase.rpc('get_dados_empresa_publicos').single())
  if (!resultado.ok) return { nome: 'Surubim Tornearia', cnpj: null, endereco: null, telefone: null }
  const linha = resultado.data as { nome: string | null; cnpj: string | null; endereco: string | null; telefone: string | null }
  return { nome: linha.nome ?? 'Surubim Tornearia', cnpj: linha.cnpj, endereco: linha.endereco, telefone: linha.telefone }
}
