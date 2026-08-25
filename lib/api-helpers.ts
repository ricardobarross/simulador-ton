import { PostgrestError } from '@supabase/supabase-js'

/**
 * Resultado padronizado de qualquer chamada ao Supabase (select/insert/update/rpc).
 * É um union discriminado por `ok`: depois de `if (!resultado.ok) return`, o
 * TypeScript já sabe que `resultado.data` não é nulo — não tem como esquecer
 * de tratar o erro e acessar `data` mesmo assim.
 */
export type ResultadoOperacao<T> =
  | { ok: true; data: T; erro: null }
  | { ok: false; data: null; erro: string }

// Códigos de erro do Postgres/PostgREST mais comuns, traduzidos para algo que
// faz sentido pra quem está usando o sistema no dia a dia da oficina.
const MENSAGENS_AMIGAVEIS: Record<string, string> = {
  '23505': 'Já existe um registro igual a esse (duplicado).',
  '23503': 'Essa ação depende de outro registro que não existe ou já foi removido.',
  '23502': 'Falta preencher um campo obrigatório.',
  '42501': 'Você não tem permissão para fazer essa ação.',
  '28000': 'Sessão expirada — faça login novamente.',
}

function extrairMensagemErro(error: unknown): string {
  if (!error) return 'Erro desconhecido.'
  const err = error as Partial<PostgrestError> & { message?: string }
  if (err.code && MENSAGENS_AMIGAVEIS[err.code]) return MENSAGENS_AMIGAVEIS[err.code]
  // Exceções levantadas pelas nossas funções do banco (RAISE EXCEPTION ... using errcode='P0001')
  // já vêm com uma mensagem pronta e clara em português — essa é a mais comum no dia a dia.
  if (err.message) return err.message
  return 'Erro desconhecido ao comunicar com o banco de dados.'
}

/**
 * Executa uma operação do Supabase (select/insert/update/delete/rpc) e SEMPRE
 * checa o `error` de volta — nunca deixa uma falha passar em silêncio.
 * Também captura exceções (ex.: falha de rede) que nem chegam a devolver
 * `{ data, error }`, então o chamador só precisa tratar UM formato de resultado.
 *
 * Uso:
 *   const resultado = await executarOperacao(() => supabase.rpc('minha_funcao', {...}))
 *   if (!resultado.ok) { mostrarErro(resultado.erro); return }   // NÃO fecha modal, NÃO segue como sucesso
 *   // ... fluxo de sucesso aqui
 */
/**
 * `.single()`/`.insert().select().single()`/`.rpc().single()` do supabase-js
 * garantem uma linha (ou um `error`) — mas o typing gerado às vezes inclui
 * `| null` no tipo inferido de `data` mesmo assim. `NonNullable<T>` aqui
 * garante que, no sucesso, `resultado.data` nunca aparece como `null` pra
 * quem chama, o que é o comportamento real dessas chamadas.
 */
export async function executarOperacao<T>(
  operacao: () => PromiseLike<{ data: T; error: PostgrestError | null }>
): Promise<ResultadoOperacao<NonNullable<T>>> {
  try {
    const { data, error } = await operacao()
    if (error) {
      return { ok: false, data: null, erro: extrairMensagemErro(error) }
    }
    return { ok: true, data: data as NonNullable<T>, erro: null }
  } catch (excecao) {
    return { ok: false, data: null, erro: extrairMensagemErro(excecao) }
  }
}
