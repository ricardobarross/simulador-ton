'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHead, TableBody, Th, Td, TableRow } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { LancamentoForm } from '@/components/financeiro/LancamentoForm'
import { ResumoFinanceiro } from '@/components/financeiro/ResumoFinanceiro'
import { FluxoCaixa } from '@/components/financeiro/FluxoCaixa'
import { FiadoForm } from '@/components/financeiro/FiadoForm'
import { PagamentoFiadoForm } from '@/components/financeiro/PagamentoFiadoForm'
import { FiadosList, saldoRestante } from '@/components/financeiro/FiadosList'
import { FiadoRelatorioPDF, imprimirRelatorioFiado } from '@/components/financeiro/FiadoRelatorioPDF'
import { Lancamento, FechamentoCaixa, Fiado } from '@/types'
import { formatarMoeda, statusLancamento } from '@/lib/utils'

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

export default function FinanceiroPage() {
  const { ehProprietario, perfil } = useAuth()
  const [aba, setAba] = useState<'lancamentos' | 'caixa' | 'fiados'>('lancamentos')
  const [dataFiltro, setDataFiltro] = useState(hoje())
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [fechamento, setFechamento] = useState<FechamentoCaixa | null>(null)
  const [fechamentoAnterior, setFechamentoAnterior] = useState<FechamentoCaixa | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Lancamento | undefined>()
  const [buscaLancamento, setBuscaLancamento] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [filtroStatusLanc, setFiltroStatusLanc] = useState<'todos' | 'pendente' | 'pago' | 'cancelado'>('todos')

  const [fiados, setFiados] = useState<Fiado[]>([])
  const [filtroFiado, setFiltroFiado] = useState<'abertos' | 'quitados' | 'todos'>('abertos')
  const [filtroClienteFiado, setFiltroClienteFiado] = useState('')
  const [carregandoFiados, setCarregandoFiados] = useState(true)
  const [modalFiadoAberto, setModalFiadoAberto] = useState(false)
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false)
  const [modalRelatorioFiado, setModalRelatorioFiado] = useState(false)
  const [fiadoSelecionado, setFiadoSelecionado] = useState<Fiado | null>(null)

  async function carregar() {
    setCarregando(true)
    const supabase = createClient()
    const [lancRes, fechRes, fechAntRes] = await Promise.all([
      supabase.from('lancamentos').select('*').eq('data', dataFiltro).order('created_at', { ascending: false }),
      supabase.from('fechamento_caixa').select('*').eq('data', dataFiltro).maybeSingle(),
      supabase.from('fechamento_caixa').select('*').lt('data', dataFiltro).order('data', { ascending: false }).limit(1).maybeSingle(),
    ])
    setLancamentos((lancRes.data ?? []) as Lancamento[])
    setFechamento((fechRes.data ?? null) as FechamentoCaixa | null)
    setFechamentoAnterior((fechAntRes.data ?? null) as FechamentoCaixa | null)
    setCarregando(false)
  }

  async function carregarFiados() {
    setCarregandoFiados(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('fiados')
      .select('*, cliente:clientes(id, nome, telefone), pagamentos:fiado_pagamentos(*)')
      .order('data', { ascending: false })
    setFiados((data ?? []) as Fiado[])
    setCarregandoFiados(false)
  }

  useEffect(() => { carregar() }, [dataFiltro])
  useEffect(() => { carregarFiados() }, [])

  function podeEditar(l: Lancamento) {
    return ehProprietario || (l.data === hoje() && !fechamento)
  }

  async function guardar(dados: Partial<Lancamento>) {
    const supabase = createClient()
    if (editando) {
      await supabase.from('lancamentos').update(dados).eq('id', editando.id)
    } else {
      await supabase.from('lancamentos').insert(dados)
    }
    setModalAberto(false)
    setEditando(undefined)
    await carregar()
  }

  async function excluir(l: Lancamento) {
    if (!confirm('Excluir este lançamento?')) return
    const supabase = createClient()
    await supabase.from('lancamentos').delete().eq('id', l.id)
    await carregar()
  }

  async function fecharCaixa(dados: { valor_abertura: number; valor_contado: number; observacoes: string }) {
    const supabase = createClient()
    // Só entram na conta do caixa físico os lançamentos já "pagos" — pendentes (ex.: fiado, OS ainda não concluída)
    // não são dinheiro que passou pela gaveta, por isso ficam de fora daqui.
    const totalEntradas = lancamentos.filter(l => l.tipo === 'entrada' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
    const totalSaidas = lancamentos.filter(l => l.tipo === 'saida' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
    const valorEsperado = dados.valor_abertura + totalEntradas - totalSaidas
    const payload = {
      data: dataFiltro,
      valor_abertura: dados.valor_abertura,
      total_entradas: totalEntradas,
      total_saidas: totalSaidas,
      valor_esperado: valorEsperado,
      valor_contado: dados.valor_contado,
      diferenca: dados.valor_contado - valorEsperado,
      observacoes: dados.observacoes || null,
    }
    if (fechamento) {
      await supabase.from('fechamento_caixa').update(payload).eq('id', fechamento.id)
    } else {
      await supabase.from('fechamento_caixa').insert(payload)
    }
    await carregar()
  }

  async function criarFiado(dados: { cliente_id: string; descricao: string; valor_total: number; data: string; observacoes: string | null }) {
    const supabase = createClient()
    await supabase.from('fiados').insert({ ...dados, created_by: perfil?.id ?? null })
    setModalFiadoAberto(false)
    await carregarFiados()
  }

  async function registrarPagamentoFiado(dados: { valor: number; data: string; forma_pagamento: string; observacoes: string | null }) {
    if (!fiadoSelecionado) return
    const supabase = createClient()

    // 1. Regista a entrada no caixa do dia
    const { data: lancamento, error: erroLancamento } = await supabase
      .from('lancamentos')
      .insert({
        tipo: 'entrada',
        categoria: 'Fiado recebido',
        descricao: `Pagamento de fiado — ${fiadoSelecionado.cliente?.nome ?? ''}`,
        valor: dados.valor,
        forma_pagamento: dados.forma_pagamento,
        data: dados.data,
        status: 'pago',
      })
      .select()
      .single()

    if (erroLancamento) {
      alert('Erro ao registar o pagamento: ' + erroLancamento.message)
      return
    }

    // 2. Regista o pagamento do fiado, ligado ao lançamento acima
    await supabase.from('fiado_pagamentos').insert({
      fiado_id: fiadoSelecionado.id,
      valor: dados.valor,
      data: dados.data,
      forma_pagamento: dados.forma_pagamento,
      observacoes: dados.observacoes,
      lancamento_id: lancamento?.id ?? null,
      created_by: perfil?.id ?? null,
    })

    setModalPagamentoAberto(false)
    setFiadoSelecionado(null)
    await Promise.all([carregarFiados(), carregar()])
  }

  async function excluirFiado(fiado: Fiado) {
    if (!confirm(`Excluir este fiado de ${fiado.cliente?.nome ?? 'cliente'}? Isto também remove os pagamentos registados para ele.`)) return
    const supabase = createClient()
    await supabase.from('fiados').delete().eq('id', fiado.id)
    await carregarFiados()
  }

  // Caixa físico: só o que já foi efetivamente pago/recebido. Pendentes (fiado, OS ainda não concluída
  // com pagamento a prazo) ficam separados para não obrigar ninguém a fazer conta na hora de fechar o caixa.
  const totalEntradas = lancamentos.filter(l => l.tipo === 'entrada' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
  const totalSaidas = lancamentos.filter(l => l.tipo === 'saida' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
  const totalPendente = lancamentos.filter(l => l.tipo === 'entrada' && l.status === 'pendente').reduce((s, l) => s + l.valor, 0)

  const fiadosFiltrados = fiados
    .filter(f => {
      if (filtroFiado === 'abertos') return f.status !== 'quitado'
      if (filtroFiado === 'quitados') return f.status === 'quitado'
      return true
    })
    .filter(f => !filtroClienteFiado || f.cliente_id === filtroClienteFiado)
  const totalAReceber = fiados.filter(f => f.status !== 'quitado').reduce((s, f) => s + saldoRestante(f), 0)
  const clientesDevendo = new Set(fiados.filter(f => f.status !== 'quitado').map(f => f.cliente_id)).size

  const clientesComFiado = Array.from(
    new Map(fiados.map(f => [f.cliente_id, f.cliente?.nome ?? '—'])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const clienteSelecionadoNome = filtroClienteFiado
    ? (clientesComFiado.find(([id]) => id === filtroClienteFiado)?.[1] ?? '')
    : 'Todos os clientes'

  const lancamentosFiltrados = lancamentos
    .filter(l => filtroTipo === 'todos' || l.tipo === filtroTipo)
    .filter(l => filtroStatusLanc === 'todos' || l.status === filtroStatusLanc)
    .filter(l =>
      l.descricao.toLowerCase().includes(buscaLancamento.toLowerCase()) ||
      (l.categoria ?? '').toLowerCase().includes(buscaLancamento.toLowerCase())
    )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Financeiro</CardTitle>
          <div className="flex items-center gap-2">
            {aba === 'lancamentos' && <Input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} className="w-auto" />}
            {aba === 'lancamentos' && (
              <Button variante="primario" onClick={() => { setEditando(undefined); setModalAberto(true) }}>
                + Novo lançamento
              </Button>
            )}
            {aba === 'fiados' && (
              <div className="flex items-center gap-2">
                <Button variante="secundario" onClick={() => setModalRelatorioFiado(true)}>
                  Gerar PDF
                </Button>
                <Button variante="primario" onClick={() => setModalFiadoAberto(true)}>
                  + Anotar fiado
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <div className="flex gap-2">
          <button onClick={() => setAba('lancamentos')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${aba === 'lancamentos' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Lançamentos
          </button>
          <button onClick={() => setAba('fiados')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${aba === 'fiados' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Fiados
          </button>
          <button onClick={() => setAba('caixa')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${aba === 'caixa' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Fechamento de caixa
          </button>
        </div>
      </Card>

      {aba === 'lancamentos' && (
        carregando ? (
          <LoadingSpinner />
        ) : (
          <>
            <ResumoFinanceiro entradas={totalEntradas} saidas={totalSaidas} pendente={totalPendente} />

            {fechamento && (
              <p className="text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
                O caixa deste dia já foi fechado. {ehProprietario ? 'Como proprietário, você ainda pode editar lançamentos.' : 'Só o proprietário pode editar ou excluir lançamentos deste dia.'}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Input placeholder="Buscar por descrição ou categoria..." value={buscaLancamento} onChange={e => setBuscaLancamento(e.target.value)} className="max-w-sm" />
              <div className="flex gap-2 flex-wrap">
                {(['todos', 'entrada', 'saida'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setFiltroTipo(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filtroTipo === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {t === 'todos' ? 'Todos' : t === 'entrada' ? 'Entradas' : 'Saídas'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {(['todos', 'pendente', 'pago', 'cancelado'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFiltroStatusLanc(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filtroStatusLanc === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {s === 'todos' ? 'Todos' : statusLancamento[s].label}
                  </button>
                ))}
              </div>
            </div>

            <Card padding={false}>
              {lancamentosFiltrados.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">Nenhum lançamento encontrado</p>
              ) : (
                <Table>
                  <TableHead>
                    <tr>
                      <Th>Descrição</Th>
                      <Th>Categoria</Th>
                      <Th>Forma</Th>
                      <Th>Estado</Th>
                      <Th className="text-right">Valor</Th>
                      <Th className="text-right">Ações</Th>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {lancamentosFiltrados.map(l => (
                      <TableRow key={l.id}>
                        <Td className="font-medium text-gray-900">{l.descricao}</Td>
                        <Td>{l.categoria ?? '—'}</Td>
                        <Td>{l.forma_pagamento ?? '—'}</Td>
                        <Td><Badge cor={statusLancamento[l.status].cor as 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red'}>{statusLancamento[l.status].label}</Badge></Td>
                        <Td className={`text-right font-semibold ${l.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                          {l.tipo === 'entrada' ? '+ ' : '- '}{formatarMoeda(l.valor)}
                        </Td>
                        <Td className="text-right">
                          {podeEditar(l) ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button variante="ghost" tamanho="sm" onClick={() => { setEditando(l); setModalAberto(true) }}>Editar</Button>
                              <Button variante="perigo" tamanho="sm" onClick={() => excluir(l)}>Excluir</Button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">bloqueado</span>
                          )}
                        </Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </>
        )
      )}

      {aba === 'fiados' && (
        carregandoFiados ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <p className="text-sm text-gray-500">Total a receber</p>
                <p className="text-2xl font-bold text-red-500 mt-1">{formatarMoeda(totalAReceber)}</p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Clientes devendo</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{clientesDevendo}</p>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex gap-2">
                <button onClick={() => setFiltroFiado('abertos')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtroFiado === 'abertos' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>Em aberto</button>
                <button onClick={() => setFiltroFiado('quitados')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtroFiado === 'quitados' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>Quitados</button>
                <button onClick={() => setFiltroFiado('todos')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtroFiado === 'todos' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>Todos</button>
              </div>
              <SearchableSelect
                value={filtroClienteFiado}
                onChange={setFiltroClienteFiado}
                placeholder="Todos os clientes"
                className="w-56"
                options={[{ value: '', label: 'Todos os clientes' }, ...clientesComFiado.map(([id, nome]) => ({ value: id, label: nome }))]}
              />
            </div>

            <Card padding={false}>
              <FiadosList
                fiados={fiadosFiltrados}
                ehProprietario={ehProprietario}
                onRegistrarPagamento={(f) => { setFiadoSelecionado(f); setModalPagamentoAberto(true) }}
                onExcluir={excluirFiado}
              />
            </Card>
          </>
        )
      )}

      {aba === 'caixa' && (
        <FluxoCaixa
          data={dataFiltro}
          fechamento={fechamento}
          totalEntradas={totalEntradas}
          totalSaidas={totalSaidas}
          totalPendente={totalPendente}
          valorAberturaSugerido={fechamentoAnterior?.valor_contado ?? 0}
          ehProprietario={ehProprietario}
          onFechar={fecharCaixa}
        />
      )}

      <Modal
        aberto={modalAberto}
        onFechar={() => { setModalAberto(false); setEditando(undefined) }}
        titulo={editando ? 'Editar lançamento' : 'Novo lançamento'}
      >
        <LancamentoForm inicial={editando} onGuardar={guardar} onCancelar={() => { setModalAberto(false); setEditando(undefined) }} />
      </Modal>

      <Modal
        aberto={modalFiadoAberto}
        onFechar={() => setModalFiadoAberto(false)}
        titulo="Anotar fiado"
      >
        <FiadoForm onGuardar={criarFiado} onCancelar={() => setModalFiadoAberto(false)} />
      </Modal>

      <Modal
        aberto={modalPagamentoAberto}
        onFechar={() => { setModalPagamentoAberto(false); setFiadoSelecionado(null) }}
        titulo="Receber pagamento de fiado"
      >
        {fiadoSelecionado && (
          <PagamentoFiadoForm
            fiado={fiadoSelecionado}
            saldoRestante={saldoRestante(fiadoSelecionado)}
            onGuardar={registrarPagamentoFiado}
            onCancelar={() => { setModalPagamentoAberto(false); setFiadoSelecionado(null) }}
          />
        )}
      </Modal>

      <Modal
        aberto={modalRelatorioFiado}
        onFechar={() => setModalRelatorioFiado(false)}
        titulo="Relatório de fiado"
        largura="xl"
      >
        <div className="flex justify-end mb-4">
          <Button variante="primario" onClick={imprimirRelatorioFiado}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir / Guardar PDF
          </Button>
        </div>
        <FiadoRelatorioPDF
          titulo={clienteSelecionadoNome}
          subtitulo={filtroClienteFiado ? 'Cliente' : 'Relatório de'}
          fiados={fiadosFiltrados}
        />
      </Modal>
    </div>
  )
}
