'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

const todosItens = [
  { label: 'Dashboard',          href: '/'               },
  { label: 'Clientes',           href: '/clientes'       },
  { label: 'Serviços',           href: '/servicos'       },
  { label: 'Orçamentos',         href: '/orcamentos'     },
  { label: 'Ordens de Serviço',  href: '/ordens'         },
  { label: 'Financeiro',         href: '/financeiro'     },
  { label: 'Relatórios',         href: '/relatorios'     },
  { label: 'Fornecedores',       href: '/fornecedores'   },
  { label: 'Transportadoras',    href: '/transportadoras'},
  { label: 'Contas a pagar',     href: '/contas'         },
  { label: 'Simulador TON',      href: '/simulador'      },
  { label: 'Configurações',      href: '/configuracoes'  },
]

interface MobileMenuProps {
  aberto: boolean
  onFechar: () => void
}

export function MobileMenu({ aberto, onFechar }: MobileMenuProps) {
  const pathname = usePathname()

  useEffect(() => {
    if (aberto) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [aberto])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />

      {/* Drawer */}
      <div className="absolute left-0 top-0 bottom-0 w-72 bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.jpg" alt="Surubim Tornearia" className="w-9 h-9 rounded-md bg-white object-contain p-0.5" />
            <div>
              <p className="text-sm font-semibold text-white leading-none">Surubim</p>
              <p className="text-xs text-gray-400 mt-0.5">Tornearia</p>
            </div>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {todosItens.map((item) => {
            const ativo = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onFechar}
                className={cn(
                  'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  ativo
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}