import { Fatura } from '@/types'
import { DadosPix } from '@/lib/configuracoes'
import { formatarMoeda, formatarData } from '@/lib/utils'
import { ImprimirPortal } from '@/components/ui/ImprimirPortal'

interface FaturaPDFProps {
  fatura: Fatura
  pix: DadosPix
  nomeEmpresa?: string
}

export function FaturaPDF({ fatura, pix, nomeEmpresa = 'Surubim Tornearia' }: FaturaPDFProps) {
  const itens = fatura.itens ?? []

  return (
    <ImprimirPortal>
    <div id="pdf-fatura" className="imprimir-area bg-white p-8 max-w-3xl mx-auto font-sans text-sm text-gray-800">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{nomeEmpresa}</h1>
          <p className="text-gray-500 text-xs mt-1">Sistema de Gestão</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-blue-600">FATURA CONSOLIDADA</p>
          <p className="text-gray-500 font-mono text-sm">{fatura.numero_fatura}</p>
          <p className="text-xs text-gray-400 mt-1">Emitida em {formatarData(fatura.created_at)}</p>
        </div>
      </div>

      {/* Cliente */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cliente</p>
        <p className="font-semibold text-gray-900 text-base">{fatura.cliente?.nome}</p>
        {fatura.cliente?.telefone && <p className="text-gray-500 text-xs">{fatura.cliente.telefone}</p>}
      </div>

      {/* Itens (fiados consolidados) — mostra o número da O.S. e o nome real de
          cada serviço (não a descrição genérica), pra o cliente identificar do
          que se trata cada cobrança. */}
      <table className="w-full mb-6">
        <thead>
          <tr className="bg-gray-50 border-y border-gray-200">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">O.S. / Serviço</th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Data</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Valor</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, i) => {
            const itensOS = item.fiado?.ordem_servico?.itens ?? []
            return (
              <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2">
                  <span className="font-medium">
                    {item.fiado?.ordem_servico ? item.fiado.ordem_servico.numero : (item.fiado?.descricao ?? '—')}
                  </span>
                  {itensOS.length > 0 && (
                    <ul className="mt-0.5">
                      {itensOS.map((servicoItem, idx) => (
                        <li key={servicoItem.id ?? idx} className="text-xs text-gray-500">
                          {servicoItem.descricao}{servicoItem.quantidade > 1 ? ` (${servicoItem.quantidade}x)` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2 text-center">{item.fiado?.data ? formatarData(item.fiado.data) : '—'}</td>
                <td className="px-3 py-2 text-right font-medium">{formatarMoeda(item.valor)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Total */}
      <div className="flex justify-end mb-6">
        <div className="w-56 space-y-1">
          <div className="flex justify-between font-bold text-base text-gray-900 border-t-2 border-gray-300 pt-2 mt-2">
            <span>Total da fatura</span>
            <span>{formatarMoeda(fatura.valor_total)}</span>
          </div>
        </div>
      </div>

      {/* Dados para pagamento */}
      {(pix.chave || pix.dadosBancarios) && (
        <div className="border-t border-gray-200 pt-4 text-xs text-gray-600 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Dados para pagamento</p>
          {pix.chave && <p>Chave Pix: <strong className="text-gray-800">{pix.chave}</strong>{pix.titular ? ` — ${pix.titular}` : ''}</p>}
          {pix.dadosBancarios && <p className="whitespace-pre-line">{pix.dadosBancarios}</p>}
        </div>
      )}
    </div>
    </ImprimirPortal>
  )
}

// Função utilitária para imprimir / guardar como PDF
export function imprimirFatura() {
  window.print()
}
