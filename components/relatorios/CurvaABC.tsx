import { formatarMoeda } from '@/lib/utils'

export interface ItemCurvaABC {
  categoria: string
  total: number
  percentual: number
}

const labelCategoria: Record<string, string> = {
  tornear: 'Tornear', fresar: 'Fresar', solda: 'Solda', bancada: 'Bancada', outro: 'Outro',
}

const corCategoria: Record<string, string> = {
  tornear: 'bg-blue-500', fresar: 'bg-green-500', solda: 'bg-orange-500', bancada: 'bg-yellow-500', outro: 'bg-gray-400',
}

export function CurvaABC({ dados }: { dados: ItemCurvaABC[] }) {
  if (dados.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Nenhum serviço lançado neste mês</p>
  }

  return (
    <div className="space-y-3">
      {dados.map(d => (
        <div key={d.categoria} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">{labelCategoria[d.categoria] ?? d.categoria}</span>
            <span className="text-gray-500">{formatarMoeda(d.total)} <span className="text-gray-300">·</span> {d.percentual.toFixed(1).replace('.', ',')}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${corCategoria[d.categoria] ?? 'bg-gray-400'}`} style={{ width: `${Math.min(100, d.percentual)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
