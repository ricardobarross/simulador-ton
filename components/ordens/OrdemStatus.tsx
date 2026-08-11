'use client'

import { StatusOrdem } from '@/types'
import { statusOrdem } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'

interface OrdemStatusProps {
  status: StatusOrdem
  onAlterar?: (novo: StatusOrdem) => void
  somenteLeitura?: boolean
}

const opcoes: StatusOrdem[] = ['aberta', 'em_andamento', 'aguardando', 'concluida', 'cancelada']

export function OrdemStatus({ status, onAlterar, somenteLeitura }: OrdemStatusProps) {
  if (somenteLeitura || !onAlterar) {
    const st = statusOrdem[status]
    return <Badge cor={st.cor as 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red'}>{st.label}</Badge>
  }

  return (
    <select
      value={status}
      onChange={e => onAlterar(e.target.value as StatusOrdem)}
      className="text-xs font-medium rounded-full border-0 bg-gray-100 px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {opcoes.map(o => (
        <option key={o} value={o}>{statusOrdem[o].label}</option>
      ))}
    </select>
  )
}
