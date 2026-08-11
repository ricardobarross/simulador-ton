import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com a chave "service role" — só pode ser usado em código
 * que roda no servidor (Route Handlers). NUNCA importe este ficheiro num
 * componente 'use client', senão a chave vaza para o browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada. Adiciona a chave "service_role" (Project Settings → API, no painel do Supabase) ao ficheiro .env.local.'
    )
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Valida o token de acesso enviado pelo browser (Authorization: Bearer ...)
 * e devolve o utilizador + o respectivo perfil (papel). Usa a chave anon
 * porque só estamos a validar um token já emitido, não a fazer bypass de RLS.
 */
export async function autenticarPedido(authHeader: string | null) {
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null

  const admin = createAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null

  const { data: perfil } = await admin.from('perfis').select('*').eq('id', user.id).single()
  if (!perfil || !perfil.ativo) return null

  return { user, perfil }
}
