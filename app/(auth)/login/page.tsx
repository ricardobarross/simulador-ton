'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<'login' | 'criar'>('login')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleLogin() {
    setErro('')
    setCarregando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) {
        setErro('Email ou senha incorretos.')
        return
      }
      router.push('/')
    } catch {
      setErro('Erro inesperado. Tenta novamente.')
    } finally {
      setCarregando(false)
    }
  }

  async function handleCriarConta() {
    setErro('')
    setAviso('')
    if (!nome.trim()) {
      setErro('Informe o seu nome.')
      return
    }
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome } },
      })
      if (error) {
        setErro(error.message)
        return
      }
      if (!data.session) {
        setAviso('Conta criada. Verifica o teu email para confirmar o acesso antes de entrar.')
        setModo('login')
        return
      }
      router.push('/')
    } catch {
      setErro('Erro inesperado. Tenta novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const acao = modo === 'login' ? handleLogin : handleCriarConta

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-trimmed.jpg" alt="Surubim Tornearia" className="w-48 mb-3" />
          <h1 className="sr-only">Surubim Tornearia</h1>
          <p className="text-sm text-gray-500">Sistema de Gestão</p>
        </div>

        {/* Formulário */}
        <div className="space-y-4">
          {modo === 'criar' && (
            <Input
              label="Nome"
              placeholder="O teu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="utilizador@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && acao()}
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && acao()}
          />

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
          )}
          {aviso && (
            <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">{aviso}</p>
          )}

          <Button
            variante="primario"
            tamanho="lg"
            className="w-full"
            carregando={carregando}
            onClick={acao}
          >
            {modo === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>

          <p className="text-center text-sm text-gray-500">
            {modo === 'login' ? (
              <>Novo por aqui?{' '}
                <button className="text-blue-600 font-medium" onClick={() => { setModo('criar'); setErro(''); setAviso('') }}>
                  Criar conta
                </button>
              </>
            ) : (
              <>Já tem conta?{' '}
                <button className="text-blue-600 font-medium" onClick={() => { setModo('login'); setErro(''); setAviso('') }}>
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}