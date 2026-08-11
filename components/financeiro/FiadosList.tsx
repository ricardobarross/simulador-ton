'use client'

import { Fragment, useState } from 'react'
import { Fiado } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Table, TableHead, TableBody, Th, Td, TableRow } from '@/components/ui/Table'
import { formatarMoeda, formatarData } from '@/lib/utils'

interface FiadosListProps {
  fiados: Fiado[]
  ehProprietario: boolean
  onRegistrarPagamento: (fiado: Fiado) => void
  onExcluir: (fiado: Fiado) => void
}

const statusInfo: Record<string, { label: string; cor: 'gray' | 'yellow' | 'green' }> = {
  aberto: { label: 'Em aberto', cor: 'yellow' },
  parcial: { label: 'Pago em parte', cor: 'yellow' },
  quitado: { label: 'Quitado', cor: 'green' },
}

export function valorPago(fiado: Fiado): number {
  return (fiado.pagamentos ?? []).reduce((s, p) => s + p.valor, 0)
}

export function saldoRestante(fiado: Fiado): number {
  return Math.max(0, fiado.valor_total - valorPago(fiado))
}

export function FiadosList({ fiados, ehProprietario, onRegistrarPagamento, onExcluir }: FiadosListProps) {
  const [expandido, setExpandido] = useState<string | null>(null)

  if (fiados.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-12">Nenhum fiado encontrado</p>
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <Th>Cliente</Th>
          <Th>Descrição</Th>
          <Th>Data</Th>
          <Th className="text-right">Total</Th>
          <Th className="text-right">Pago</Th>
          <Th className="text-right">Saldo</Th>
          <Th>Estado</Th>
          <Th className="text-right">Ações</Th>
        </tr>
      </TableHead>
      <TableBody>
        {fiados.map(f => {
          const pago = valorPago(f)
          const saldo = saldoRestante(f)
          const st = statusInfo[f.status]
          const temHistorico = (f.pagamentos ?? []).length > 0
          return (
            <Fragment key={f.id}>
              <TableRow>
                <Td className="font-medium text-gray-900">{f.cliente?.nome ?? '—'}</Td>
                <Td>
                  {f.descricao}
                  {temHistorico && (
                    <button
                      onClick={() => setExpandido(expandido === f.id ? null : f.id)}
                      className="block text-xs text-blue-600 hover:underline mt-0.5"
                    >
                      {expandido === f.id ? 'Ocultar pagamentos' : `Ver pagamentos (${f.pagamentos!.length})`}
                    </button>
                  )}
                </Td>
                <Td>{formatarData(f.data)}</Td>
                <Td className="text-right">{formatarMoeda(f.valor_total)}</Td>
                <Td className="text-right text-green-600">{pago > 0 ? formatarMoeda(pago) : '—'}</Td>
                <Td className="text-right font-semibold">{saldo > 0 ? formatarMoeda(saldo) : '—'}</Td>
                <Td><Badge cor={st.cor}>{st.label}</Badge></Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {saldo > 0 && (
                      <Button variante="primario" tamanho="sm" onClick={() => onRegistrarPagamento(f)}>Receber</Button>
                    )}
                    {ehProprietario && (
                      <Button variante="perigo" tamanho="sm" onClick={() => onExcluir(f)}>Excluir</Button>
                    )}
                  </div>
                </Td>
              </TableRow>
              {expandido === f.id && temHistorico && (
                <tr className="bg-gray-50">
                  <td colSpan={8} className="px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Histórico de pagamentos</p>
                    <div className="space-y-1">
                      {f.pagamentos!.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{formatarData(p.data)} · {p.forma_pagamento ?? '—'}{p.observacoes ? ` · ${p.observacoes}` : ''}</span>
                          <span className="font-medium text-green-600">{formatarMoeda(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}
