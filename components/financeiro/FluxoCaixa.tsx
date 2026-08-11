'use client'

import { useEffect, useState } from 'react'
import { FechamentoCaixa } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatarMoeda } from '@/lib/utils'

interface FluxoCaixaProps {
  data: string
  fechamento: FechamentoCaixa | null
  totalEntradas: number
  totalSaidas: number
  totalPendente?: number
  valorAberturaSugerido: number
  ehProprietario: boolean
  onFechar: (dados: { valor_abertura: number; valor_contado: number; observacoes: string }) => Promise<void>
}

export function FluxoCaixa({
  data,
  fechamento,
  totalEntradas,
  totalSaidas,
  totalPendente = 0,
  valorAberturaSugerido,
  ehProprietario,
  onFechar,
}: FluxoCaixaProps) {
  const [editando, setEditando] = useState(false)
  const [valorAbertura, setValorAbertura] = useState(valorAberturaSugerido.toString())
  const [valorContado, setValorContado] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    setValorAbertura((fechamento?.valor_abertura ?? valorAberturaSugerido).toString())
    setValorContado(fechamento?.valor_contado?.toString() ?? '')
    setObservacoes(fechamento?.observacoes ?? '')
    setEditando(false)
  }, [data, fechamento, valorAberturaSugerido])

  const abertura = parseFloat(valorAbertura) || 0
  const esperado = abertura + totalEntradas - totalSaidas
  const contado = parseFloat(valorContado) || 0
  const diferenca = contado - esperado

  async function handleFechar() {
    setCarregando(true)
    await onFechar({ valor_abertura: abertura, valor_contado: contado, observacoes })
    setCarregando(false)
    setEditando(false)
  }

  const podeEditar = !fechamento || ehProprietario

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fechamento de caixa — {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}</CardTitle>
        {fechamento && <Badge cor="green">Fechado</Badge>}
      </CardHeader>

      {fechamento && !editando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-gray-400 text-xs">Abertura</p><p className="font-medium">{formatarMoeda(fechamento.valor_abertura)}</p></div>
            <div><p className="text-gray-400 text-xs">Entradas</p><p className="font-medium text-green-600">{formatarMoeda(fechamento.total_entradas)}</p></div>
            <div><p className="text-gray-400 text-xs">Saídas</p><p className="font-medium text-red-500">{formatarMoeda(fechamento.total_saidas)}</p></div>
            <div><p className="text-gray-400 text-xs">Esperado</p><p className="font-medium">{formatarMoeda(fechamento.valor_esperado)}</p></div>
            <div><p className="text-gray-400 text-xs">Contado</p><p className="font-medium">{formatarMoeda(fechamento.valor_contado ?? 0)}</p></div>
            <div>
              <p className="text-gray-400 text-xs">Diferença</p>
              <p className={`font-medium ${(fechamento.diferenca ?? 0) === 0 ? 'text-gray-900' : (fechamento.diferenca ?? 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatarMoeda(fechamento.diferenca ?? 0)}
              </p>
            </div>
          </div>
          {fechamento.observacoes && <p className="text-xs text-gray-500">{fechamento.observacoes}</p>}
          {ehProprietario && (
            <Button variante="ghost" tamanho="sm" onClick={() => setEditando(true)}>Editar fechamento</Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {!podeEditar && (
            <p className="text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
              Só o proprietário pode alterar um caixa já fechado.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Valor de abertura" type="number" step="0.01" prefixo="R$" value={valorAbertura} onChange={e => setValorAbertura(e.target.value)} disabled={!podeEditar} />
            <Input label="Valor contado no caixa" type="number" step="0.01" prefixo="R$" value={valorContado} onChange={e => setValorContado(e.target.value)} disabled={!podeEditar} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm bg-gray-50 rounded-lg p-3">
            <div><p className="text-gray-400 text-xs">Entradas recebidas</p><p className="font-medium text-green-600">{formatarMoeda(totalEntradas)}</p></div>
            <div><p className="text-gray-400 text-xs">Saídas do dia</p><p className="font-medium text-red-500">{formatarMoeda(totalSaidas)}</p></div>
            <div><p className="text-gray-400 text-xs">Esperado</p><p className="font-medium">{formatarMoeda(esperado)}</p></div>
            <div>
              <p className="text-gray-400 text-xs">Diferença</p>
              <p className={`font-medium ${diferenca === 0 ? 'text-gray-900' : diferenca > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatarMoeda(diferenca)}</p>
            </div>
          </div>
          {totalPendente > 0 && (
            <p className="text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg">
              Tem {formatarMoeda(totalPendente)} em fiado/vendas ainda não recebidas hoje — isso já ficou de fora da conta acima, não precisa descontar na mão.
            </p>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              disabled={!podeEditar}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50"
            />
          </div>
          {podeEditar && (
            <div className="flex justify-end gap-3">
              {editando && <Button variante="secundario" onClick={() => setEditando(false)}>Cancelar</Button>}
              <Button variante="primario" carregando={carregando} onClick={handleFechar}>
                {fechamento ? 'Guardar alterações' : 'Fechar caixa do dia'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
