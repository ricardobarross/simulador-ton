'use client'

import { Fiado } from '@/types'
import { Button } from '@/components/ui/Button'
import { estaVencido, diasEmAtraso } from '@/lib/cobranca'
import { saldoRestante } from '@/components/financeiro/FiadosList'
import { abrirWhatsapp, mensagemCobrancaFiado } from '@/lib/whatsapp'
import { formatarMoeda } from '@/lib/utils'

interface ReguaCobrancaProps {
  fiados: Fiado[]
  onErroSemTelefone: () => void
}

export function ReguaCobranca({ fiados, onErroSemTelefone }: ReguaCobrancaProps) {
  const vencidos = fiados
    .filter(f => f.status !== 'quitado' && estaVencido(f))
    .sort((a, b) => diasEmAtraso(b) - diasEmAtraso(a))

  if (vencidos.length === 0) return null

  const totalVencido = vencidos.reduce((s, f) => s + saldoRestante(f), 0)

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-semibold text-red-700">
            {vencidos.length} {vencidos.length === 1 ? 'fiado vencido' : 'fiados vencidos'} · {formatarMoeda(totalVencido)} em atraso
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {vencidos.map(f => {
          const saldo = saldoRestante(f)
          const atraso = diasEmAtraso(f)
          return (
            <div key={f.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2 border border-red-100">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{f.cliente?.nome ?? '—'}</p>
                <p className="text-xs text-gray-500 truncate">{f.descricao} · {atraso} {atraso === 1 ? 'dia' : 'dias'} em atraso</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-red-600">{formatarMoeda(saldo)}</span>
                <Button
                  variante="secundario"
                  tamanho="sm"
                  onClick={() => {
                    const enviado = abrirWhatsapp(f.cliente?.telefone, mensagemCobrancaFiado(f, saldo))
                    if (!enviado) onErroSemTelefone()
                  }}
                >
                  Cobrar
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
