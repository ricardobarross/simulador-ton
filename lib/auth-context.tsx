'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { Perfil } from '@/types'

interface AuthContextValue {
  user: User | null
  perfil: Perfil | null
  carregando: boolean
  ehProprietario: boolean
  sair: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setUser(null)
        setPerfil(null)
        setCarregando(false)
        router.replace('/login')
        return
      }

      setUser(session.user)

      const { data: perfilData } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', session.user.id)
        .single()

      setPerfil(perfilData as Perfil | null)
      setCarregando(false)
    }

    carregar()

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!session) {
        setUser(null)
        setPerfil(null)
        router.replace('/login')
      } else {
        carregar()
      }
    })

    return () => listener.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sair() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        perfil,
        carregando,
        ehProprietario: perfil?.papel === 'proprietario',
        sair,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
