import { Badge } from '@/components/ui/Badge'

interface ContagemStatus {
  status: string
  label: string
  cor: 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red'
  quantidade: number
}

const corBarra: Record<string, string> = {
  gray: 'bg-gray-400', blue: 'bg-blue-500', green: 'bg-green-500',
  yellow: 'bg-yellow-400', orange: 'bg-orange-400', red: 'bg-red-500',
}

export function GraficoOrcamentos({ dados }: { dados: ContagemStatus[] }) {
  const total = Math.max(1, dados.reduce((s, d) => s + d.quantidade, 0))

  return (
    <div className="space-y-3">
      {dados.map(d => (
        <div key={d.status} className="flex items-center gap-3">
          <Badge cor={d.cor}>{d.label}</Badge>
          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div className={`h-full ${corBarra[d.cor]}`} style={{ width: `${(d.quantidade / total) * 100}%` }} />
          </div>
          <span className="text-sm font-medium text-gray-700 w-6 text-right">{d.quantidade}</span>
        </div>
      ))}
    </div>
  )
}
