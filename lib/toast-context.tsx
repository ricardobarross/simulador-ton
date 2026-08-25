'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

type TipoToast = 'erro' | 'sucesso' | 'info'

interface ToastItem {
  id: string
  tipo: TipoToast
  mensagem: string
}

interface ToastContextValue {
  mostrarErro: (mensagem: string) => void
  mostrarSucesso: (mensagem: string) => void
  mostrarInfo: (mensagem: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const DURACAO_MS: Record<TipoToast, number> = {
  erro: 8000,       // erros ficam mais tempo na tela — é informação importante, não deve passar despercebida
  sucesso: 3500,
  info: 4500,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remover = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const adicionar = useCallback((tipo: TipoToast, mensagem: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, tipo, mensagem }])
    setTimeout(() => remover(id), DURACAO_MS[tipo])
  }, [remover])

  const value: ToastContextValue = {
    mostrarErro: (mensagem) => adicionar('erro', mensagem),
    mostrarSucesso: (mensagem) => adicionar('sucesso', mensagem),
    mostrarInfo: (mensagem) => adicionar('info', mensagem),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 sm:px-0">
        {toasts.map(t => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'rounded-lg shadow-lg px-4 py-3 text-sm font-medium flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2',
              t.tipo === 'erro' && 'bg-red-600 text-white',
              t.tipo === 'sucesso' && 'bg-green-600 text-white',
              t.tipo === 'info' && 'bg-gray-900 text-white'
            )}
          >
            <span className="flex-1 whitespace-pre-line">{t.mensagem}</span>
            <button onClick={() => remover(t.id)} className="opacity-70 hover:opacity-100 flex-shrink-0 -mt-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}
