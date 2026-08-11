'use client'

import { useState } from 'react'
import { MobileMenu } from './MobileMenu'
import { useAuth } from '@/lib/auth-context'

interface NavbarProps {
  titulo: string
}

export function Navbar({ titulo }: NavbarProps) {
  const [menuAberto, setMenuAberto] = useState(false)
  const { perfil, sair } = useAuth()
  const [menuUsuarioAberto, setMenuUsuarioAberto] = useState(false)

  const iniciais = perfil?.nome
    ? perfil.nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
    : '...'

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
        {/* Botão menu mobile */}
        <button
          onClick={() => setMenuAberto(true)}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Título da página */}
        <h1 className="text-base font-semibold text-gray-900 lg:text-lg">{titulo}</h1>

        {/* Ações direita */}
        <div className="flex items-center gap-2">
          {/* Notificações */}
          <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          {/* Avatar + menu de usuário */}
          <div className="relative">
            <button
              onClick={() => setMenuUsuarioAberto(v => !v)}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                {iniciais}
              </div>
            </button>

            {menuUsuarioAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuUsuarioAberto(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{perfil?.nome ?? '...'}</p>
                    <p className="text-xs text-gray-400 capitalize">{perfil?.papel ?? ''}</p>
                  </div>
                  <button
                    onClick={sair}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <MobileMenu aberto={menuAberto} onFechar={() => setMenuAberto(false)} />
    </>
  )
}