'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Orcamento, PagamentoOS } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { OrcamentoCard } from '@/components/orcamentos/OrcamentoCard'
import { OrcamentoForm } from '@/components/orcamentos/OrcamentoForm'
import { OrcamentoPDF, imprimirOrcamento } from '@/components/orcamentos/OrcamentoPDF'
import { FormaPagamentoSplit } from '@/components/financeiro/FormaPagamentoSplit'
import { lancarOrdemNoFinanceiro } from '@/lib/financeiro'
import { formatarMoeda } from '@/lib/utils'

export default function OrcamentosPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <OrcamentosPageInner />
    </Suspense>
  )
}

function OrcamentosPageInner() {
  const searchParams = useSearchParams()
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalForm, setModalForm] = useState(false)
  const [modalPDF, setModalPDF] = useState(false)
  const [editando, setEditando] = useState<Orcamento | null>(null)
  const [pdfAtual, setPdfAtual] = useState<Orcamento | null>(null)
  const [filtroStatus, setFiltroStatus] = useState(searchParams.get('status') ?? 'todos')

  const [modalConverter, setModalConverter] = useState(false)
  const [orcamentoConvertendo, setOrcamentoConvertendo] = useState<Orcamento | null>(null)
  const [pagamentosConversao, setPagamentosConversao] = useState<PagamentoOS[]>([{ forma: 'Dinheiro', valor: 0 }])
  const [erroConversao, setErroConversao] = useState('')
  const [convertendo, setConvertendo] = useState(false)

  async function carregar() {
    const supabase = createClient()
    const { data } = await supabase
      .from('orcamentos')
      .select('*, cliente:clientes(id, nome, telefone)')
      .order('created_at', { ascending: false })
    setOrcamentos((data as Orcamento[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function handleGuardar(dados: Partial<Orcamento>) {
    const supabase = createClient()
    if (editando?.id) {
      await supabase.from('orcamentos').update(dados).eq('id', editando.id)
    } else {
      // "numero" é gerado automaticamente pelo banco (ORC-0001, ORC-0002...)
      await supabase.from('orcamentos').insert(dados)
    }
    setModalForm(false)
    setEditando(null)
    await carregar()
  }

  async function handleExcluir(id: string) {
    if (!confirm('Excluir este orçamento?')) return
    const supabase = createClient()
    await supabase.from('orcamentos').delete().eq('id', id)
    await carregar()
  }

  function abrirConversao(orcamento: Orcamento) {
    setOrcamentoConvertendo(orcamento)
    setPagamentosConversao([{ forma: 'Dinheiro', valor: orcamento.total }])
    setErroConversao('')
    setModalConverter(true)
  }

  async function confirmarConversao() {
    if (!orcamentoConvertendo) return
    const orcamento = orcamentoConvertendo

    const pagamentosFinal = pagamentosConversao.length > 1
      ? pagamentosConversao
      : [{ forma: pagamentosConversao[0].forma, valor: orcamento.total }]

    if (pagamentosConversao.length > 1) {
      const soma = pagamentosConversao.reduce((s, p) => s + (Number(p.valor) || 0), 0)
      if (Math.round((soma - orcamento.total) * 100) !== 0) {
        setErroConversao('A soma das formas de pagamento precisa bater com o total do orçamento.')
        return
      }
    }
    setErroConversao('')

    const formaResumo = pagamentosFinal.map(p => p.forma).join(' + ')
    setConvertendo(true)
    const supabase = createClient()
    // "numero" é gerado automaticamente pelo banco (OS-0001, OS-0002...)
    const { data: novaOS } = await supabase
      .from('ordens_servico')
      .insert({
        cliente_id:      orcamento.cliente_id,
        orcamento_id:    orcamento.id,
        status:          'aberta',
        itens:           orcamento.itens,
        subtotal:        orcamento.subtotal,
        desconto:        orcamento.desconto,
        total:           orcamento.total,
        forma_pagamento: formaResumo,
        pagamentos:      pagamentosFinal,
      })
      .select('*, cliente:clientes(nome)')
      .single()

    if (novaOS) {
      await lancarOrdemNoFinanceiro(supabase, {
        id: novaOS.id,
        numero: novaOS.numero,
        total: novaOS.total,
        forma_pagamento: novaOS.forma_pagamento,
        pagamentos: novaOS.pagamentos,
        cliente_id: novaOS.cliente_id,
        cliente_nome: novaOS.cliente?.nome,
      })
    }

    await supabase.from('orcamentos').update({ status: 'aprovado' }).eq('id', orcamento.id)
    setConvertendo(false)
    setModalConverter(false)
    setOrcamentoConvertendo(null)
    await carregar()
    alert('Ordem de Serviço criada e lançada no Financeiro com sucesso!')
  }

  function abrirPDF(orcamento: Orcamento) {
    setPdfAtual(orcamento)
    setModalPDF(true)
  }

  function abrirEditar(orcamento: Orcamento) {
    setEditando(orcamento)
    setModalForm(true)
  }

  function abrirNovo() {
    setEditando(null)
    setModalForm(true)
  }

  const filtrados = filtroStatus === 'todos'
    ? orcamentos
    : orcamentos.filter(o => o.status === filtroStatus)

  const statusOpcoes = ['todos', 'rascunho', 'enviado', 'aprovado', 'recusado', 'expirado']

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Orçamentos</h2>
          <p className="text-sm text-gray-500">{orcamentos.length} orçamentos</p>
        </div>
        <Button variante="primario" onClick={abrirNovo}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo orçamento
        </Button>
      </div>

      {/* Filtros por status */}
      <div className="flex gap-2 flex-wrap">
        {statusOpcoes.map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              filtroStatus === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'todos' ? 'Todos' : s}
          </button>
        ))}
      </div>

      {/* Lista */}
      {carregando ? (
        <LoadingSpinner />
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Nenhum orçamento encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtrados.map(o => (
            <OrcamentoCard
              key={o.id}
              orcamento={o}
              onEditar={() => abrirEditar(o)}
              onExcluir={() => handleExcluir(o.id)}
              onPDF={() => abrirPDF(o)}
              onConverterOS={() => abrirConversao(o)}
            />
          ))}
        </div>
      )}

      {/* Modal formulário */}
      <Modal
        aberto={modalForm}
        onFechar={() => { setModalForm(false); setEditando(null) }}
        titulo={editando ? 'Editar orçamento' : 'Novo orçamento'}
        largura="xl"
      >
        <OrcamentoForm
          inicial={editando ?? undefined}
          onGuardar={handleGuardar}
          onCancelar={() => { setModalForm(false); setEditando(null) }}
        />
      </Modal>

      {/* Modal PDF */}
      <Modal
        aberto={modalPDF}
        onFechar={() => { setModalPDF(false); setPdfAtual(null) }}
        titulo="Pré-visualização do orçamento"
        largura="xl"
      >
        {pdfAtual && (
          <div>
            <div className="flex justify-end mb-4">
              <Button variante="primario" onClick={imprimirOrcamento}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir / Guardar PDF
              </Button>
            </div>
            <OrcamentoPDF orcamento={pdfAtual} />
          </div>
        )}
      </Modal>

      {/* Modal conversão em O.S. */}
      <Modal
        aberto={modalConverter}
        onFechar={() => { setModalConverter(false); setOrcamentoConvertendo(null) }}
        titulo="Converter em Ordem de Serviço"
      >
        {orcamentoConvertendo && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p className="text-gray-500">Cliente: <span className="font-medium text-gray-900">{orcamentoConvertendo.cliente?.nome}</span></p>
              <p className="text-gray-500">Total: <span className="font-semibold text-gray-900">{formatarMoeda(orcamentoConvertendo.total)}</span></p>
            </div>

            <FormaPagamentoSplit
              total={orcamentoConvertendo.total}
              pagamentos={pagamentosConversao}
              onChange={setPagamentosConversao}
            />
            {erroConversao && <p className="text-xs text-red-600">{erroConversao}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <Button variante="secundario" onClick={() => { setModalConverter(false); setOrcamentoConvertendo(null) }} disabled={convertendo}>Cancelar</Button>
              <Button variante="primario" carregando={convertendo} onClick={confirmarConversao}>Converter em O.S.</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}