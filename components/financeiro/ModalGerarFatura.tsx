'use client'

import { useEffect, useState } from 'react'
import { Cliente, Fiado } from '@/types'
import { createClient } from '@/lib/supabase'
import { criarFaturaConsolidada, FaturaCriada } from '@/lib/faturas'
import { saldoRestante } from '@/components/financeiro/FiadosList'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatarMoeda, formatarData } from '@/lib/utils'

interface ModalGerarFaturaProps {
  aberto: boolean
  clienteIdInicial?: string
  onFechar: () => void
  onGerada: (fatura: FaturaCriada) => void
  onErro: (mensagem: string) => void
}

export function ModalGerarFatura({ aberto, clienteIdInicial, onFechar, onGerada, onErro }: ModalGerarFaturaProps) {
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nome'>[]>([])
  const [clienteId, setClienteId] = useState(clienteIdInicial ?? '')
  const [fiados, setFiados] = useState<Fiado[]>([])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [observacoes, setObservacoes] = useState('')
  const [carregandoFiados, setCarregandoFiados] = useState(false)
  const [gerando, setGerando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setClienteId(clienteIdInicial ?? '')
    setSelecionados(new Set())
    setObservacoes('')
    const supabase = createClient()
    supabase.from('clientes').select('id, nome').eq('ativo', true).is('deleted_at', null).order('nome').then(({ data }) => {
      setClientes(data ?? [])
    })
  }, [aberto, clienteIdInicial])

  useEffect(() => {
    if (!clienteId) { setFiados([]); return }
    setCarregandoFiados(true)
    const supabase = createClient()
    supabase
      .from('fiados')
      // ordem_servico(numero, itens) pra mostrar o nome real de cada serviço na
      // hora de escolher o que entra na fatura — não só a descrição genérica.
      .select('*, pagamentos:fiado_pagamentos(*), ordem_servico:ordens_servico(numero, itens)')
      .eq('cliente_id', clienteId)
      .neq('status', 'quitado')
      .is('deleted_at', null)
      .order('data', { ascending: false })
      .then(({ data }) => {
        setFiados((data ?? []) as Fiado[])
        setSelecionados(new Set())
        setCarregandoFiados(false)
      })
  }, [clienteId])

  function alternar(id: string) {
    setSelecionados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  const total = fiados.filter(f => selecionados.has(f.id)).reduce((s, f) => s + saldoRestante(f), 0)

  async function gerar() {
    if (selecionados.size === 0) return
    setGerando(true)
    const supabase = createClient()
    const resultado = await criarFaturaConsolidada(supabase, clienteId, Array.from(selecionados), observacoes.trim() || null)
    setGerando(false)
    if (!resultado.ok) {
      onErro(resultado.erro)
      return
    }
    onGerada(resultado.data)
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Gerar fatura consolidada" largura="lg">
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Cliente *</label>
          <SearchableSelect
            value={clienteId}
            onChange={setClienteId}
            placeholder="Selecionar cliente..."
            options={clientes.map(c => ({ value: c.id, label: c.nome }))}
          />
        </div>

        {clienteId && (
          carregandoFiados ? (
            <LoadingSpinner texto="A carregar fiados..." />
          ) : fiados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Este cliente não tem fiados em aberto.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {fiados.map(f => {
                const saldo = saldoRestante(f)
                const itensOS = f.ordem_servico?.itens ?? []
                return (
                  <label key={f.id} className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selecionados.has(f.id)}
                      onChange={() => alternar(f.id)}
                      className="rounded border-gray-300 text-blue-600 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {f.ordem_servico ? f.ordem_servico.numero : f.descricao}
                      </p>
                      {/* Nome real de cada serviço da O.S. — ajuda a decidir o
                          que entra nesta fatura sem precisar abrir a O.S. */}
                      {itensOS.length > 0 && (
                        <p className="text-xs text-gray-500 truncate">
                          {itensOS.map(i => i.descricao).join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">{formatarData(f.data)}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{formatarMoeda(saldo)}</span>
                  </label>
                )
              })}
            </div>
          )
        )}

        {selecionados.size > 0 && (
          <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
            <span className="text-sm text-blue-700">{selecionados.size} {selecionados.size === 1 ? 'fiado selecionado' : 'fiados selecionados'}</span>
            <span className="text-base font-bold text-blue-900">{formatarMoeda(total)}</span>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Observações (opcional)</label>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variante="secundario" onClick={onFechar} disabled={gerando}>Cancelar</Button>
          <Button variante="primario" carregando={gerando} disabled={selecionados.size === 0} onClick={gerar}>
            Gerar fatura consolidada
          </Button>
        </div>
      </div>
    </Modal>
  )
}
