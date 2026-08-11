import { Orcamento } from '@/types'
import { formatarMoeda, formatarData } from '@/lib/utils'

interface OrcamentoPDFProps {
  orcamento: Orcamento
  nomeEmpresa?: string
}

export function OrcamentoPDF({ orcamento, nomeEmpresa = 'Surubim Tornearia' }: OrcamentoPDFProps) {
  return (
    <div id="pdf-orcamento" className="imprimir-area bg-white p-8 max-w-3xl mx-auto font-sans text-sm text-gray-800">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{nomeEmpresa}</h1>
          <p className="text-gray-500 text-xs mt-1">Sistema de Gestão</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-blue-600">ORÇAMENTO</p>
          <p className="text-gray-500 font-mono text-sm">{orcamento.numero}</p>
          <p className="text-xs text-gray-400 mt-1">
            Emitido em {formatarData(orcamento.created_at)}
          </p>
        </div>
      </div>

      {/* Cliente */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cliente</p>
        <p className="font-semibold text-gray-900 text-base">{orcamento.cliente?.nome}</p>
        {orcamento.cliente?.telefone && (
          <p className="text-gray-500 text-xs">{orcamento.cliente.telefone}</p>
        )}
      </div>

      {/* Itens */}
      <table className="w-full mb-6">
        <thead>
          <tr className="bg-gray-50 border-y border-gray-200">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Qtd</th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Un</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">V. Unit.</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
          </tr>
        </thead>
        <tbody>
          {orcamento.itens.map((item, i) => (
            <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-2">{item.descricao}</td>
              <td className="px-3 py-2 text-center">{item.quantidade}</td>
              <td className="px-3 py-2 text-center">{item.unidade}</td>
              <td className="px-3 py-2 text-right">{formatarMoeda(item.valor_unitario)}</td>
              <td className="px-3 py-2 text-right font-medium">{formatarMoeda(item.valor_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totais */}
      <div className="flex justify-end mb-6">
        <div className="w-56 space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatarMoeda(orcamento.subtotal)}</span>
          </div>
          {orcamento.desconto > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Desconto</span>
              <span>- {formatarMoeda(orcamento.desconto)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-200 pt-2 mt-2">
            <span>Total</span>
            <span>{formatarMoeda(orcamento.total)}</span>
          </div>
        </div>
      </div>

      {/* Validade e observações */}
      <div className="border-t border-gray-200 pt-4 space-y-2 text-xs text-gray-500">
        <p>Validade do orçamento: <strong className="text-gray-700">{orcamento.validade_dias} dias</strong></p>
        {orcamento.observacoes && (
          <p>Observações: {orcamento.observacoes}</p>
        )}
      </div>
    </div>
  )
}

// Função utilitária para imprimir o PDF
export function imprimirOrcamento() {
  window.print()
}