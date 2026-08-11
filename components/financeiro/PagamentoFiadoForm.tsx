'use client'

import { useState } from 'react'
import { Fiado } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatarMoeda } from '@/lib/utils'

interface PagamentoFiadoFormProps {
  fiado: Fiado
  saldoRestante: number
  onGuardar: (dados: { valor: number; data: string; forma_pagamento: string; observacoes: string | null }) => Promise<void>
  onCancelar: () => void
}

export function PagamentoFiadoForm({ fiado, saldoRestante, onGuardar, onCancelar }: PagamentoFiadoFormProps) {
  const [valor, setValor] = useState(saldoRestante.toFixed(2))
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [formaPagamento, setFormaPagamento] = useState('Dinheiro')
  const [observacoes, setObservacoes] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit() {
    const valorNum = parseFloat(valor)
    if (!valorNum || valorNum <= 0) { setErro('Informa um valor válido'); return }
    if (valorNum > saldoRestante + 0.01) { setErro(`O valor não pode ser maior que o saldo devedor (${formatarMoeda(saldoRestante)})`); return }
    setErro('')
    setCarregando(true)
    await onGuardar({ valor: valorNum, data, forma_pagamento: formaPagamento, observacoes: observacoes.trim() || null })
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
        <p className="text-gray-500">Cliente: <span className="font-medium text-gray-900">{fiado.cliente?.nome}</span></p>
        <p className="text-gray-500">{fiado.descricao}</p>
        <p className="text-gray-500">Saldo devedor: <span className="font-semibold text-red-600">{formatarMoeda(saldoRestante)}</span> de {formatarMoeda(fiado.valor_total)}</p>
      </div>

      <Input
        label="Valor recebido *"
        type="number"
        step="0.01"
        prefixo="R$"
        value={valor}
        onChange={e => setValor(e.target.value)}
        erro={erro}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input label="Data" type="date" value={data} onChange={e => setData(e.target.value)} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Forma de pagamento</label>
          <select
            value={formaPagamento}
            onChange={e => setFormaPagamento(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Dinheiro">Dinheiro</option>
            <option value="Pix">Pix</option>
            <option value="Débito">Cartão de débito</option>
            <option value="Crédito">Cartão de crédito</option>
            <option value="Transferência">Transferência</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Observações</label>
        <textarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <p className="text-xs text-gray-400">Esse pagamento também será registado como entrada no caixa do dia.</p>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>Registar pagamento</Button>
      </div>
    </div>
  )
}
