import { Card } from '@/components/ui/Card'
import { formatarMoeda } from '@/lib/utils'

interface ResumoFinanceiroProps {
  entradas: number
  saidas: number
  pendente?: number
  /** Saldo acumulado do banco (Pix/cartão/transferência) — só visível pro proprietário. */
  saldoBanco?: number
  mostrarSaldoBanco?: boolean
}

const COLUNAS_LG = ['', '', '', 'lg:grid-cols-3', 'lg:grid-cols-4', 'lg:grid-cols-5']

export function ResumoFinanceiro({ entradas, saidas, pendente = 0, saldoBanco = 0, mostrarSaldoBanco = false }: ResumoFinanceiroProps) {
  const saldo = entradas - saidas
  const totalCartoes = 3 + (pendente > 0 ? 1 : 0) + (mostrarSaldoBanco ? 1 : 0)
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 ${COLUNAS_LG[totalCartoes]} gap-4`}>
      <Card>
        <p className="text-sm text-gray-500">Entradas (recebidas)</p>
        <p className="text-2xl font-bold text-green-600 mt-1">{formatarMoeda(entradas)}</p>
      </Card>
      <Card>
        <p className="text-sm text-gray-500">Saídas</p>
        <p className="text-2xl font-bold text-red-500 mt-1">{formatarMoeda(saidas)}</p>
      </Card>
      <Card>
        <p className="text-sm text-gray-500">Saldo do dia</p>
        <p className={`text-2xl font-bold mt-1 ${saldo >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{formatarMoeda(saldo)}</p>
      </Card>
      {pendente > 0 && (
        <Card>
          <p className="text-sm text-gray-500">A receber (pendente)</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{formatarMoeda(pendente)}</p>
          <p className="text-xs text-gray-400 mt-1">Fiado e vendas ainda não recebidas — não entra no caixa</p>
        </Card>
      )}
      {mostrarSaldoBanco && (
        <Card>
          <p className="text-sm text-gray-500">Saldo banco</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatarMoeda(saldoBanco)}</p>
          <p className="text-xs text-gray-400 mt-1">Pix, cartão e transferência — acumulado, só você vê</p>
        </Card>
      )}
    </div>
  )
}
