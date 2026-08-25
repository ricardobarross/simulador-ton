import { Cheque, StatusCheque } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Table, TableHead, TableBody, Th, Td, TableRow } from '@/components/ui/Table'
import { formatarMoeda, formatarData } from '@/lib/utils'

interface ChequesListProps {
  cheques: Cheque[]
  onCompensar: (cheque: Cheque) => void
  onDevolver: (cheque: Cheque) => void
}

const statusInfo: Record<StatusCheque, { label: string; cor: 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red' }> = {
  aguardando: { label: 'Aguardando', cor: 'yellow' },
  compensado: { label: 'Compensado', cor: 'green' },
  devolvido:  { label: 'Devolvido', cor: 'red' },
}

export function ChequesList({ cheques, onCompensar, onDevolver }: ChequesListProps) {
  if (cheques.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-12">Nenhum cheque encontrado</p>
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <Th>Número</Th>
          <Th>Banco / Conta</Th>
          <Th>Titular</Th>
          <Th>Cliente</Th>
          <Th>Recebido em</Th>
          <Th>Estado</Th>
          <Th className="text-right">Valor</Th>
          <Th className="text-right">Ações</Th>
        </tr>
      </TableHead>
      <TableBody>
        {cheques.map(c => (
          <TableRow key={c.id}>
            <Td className="font-mono text-xs">{c.numero_cheque}</Td>
            <Td>{c.banco} <span className="text-gray-400">· {c.numero_conta}</span></Td>
            <Td>
              {c.nome_titular}
              {c.telefone && <span className="block text-xs text-gray-400">{c.telefone}</span>}
            </Td>
            <Td>{c.cliente?.nome ?? '—'}</Td>
            <Td>{formatarData(c.data_recebimento)}</Td>
            <Td>
              <Badge cor={statusInfo[c.status].cor}>{statusInfo[c.status].label}</Badge>
              {c.status === 'devolvido' && c.motivo_devolucao && (
                <p className="text-xs text-gray-400 mt-0.5 max-w-[14rem]">{c.motivo_devolucao}</p>
              )}
            </Td>
            <Td className="text-right font-semibold text-gray-900">{formatarMoeda(c.valor)}</Td>
            <Td className="text-right">
              {c.status === 'aguardando' ? (
                <div className="flex items-center justify-end gap-2">
                  <Button variante="secundario" tamanho="sm" onClick={() => onCompensar(c)}>Compensou</Button>
                  <Button variante="perigo" tamanho="sm" onClick={() => onDevolver(c)}>Devolveu</Button>
                </div>
              ) : (
                <span className="text-xs text-gray-300">—</span>
              )}
            </Td>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
