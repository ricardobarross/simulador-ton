import { Fiado } from '@/types'
import { formatarMoeda, formatarData } from '@/lib/utils'
import { valorPago, saldoRestante } from '@/components/financeiro/FiadosList'
import { ImprimirPortal } from '@/components/ui/ImprimirPortal'

interface FiadoRelatorioPDFProps {
  titulo: string
  subtitulo?: string
  fiados: Fiado[]
  nomeEmpresa?: string
}

export function FiadoRelatorioPDF({ titulo, subtitulo, fiados, nomeEmpresa = 'Surubim Tornearia' }: FiadoRelatorioPDFProps) {
  const totalDevido = fiados.reduce((s, f) => s + saldoRestante(f), 0)
  const hoje = new Date().toISOString()

  return (
    <ImprimirPortal>
    <div id="pdf-relatorio-fiado" className="imprimir-area bg-white p-8 max-w-3xl mx-auto font-sans text-sm text-gray-800">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{nomeEmpresa}</h1>
          <p className="text-gray-500 text-xs mt-1">Sistema de Gestão</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-blue-600">RELATÓRIO DE FIADO</p>
          <p className="text-xs text-gray-400 mt-1">Emitido em {formatarData(hoje)}</p>
        </div>
      </div>

      {/* Título / cliente */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{subtitulo ?? 'Cliente'}</p>
        <p className="font-semibold text-gray-900 text-base">{titulo}</p>
      </div>

      {fiados.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Nenhum fiado em aberto.</p>
      ) : (
        <>
          <table className="w-full mb-6">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Data</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Pago</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {fiados.map((f, i) => (
                <tr key={f.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2">
                    {f.descricao}
                    {f.cliente?.nome && <span className="block text-xs text-gray-400">{f.cliente.nome}</span>}
                  </td>
                  <td className="px-3 py-2 text-center">{formatarData(f.data)}</td>
                  <td className="px-3 py-2 text-right">{formatarMoeda(f.valor_total)}</td>
                  <td className="px-3 py-2 text-right text-green-600">{formatarMoeda(valorPago(f))}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatarMoeda(saldoRestante(f))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-6">
            <div className="w-56 space-y-1">
              <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-200 pt-2 mt-2">
                <span>Total devido</span>
                <span>{formatarMoeda(totalDevido)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
    </ImprimirPortal>
  )
}

// Função utilitária para imprimir / guardar como PDF
export function imprimirRelatorioFiado() {
  window.print()
}
