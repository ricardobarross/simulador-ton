import Link from 'next/link'
import { formatarMoeda } from '@/lib/utils'

export interface ItemDevedor {
  cliente_id: string
  cliente_nome: string
  saldo_devedor: number
  quantidade_fiados: number
}

export function RankingDevedores({ dados }: { dados: ItemDevedor[] }) {
  if (dados.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Nenhum fiado em aberto — ninguém devendo no momento.</p>
  }

  const maximo = Math.max(1, ...dados.map(d => d.saldo_devedor))

  return (
    <div className="space-y-3">
      {dados.map((d, i) => (
        <Link key={d.cliente_id} href={`/clientes/${d.cliente_id}`} className="block group">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-red-50 text-red-500 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <span className="font-medium text-gray-700 group-hover:text-blue-600 group-hover:underline">{d.cliente_nome}</span>
              <span className="text-xs text-gray-400">({d.quantidade_fiados} {d.quantidade_fiados === 1 ? 'fiado' : 'fiados'})</span>
            </span>
            <span className="font-semibold text-red-600">{formatarMoeda(d.saldo_devedor)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden ml-7">
            <div className="h-full rounded-full bg-red-500" style={{ width: `${(d.saldo_devedor / maximo) * 100}%` }} />
          </div>
        </Link>
      ))}
    </div>
  )
}
