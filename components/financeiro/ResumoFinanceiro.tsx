import { Card } from '@/components/ui/Card'
import { formatarMoeda } from '@/lib/utils'

interface ResumoFinanceiroProps {
  entradas: number
  saidas: number
  pendente?: number
}

export function ResumoFinanceiro({ entradas, saidas, pendente = 0 }: ResumoFinanceiroProps) {
  const saldo = entradas - saidas
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 ${pendente > 0 ? 'lg:grid-cols-4' : ''} gap-4`}>
      <Card>
        <p className="text-sm text-gray-500">Entradas (recebidas)</p>
        <p className="text-2xl font-bold text-green-600 mt-1">{formatarMoeda(entradas)}</p>
      </Card>
      <Card>
        <p className="text-sm text-gray-500">Saídas</p>
        <p className="text-2xl font-bold text-red-500 mt-1">{formatarMoeda(saidas)}</p>
      </Card>
      <Card>
        <p className="text-sm text-gray-500">Saldo do caixa</p>
        <p className={`text-2xl font-bold mt-1 ${saldo >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{formatarMoeda(saldo)}</p>
      </Card>
      {pendente > 0 && (
        <Card>
          <p className="text-sm text-gray-500">A receber (pendente)</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{formatarMoeda(pendente)}</p>
          <p className="text-xs text-gray-400 mt-1">Fiado e vendas ainda não recebidas — não entra no caixa</p>
        </Card>
      )}
    </div>
  )
}
