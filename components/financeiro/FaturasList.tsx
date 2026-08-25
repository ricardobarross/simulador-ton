'use client'

import { Fatura } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Table, TableHead, TableBody, Th, Td, TableRow } from '@/components/ui/Table'
import { formatarMoeda, formatarData } from '@/lib/utils'

interface FaturasListProps {
  faturas: Fatura[]
  ehProprietario: boolean
  onVerPDF: (fatura: Fatura) => void
  onEnviarWhatsapp: (fatura: Fatura) => void
  onDarBaixa: (fatura: Fatura) => void
  onCancelar: (fatura: Fatura) => void
}

const statusInfo: Record<string, { label: string; cor: 'yellow' | 'green' | 'red' }> = {
  pendente: { label: 'Pendente', cor: 'yellow' },
  paga: { label: 'Paga', cor: 'green' },
  cancelada: { label: 'Cancelada', cor: 'red' },
}

export function FaturasList({ faturas, ehProprietario, onVerPDF, onEnviarWhatsapp, onDarBaixa, onCancelar }: FaturasListProps) {
  if (faturas.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-12">Nenhuma fatura encontrada</p>
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <Th>Fatura</Th>
          <Th>Cliente</Th>
          <Th>Data</Th>
          <Th className="text-right">Valor</Th>
          <Th>Estado</Th>
          <Th className="text-right">Ações</Th>
        </tr>
      </TableHead>
      <TableBody>
        {faturas.map(f => {
          const st = statusInfo[f.status]
          return (
            <TableRow key={f.id}>
              <Td className="font-mono text-xs text-gray-500">{f.numero_fatura}</Td>
              <Td className="font-medium text-gray-900">{f.cliente?.nome ?? '—'}</Td>
              <Td>{formatarData(f.created_at)}</Td>
              <Td className="text-right font-semibold">{formatarMoeda(f.valor_total)}</Td>
              <Td><Badge cor={st.cor}>{st.label}</Badge></Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  <Button variante="ghost" tamanho="sm" onClick={() => onVerPDF(f)}>PDF</Button>
                  {f.status === 'pendente' && (
                    <>
                      <Button variante="ghost" tamanho="sm" onClick={() => onEnviarWhatsapp(f)}>WhatsApp</Button>
                      <Button variante="primario" tamanho="sm" onClick={() => onDarBaixa(f)}>Dar baixa</Button>
                      {ehProprietario && (
                        <Button variante="perigo" tamanho="sm" onClick={() => onCancelar(f)}>Cancelar</Button>
                      )}
                    </>
                  )}
                </div>
              </Td>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
