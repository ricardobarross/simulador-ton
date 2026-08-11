import { formatarMoeda } from '@/lib/utils'

interface PontoMensal {
  mes: string
  receita: number
  despesa: number
}

export function GraficoReceita({ dados }: { dados: PontoMensal[] }) {
  const maximo = Math.max(1, ...dados.map(d => Math.max(d.receita, d.despesa)))

  return (
    <div className="space-y-3">
      {dados.map(d => (
        <div key={d.mes} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-medium text-gray-700">{d.mes}</span>
            <span>{formatarMoeda(d.receita)} <span className="text-gray-300">/</span> {formatarMoeda(d.despesa)}</span>
          </div>
          <div className="flex gap-1 h-3">
            <div className="bg-green-500 rounded-l" style={{ width: `${(d.receita / maximo) * 100}%` }} />
            <div className="bg-red-400 rounded-r" style={{ width: `${(d.despesa / maximo) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-4 text-xs text-gray-400 pt-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Receitas</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Despesas</span>
      </div>
    </div>
  )
}
