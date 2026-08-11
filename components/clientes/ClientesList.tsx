'use client'

import { Cliente } from '@/types'
import { Table, TableHead, TableBody, Th, Td, TableRow } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatarTelefone } from '@/lib/utils'

interface ClientesListProps {
  clientes: Cliente[]
  onEditar: (cliente: Cliente) => void
  onExcluir: (id: string) => void
}

export function ClientesList({ clientes, onEditar, onExcluir }: ClientesListProps) {
  if (clientes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm">Nenhum cliente encontrado</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <Th>Nome</Th>
          <Th>Telefone</Th>
          <Th>Estado</Th>
          <Th className="text-right">Ações</Th>
        </tr>
      </TableHead>
      <TableBody>
        {clientes.map((cliente) => (
          <TableRow key={cliente.id}>
            <Td>
              <span className="font-medium text-gray-900">{cliente.nome}</span>
            </Td>
            <Td>{cliente.telefone ? formatarTelefone(cliente.telefone) : '—'}</Td>
            <Td>
              <Badge cor={cliente.ativo ? 'green' : 'gray'}>
                {cliente.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </Td>
            <Td className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button variante="ghost" tamanho="sm" onClick={() => onEditar(cliente)}>
                  Editar
                </Button>
                <Button variante="perigo" tamanho="sm" onClick={() => onExcluir(cliente.id)}>
                  Excluir
                </Button>
              </div>
            </Td>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
