'use client'

import { useState, useEffect } from 'react'
import { Orcamento, ItemOrcamento, Cliente, Servico } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { createClient } from '@/lib/supabase'
import { formatarMoeda } from '@/lib/utils'

interface OrcamentoFormProps {
  inicial?: Partial<Orcamento>
  onGuardar: (dados: Partial<Orcamento>) => Promise<void>
  onCancelar: () => void
}

const itemVazio = (): ItemOrcamento => ({
  id:             crypto.randomUUID(),
  descricao:      '',
  quantidade:     1,
  unidade:        'un',
  valor_unitario: 0,
  valor_total:    0,
})

export function OrcamentoForm({ inicial, onGuardar, onCancelar }: OrcamentoFormProps) {
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nome'>[]>([])
  const [servicos, setServicos] = useState<Pick<Servico, 'id' | 'nome' | 'categoria' | 'preco_base'>[]>([])
  const [clienteId, setClienteId] = useState(inicial?.cliente_id ?? '')
  const [status, setStatus] = useState(inicial?.status ?? 'rascunho')
  const [validadeDias, setValidadeDias] = useState(inicial?.validade_dias ?? 30)
  const [desconto, setDesconto] = useState(inicial?.desconto ?? 0)
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '')
  const [itens, setItens] = useState<ItemOrcamento[]>(
    inicial?.itens?.length ? inicial.itens : [itemVazio()]
  )
  const [carregando, setCarregando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})

  useEffect(() => {
    async function carregarDados() {
      const supabase = createClient()
      const [{ data: cli }, { data: srv }] = await Promise.all([
        supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('servicos').select('id, nome, categoria, preco_base').eq('ativo', true).order('categoria').order('nome'),
      ])
      setClientes(cli ?? [])
      setServicos(srv ?? [])
    }
    carregarDados()
  }, [])

  function atualizarItem(index: number, campo: keyof ItemOrcamento, valor: string | number) {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item
      const atualizado = { ...item, [campo]: valor }
      atualizado.valor_total = atualizado.quantidade * atualizado.valor_unitario
      return atualizado
    }))
  }

  function selecionarServico(index: number, servicoId: string) {
    const servico = servicos.find(s => s.id === servicoId)
    if (!servico) return
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item
      const atualizado = {
        ...item,
        servico_id: servico.id,
        descricao: servico.nome,
        valor_unitario: servico.preco_base ?? item.valor_unitario,
      }
      atualizado.valor_total = atualizado.quantidade * atualizado.valor_unitario
      return atualizado
    }))
  }

  const categoriaLabel: Record<string, string> = {
    tornear: 'Tornear', fresar: 'Fresar', solda: 'Solda', bancada: 'Bancada', outro: 'Outro',
  }

  function adicionarItem() {
    setItens(prev => [...prev, itemVazio()])
  }

  function removerItem(index: number) {
    setItens(prev => prev.filter((_, i) => i !== index))
  }

  const subtotal = itens.reduce((s, i) => s + i.valor_total, 0)
  const total    = subtotal - desconto

  function validar() {
    const e: Record<string, string> = {}
    if (!clienteId) e.cliente = 'Selecciona um cliente'
    if (itens.length === 0) e.itens = 'Adiciona pelo menos um item'
    itens.forEach((item, i) => {
      if (!item.descricao.trim()) e[`item_${i}`] = 'Descrição obrigatória'
    })
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validar()) return
    setCarregando(true)
    await onGuardar({
      cliente_id:    clienteId,
      status,
      itens,
      subtotal,
      desconto,
      total,
      validade_dias: validadeDias,
      observacoes,
    })
    setCarregando(false)
  }

  return (
    <div className="space-y-6">
      {/* Cliente e configurações */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Cliente *</label>
          <SearchableSelect
            value={clienteId}
            onChange={setClienteId}
            placeholder="Selecionar cliente..."
            options={clientes.map(c => ({ value: c.id, label: c.nome }))}
          />
          {erros.cliente && <p className="text-xs text-red-600">{erros.cliente}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Estado</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as Orcamento['status'])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="rascunho">Rascunho</option>
            <option value="enviado">Enviado</option>
            <option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option>
            <option value="expirado">Expirado</option>
          </select>
        </div>
      </div>

      {/* Itens */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Itens do orçamento</h3>
          <Button variante="secundario" tamanho="sm" onClick={adicionarItem}>
            + Adicionar item
          </Button>
        </div>

        {erros.itens && <p className="text-xs text-red-600 mb-2">{erros.itens}</p>}

        <div className="space-y-3">
          {/* Cabeçalho */}
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 uppercase px-1">
            <span className="col-span-5">Descrição</span>
            <span className="col-span-2 text-center">Qtd</span>
            <span className="col-span-1 text-center">Un</span>
            <span className="col-span-2 text-right">V. Unit.</span>
            <span className="col-span-2 text-right">Total</span>
          </div>

          {itens.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-12 sm:col-span-5 space-y-1.5">
                <SearchableSelect
                  value=""
                  onChange={(id) => selecionarServico(index, id)}
                  placeholder="Selecionar serviço cadastrado..."
                  limparAposEscolher
                  options={servicos.map(s => ({
                    value: s.id,
                    label: `${s.nome}${s.preco_base ? ` — ${formatarMoeda(s.preco_base)}` : ''}`,
                    grupo: categoriaLabel[s.categoria],
                  }))}
                />
                <input
                  value={item.descricao}
                  onChange={e => atualizarItem(index, 'descricao', e.target.value)}
                  placeholder="Descrição do serviço ou produto"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {erros[`item_${index}`] && (
                  <p className="text-xs text-red-600 mt-0.5">{erros[`item_${index}`]}</p>
                )}
              </div>

              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.quantidade}
                  onChange={e => atualizarItem(index, 'quantidade', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-3 sm:col-span-1">
                <input
                  value={item.unidade}
                  onChange={e => atualizarItem(index, 'unidade', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.valor_unitario}
                  onChange={e => atualizarItem(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-4 sm:col-span-2 flex items-center justify-between gap-1">
                <span className="text-sm font-medium text-gray-900 flex-1 text-right py-2">
                  {formatarMoeda(item.valor_total)}
                </span>
                {itens.length > 1 && (
                  <button
                    onClick={() => removerItem(index)}
                    className="text-red-400 hover:text-red-600 p-1 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totais */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex flex-col items-end gap-2 text-sm">
          <div className="flex items-center gap-6">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium w-32 text-right">{formatarMoeda(subtotal)}</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-gray-500">Desconto (R$)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={desconto}
              onChange={e => setDesconto(parseFloat(e.target.value) || 0)}
              className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-6 text-base font-bold text-gray-900">
            <span>Total</span>
            <span className="w-32 text-right">{formatarMoeda(total)}</span>
          </div>
        </div>
      </div>

      {/* Validade e observações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Validade (dias)"
          type="number"
          min="1"
          value={validadeDias}
          onChange={e => setValidadeDias(parseInt(e.target.value) || 30)}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Observações</label>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Condições, prazos, informações adicionais..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      {/* Acções */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>
          Cancelar
        </Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>
          {inicial?.id ? 'Guardar alterações' : 'Criar orçamento'}
        </Button>
      </div>
    </div>
  )
}