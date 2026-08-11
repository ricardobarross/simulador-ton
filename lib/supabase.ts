import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

// Reutiliza a mesma instância no browser (evita múltiplos clientes/listeners de auth).
export function createClient() {
  if (!client) {
    client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}