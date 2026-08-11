import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  erro?: string
  prefixo?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, erro, prefixo, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-gray-700">{label}</label>
        )}
        <div className="relative flex items-center">
          {prefixo && (
            <span className="absolute left-3 text-sm text-gray-500">{prefixo}</span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900',
              'placeholder:text-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:bg-gray-50 disabled:text-gray-500',
              erro && 'border-red-500 focus:ring-red-500',
              prefixo && 'pl-8',
              className
            )}
            {...props}
          />
        </div>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'