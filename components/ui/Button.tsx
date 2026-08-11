import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'perigo' | 'ghost'
  tamanho?: 'sm' | 'md' | 'lg'
  carregando?: boolean
}

export function Button({
  variante = 'primario',
  tamanho = 'md',
  carregando = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

  const variantes = {
    primario:   'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secundario: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400',
    perigo:     'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost:      'text-gray-600 hover:bg-gray-100 focus:ring-gray-400',
  }

  const tamanhos = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  }

  return (
    <button
      className={cn(base, variantes[variante], tamanhos[tamanho], className)}
      disabled={disabled || carregando}
      {...props}
    >
      {carregando && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  )
}