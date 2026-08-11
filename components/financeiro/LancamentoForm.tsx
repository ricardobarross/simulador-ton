'use client'

import { useState } from 'react'
import { Lancamento, TipoLancamento, StatusLancamento } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface LancamentoFormProps {
  inicial?: Partial<Lancamento>
  tipoFixo?: TipoLancamento
  onGuardar: (dados: Partial<Lancamento>) => Promise<void>
  onCancelar: () => void
}

const categoriasEntrada = ['Serviço prestado', 'Venda', 'Adiantamento', 'Outro']
const categoriasSaida = ['Fornecedor', 'Conta fixa', 'Material', 'Salário', 'Manutenção', 'Outro']

export function LancamentoForm({ inicial, tipoFixo, onGuardar, onCancelar }: LancamentoFormProps) {
  const [tipo, setTipo] = useState<TipoLancamento>(inicial?.tipo ?? tipoFixo ?? 'entrada')
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '')
  const [valor, setValor] = useState(inicial?.valor?.toString() ?? '')
  const [formaPagamento, setFormaPagamento] = useState(inicial?.forma_pagamento ?? 'Dinheiro')
  const [data, setData] = useState(inicial?.data ?? new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState<StatusLancamento>(inicial?.status ?? 'pago')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit() {
    if (!descricao.trim() || !valor) { setErro('Descrição e valor são obrigatórios'); return }
    setErro('')
    setCarregando(true)
    await onGuardar({
      tipo,
      descricao: descricao.trim(),
      categoria: categoria || null,
      valor: parseFloat(valor),
      forma_pagamento: formaPagamento,
      data,
      status,
    })
    setCarregando(false)
  }

  const categorias = tipo === 'entrada' ? categoriasEntrada : categoriasSaida

  return (
    <div className="space-y-4">
      {!tipoFixo && (
        <div className="flex gap-2">
          <button
            onClick={() => setTipo('entrada')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${tipo === 'entrada' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Entrada
          </button>
          <button
            onClick={() => setTipo('saida')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${tipo === 'saida' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Saída
          </button>
        </div>
      )}

      <Input label="Descrição *" value={descricao} onChange={e => setDescricao(e.target.value)} erro={erro} />

      <div className="grid grid-cols-2 gap-4">
        <Input label="Valor *" type="number" step="0.01" prefixo="R$" value={valor} onChange={e => setValor(e.target.value)} />
        <Input label="Data" type="date" value={data} onChange={e => setData(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Categoria</label>
          <select value={categoria ?? ''} onChange={e => setCategoria(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">—</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Forma de pagamento</label>
          <select value={formaPagamento ?? ''} onChange={e => setFormaPagamento(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="Dinheiro">Dinheiro</option>
            <option value="Pix">Pix</option>
            <option value="Débito">Cartão de débito</option>
            <option value="Crédito">Cartão de crédito</option>
            <option value="Transferência">Transferência</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Estado</label>
        <select value={status} onChange={e => setStatus(e.target.value as StatusLancamento)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="pago">Pago</option>
          <option value="pendente">Pendente</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>
          {inicial?.id ? 'Guardar alterações' : 'Registar lançamento'}
        </Button>
      </div>
    </div>
  )
}
