'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SearchableOption {
  value: string
  label: string
  grupo?: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  placeholder?: string
  className?: string
  /** Se true, o campo volta a mostrar o placeholder após cada escolha (útil para "adicionar item a partir de uma lista"). */
  limparAposEscolher?: boolean
}

export function SearchableSelect({
  value, onChange, options, placeholder = 'Selecionar...', className, limparAposEscolher = false,
}: SearchableSelectProps) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false)
        setBusca('')
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  const selecionado = options.find(o => o.value === value)
  const filtradas = busca.trim()
    ? options.filter(o => o.label.toLowerCase().includes(busca.trim().toLowerCase()))
    : options

  const grupos = Array.from(new Set(filtradas.map(o => o.grupo ?? '')))

  function escolher(v: string) {
    onChange(v)
    setAberto(false)
    setBusca('')
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={cn('truncate', selecionado && !limparAposEscolher ? 'text-gray-900' : 'text-gray-400')}>
          {selecionado && !limparAposEscolher ? selecionado.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-64 flex flex-col">
          <input
            autoFocus
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Digite para pesquisar..."
            className="w-full px-3 py-2 text-sm border-b border-gray-100 focus:outline-none flex-shrink-0"
          />
          <div className="overflow-y-auto">
            {filtradas.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhum resultado</p>
            ) : (
              grupos.map(grupo => (
                <div key={grupo || '_sem_grupo_'}>
                  {grupo && (
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase">{grupo}</p>
                  )}
                  {filtradas.filter(o => (o.grupo ?? '') === grupo).map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => escolher(o.value)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-blue-50',
                        o.value === value && !limparAposEscolher && 'bg-blue-50 text-blue-700 font-medium'
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
