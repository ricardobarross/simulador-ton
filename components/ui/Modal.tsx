'use client'

import { cn } from '@/lib/utils'
import { useEffect } from 'react'

interface ModalProps {
  aberto: boolean
  onFechar: () => void
  titulo: string
  children: React.ReactNode
  largura?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ aberto, onFechar, titulo, children, largura = 'md' }: ModalProps) {
  useEffect(() => {
    if (aberto) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [aberto])

  if (!aberto) return null

  const larguras = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onFechar}
      />
      <div className={cn('relative bg-white rounded-xl shadow-xl w-full flex flex-col max-h-[90vh]', larguras[largura])}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
          <button
            onClick={onFechar}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}