'use client'

import { useEffect, useState } from 'react'
import { Cliente } from '@/types'
import { createClient } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface FiadoFormProps {
  onGuardar: (dados: { cliente_id: string; descricao: string; valor_total: number; data: string; data_vencimento: string | null; observacoes: string | null }) => Promise<void>
  onCancelar: () => void
}

function em30Dias(dataBase: string): string {
  const d = new Date(`${dataBase}T00:00:00`)
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

export function FiadoForm({ onGuardar, onCancelar }: FiadoFormProps) {
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nome'>[]>([])
  const [clienteId, setClienteId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [dataVencimento, setDataVencimento] = useState(em30Dias(new Date().toISOString().slice(0, 10)))
  const [observacoes, setObservacoes] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})

  useEffect(() => {
    async function carregarClientes() {
      const supabase = createClient()
      const { data } = await supabase.from('clientes').select('id, nome').eq('ativo', true).is('deleted_at', null).order('nome')
      setClientes(data ?? [])
    }
    carregarClientes()
  }, [])

  function validar() {
    const e: Record<string, string> = {}
    if (!clienteId) e.cliente = 'Selecciona um cliente'
    if (!descricao.trim()) e.descricao = 'Descreve o que ficou fiado'
    if (!valorTotal || parseFloat(valorTotal) <= 0) e.valor = 'Informa um valor válido'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validar()) return
    setCarregando(true)
    await onGuardar({
      cliente_id: clienteId,
      descricao: descricao.trim(),
      valor_total: parseFloat(valorTotal),
      data,
      data_vencimento: dataVencimento || null,
      observacoes: observacoes.trim() || null,
    })
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Cliente *</label>
        <select
          value={clienteId}
          onChange={e => setClienteId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Seleccionar cliente...</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        {erros.cliente && <p className="text-xs text-red-600">{erros.cliente}</p>}
      </div>

      <Input
        label="O que ficou fiado *"
        value={descricao}
        onChange={e => setDescricao(e.target.value)}
        erro={erros.descricao}
        placeholder="Ex: compras do mês, serviço de solda..."
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Valor total *"
          type="number"
          step="0.01"
          prefixo="R$"
          value={valorTotal}
          onChange={e => setValorTotal(e.target.value)}
          erro={erros.valor}
        />
        <Input label="Data" type="date" value={data} onChange={e => setData(e.target.value)} />
      </div>

      <Input
        label="Vencimento (opcional)"
        type="date"
        value={dataVencimento}
        onChange={e => setDataVencimento(e.target.value)}
      />
      <p className="text-xs text-gray-400 -mt-2">Sugerimos 30 dias após a data do fiado. Usado na régua de cobrança.</p>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Observações</label>
        <textarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>Anotar fiado</Button>
      </div>
    </div>
  )
}
