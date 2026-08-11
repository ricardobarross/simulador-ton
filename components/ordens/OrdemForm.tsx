'use client'

import { useState, useEffect } from 'react'
import { OrdemServico, ItemOrcamento, Cliente, Servico, PagamentoOS } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { FormaPagamentoSplit } from '@/components/financeiro/FormaPagamentoSplit'
import { createClient } from '@/lib/supabase'
import { formatarMoeda } from '@/lib/utils'

interface OrdemFormProps {
  inicial?: Partial<OrdemServico>
  onGuardar: (dados: Partial<OrdemServico>) => Promise<void>
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

export function OrdemForm({ inicial, onGuardar, onCancelar }: OrdemFormProps) {
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nome'>[]>([])
  const [servicos, setServicos] = useState<Pick<Servico, 'id' | 'nome' | 'categoria' | 'preco_base'>[]>([])
  const [clienteId, setClienteId] = useState(inicial?.cliente_id ?? '')
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '')
  const [desconto, setDesconto] = useState(inicial?.desconto ?? 0)
  const [pagamentos, setPagamentos] = useState<PagamentoOS[]>(
    inicial?.pagamentos?.length ? inicial.pagamentos : [{ forma: inicial?.forma_pagamento ?? 'Dinheiro', valor: inicial?.total ?? 0 }]
  )
  const [itens, setItens] = useState<ItemOrcamento[]>(inicial?.itens?.length ? inicial.itens : [itemVazio()])
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

  function adicionarItem() { setItens(prev => [...prev, itemVazio()]) }
  function removerItem(index: number) { setItens(prev => prev.filter((_, i) => i !== index)) }

  const categoriaLabel: Record<string, string> = {
    tornear: 'Tornear', fresar: 'Fresar', solda: 'Solda', bancada: 'Bancada', outro: 'Outro',
  }

  const subtotal = itens.reduce((s, i) => s + i.valor_total, 0)
  const total = subtotal - desconto

  function validar() {
    const e: Record<string, string> = {}
    if (!clienteId) e.cliente = 'Selecciona um cliente'
    itens.forEach((item, i) => { if (!item.descricao.trim()) e[`item_${i}`] = 'Descrição obrigatória' })
    if (pagamentos.length > 1) {
      const soma = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0)
      if (Math.round((soma - total) * 100) !== 0) e.pagamento = 'A soma das formas de pagamento precisa bater com o total da O.S.'
    }
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validar()) return
    setCarregando(true)
    // Se não foi dividido, a única linha sempre reflete o valor total atual (mesmo que os itens tenham mudado).
    const pagamentosFinal = pagamentos.length > 1 ? pagamentos : [{ forma: pagamentos[0].forma, valor: total }]
    const formaResumo = pagamentosFinal.map(p => p.forma).join(' + ')
    await onGuardar({ cliente_id: clienteId, itens, subtotal, desconto, total, forma_pagamento: formaResumo, pagamentos: pagamentosFinal, observacoes })
    setCarregando(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Cliente *</label>
        <SearchableSelect
          value={clienteId}
          onChange={setClienteId}
          placeholder="Selecionar cliente..."
          options={clientes.map(c => ({ value: c.id, label: c.nome }))}
        />
        {erros.cliente && <p className="text-xs text-red-600">{erros.cliente}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Serviços</h3>
          <Button variante="secundario" tamanho="sm" onClick={adicionarItem}>+ Adicionar item</Button>
        </div>

        <div className="space-y-3">
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
                  placeholder="Descrição do serviço"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {erros[`item_${index}`] && <p className="text-xs text-red-600 mt-0.5">{erros[`item_${index}`]}</p>}
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number" min="0.01" step="0.01"
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
                  type="number" min="0" step="0.01"
                  value={item.valor_unitario}
                  onChange={e => atualizarItem(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-4 sm:col-span-2 flex items-center justify-between gap-1">
                <span className="text-sm font-medium text-gray-900 flex-1 text-right py-2">{formatarMoeda(item.valor_total)}</span>
                {itens.length > 1 && (
                  <button onClick={() => removerItem(index)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
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

      <div className="border-t border-gray-100 pt-4">
        <div className="flex flex-col items-end gap-2 text-sm">
          <div className="flex items-center gap-6"><span className="text-gray-500">Subtotal</span><span className="font-medium w-32 text-right">{formatarMoeda(subtotal)}</span></div>
          <div className="flex items-center gap-6">
            <span className="text-gray-500">Desconto (R$)</span>
            <input
              type="number" min="0" step="0.01"
              value={desconto}
              onChange={e => setDesconto(parseFloat(e.target.value) || 0)}
              className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-6 text-base font-bold text-gray-900"><span>Total</span><span className="w-32 text-right">{formatarMoeda(total)}</span></div>
        </div>
      </div>

      <div>
        <FormaPagamentoSplit total={total} pagamentos={pagamentos} onChange={setPagamentos} />
        {erros.pagamento && <p className="text-xs text-red-600 mt-1">{erros.pagamento}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Observações</label>
        <textarea
          value={observacoes ?? ''}
          onChange={e => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>
          {inicial?.id ? 'Guardar alterações' : 'Criar ordem de serviço'}
        </Button>
      </div>
    </div>
  )
}
