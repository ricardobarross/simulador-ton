'use client'

import Link from 'next/link'
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
import { executarOperacao } from '@/lib/api-helpers'
import { useToast } from '@/lib/toast-context'
import { LancamentoForm } from '@/components/financeiro/LancamentoForm'
import { ResumoFinanceiro } from '@/components/financeiro/ResumoFinanceiro'
import { FluxoCaixa } from '@/components/financeiro/FluxoCaixa'
import { FiadoForm } from '@/components/financeiro/FiadoForm'
import { PagamentoFiadoForm } from '@/components/financeiro/PagamentoFiadoForm'
import { FiadosList, saldoRestante } from '@/components/financeiro/FiadosList'
import { ReguaCobranca } from '@/components/financeiro/ReguaCobranca'
import { FiadoRelatorioPDF, imprimirRelatorioFiado } from '@/components/financeiro/FiadoRelatorioPDF'
import { FaturasList } from '@/components/financeiro/FaturasList'
import { ModalGerarFatura } from '@/components/financeiro/ModalGerarFatura'
import { ModalBaixaFatura } from '@/components/financeiro/ModalBaixaFatura'
import { FaturaPDF, imprimirFatura } from '@/components/financeiro/FaturaPDF'
import { ChequesList } from '@/components/financeiro/ChequesList'
import { DevolverChequeForm } from '@/components/financeiro/DevolverChequeForm'
import { Lancamento, FechamentoCaixa, Fiado, ResumoFechamentoDia, Fatura, Cheque } from '@/types'
import { formatarMoeda, statusLancamento } from '@/lib/utils'
import { abrirWhatsapp, mensagemReciboFiado, mensagemFatura } from '@/lib/whatsapp'
import { carregarFatura, darBaixaFatura, cancelarFatura as cancelarFaturaLib, FaturaCriada } from '@/lib/faturas'
import { carregarDadosPix, DadosPix } from '@/lib/configuracoes'
import { confirmarCheque } from '@/lib/cheques'

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

// O Postgres devolve `numeric` como string via RPC — convertemos pra number aqui.
function paraResumoFechamento(d: Record<string, unknown>): ResumoFechamentoDia {
  return {
    total_dinheiro: Number(d.total_dinheiro),
    total_pix: Number(d.total_pix),
    total_cartao: Number(d.total_cartao),
    total_outros: Number(d.total_outros),
    total_saidas: Number(d.total_saidas),
    total_abates_fiado: Number(d.total_abates_fiado),
    total_fiado_novo: Number(d.total_fiado_novo),
  }
}

export default function FinanceiroPage() {
  const { ehProprietario, perfil } = useAuth()
  const { mostrarErro, mostrarSucesso } = useToast()
  const [aba, setAba] = useState<'lancamentos' | 'caixa' | 'fiados' | 'faturas' | 'cheques'>('lancamentos')
  const [dataFiltro, setDataFiltro] = useState(hoje())
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [fechamento, setFechamento] = useState<FechamentoCaixa | null>(null)
  const [fechamentoAnterior, setFechamentoAnterior] = useState<FechamentoCaixa | null>(null)
  const [resumoDia, setResumoDia] = useState<ResumoFechamentoDia | null>(null)
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
  const [reciboPagamento, setReciboPagamento] = useState<{ fiado: Fiado; valorPago: number; saldoApos: number } | null>(null)

  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [carregandoFaturas, setCarregandoFaturas] = useState(true)
  const [filtroStatusFatura, setFiltroStatusFatura] = useState<'pendente' | 'paga' | 'cancelada' | 'todos'>('pendente')
  const [modalGerarFatura, setModalGerarFatura] = useState(false)
  const [faturaBaixa, setFaturaBaixa] = useState<Fatura | null>(null)
  const [faturaPDF, setFaturaPDF] = useState<Fatura | null>(null)
  const [pixOficina, setPixOficina] = useState<DadosPix>({ chave: null, titular: null, dadosBancarios: null })

  const [cheques, setCheques] = useState<Cheque[]>([])
  const [carregandoCheques, setCarregandoCheques] = useState(true)
  const [filtroStatusCheque, setFiltroStatusCheque] = useState<'aguardando' | 'compensado' | 'devolvido' | 'todos'>('aguardando')
  const [chequeDevolvendo, setChequeDevolvendo] = useState<Cheque | null>(null)

  const [saldoBanco, setSaldoBanco] = useState(0)

  async function carregar() {
    setCarregando(true)
    const supabase = createClient()
    const [lancRes, fechRes, fechAntRes, resumoRes] = await Promise.all([
      executarOperacao(() => supabase.from('lancamentos').select('*').eq('data', dataFiltro).is('deleted_at', null).order('created_at', { ascending: false })),
      executarOperacao(() => supabase.from('fechamento_caixa').select('*').eq('data', dataFiltro).maybeSingle()),
      executarOperacao(() => supabase.from('fechamento_caixa').select('*').lt('data', dataFiltro).order('data', { ascending: false }).limit(1).maybeSingle()),
      executarOperacao(() => supabase.rpc('resumo_fechamento_dia', { p_data: dataFiltro }).single()),
    ])
    if (!lancRes.ok) mostrarErro(`Não foi possível carregar os lançamentos: ${lancRes.erro}`)
    if (!fechRes.ok) mostrarErro(`Não foi possível carregar o fechamento de caixa: ${fechRes.erro}`)
    if (!resumoRes.ok) mostrarErro(`Não foi possível calcular o detalhamento do dia: ${resumoRes.erro}`)
    setLancamentos((lancRes.data ?? []) as Lancamento[])
    setFechamento((fechRes.data ?? null) as FechamentoCaixa | null)
    setFechamentoAnterior((fechAntRes.data ?? null) as FechamentoCaixa | null)
    setResumoDia(resumoRes.ok ? paraResumoFechamento(resumoRes.data as Record<string, unknown>) : null)
    setCarregando(false)
  }

  async function carregarFiados() {
    setCarregandoFiados(true)
    const supabase = createClient()
    const resultado = await executarOperacao(() =>
      supabase
        .from('fiados')
        .select('*, cliente:clientes(id, nome, telefone), pagamentos:fiado_pagamentos(*)')
        .is('deleted_at', null)
        .order('data', { ascending: false })
    )
    if (!resultado.ok) {
      mostrarErro(`Não foi possível carregar os fiados: ${resultado.erro}`)
      setCarregandoFiados(false)
      return
    }
    setFiados((resultado.data ?? []) as Fiado[])
    setCarregandoFiados(false)
  }

  async function carregarFaturas() {
    setCarregandoFaturas(true)
    const supabase = createClient()
    const resultado = await executarOperacao(() =>
      supabase.from('faturas').select('*, cliente:clientes(id, nome, telefone)').is('deleted_at', null).order('created_at', { ascending: false })
    )
    if (!resultado.ok) {
      mostrarErro(`Não foi possível carregar as faturas: ${resultado.erro}`)
      setCarregandoFaturas(false)
      return
    }
    setFaturas((resultado.data ?? []) as Fatura[])
    setCarregandoFaturas(false)
  }

  async function carregarCheques() {
    setCarregandoCheques(true)
    const supabase = createClient()
    const resultado = await executarOperacao(() =>
      supabase.from('cheques').select('*, cliente:clientes(id, nome, telefone)').is('deleted_at', null).order('data_recebimento', { ascending: false })
    )
    if (!resultado.ok) {
      // Funcionário não vê cheques (RLS) — não é um erro real, só não mostramos a aba pra ele.
      setCarregandoCheques(false)
      return
    }
    setCheques((resultado.data ?? []) as Cheque[])
    setCarregandoCheques(false)
  }

  async function carregarSaldoBanco() {
    const supabase = createClient()
    // Saldo acumulado (todo o histórico, não só o dia filtrado) do que foi pago via
    // Pix/cartão/transferência — é o "dinheiro" que está no banco, não na gaveta.
    const resultado = await executarOperacao(() =>
      supabase.from('lancamentos').select('tipo, valor').eq('status', 'pago').eq('destino', 'banco').is('deleted_at', null)
    )
    if (!resultado.ok) return
    const linhas = resultado.data as { tipo: 'entrada' | 'saida'; valor: number }[]
    setSaldoBanco(linhas.reduce((s, l) => s + (l.tipo === 'entrada' ? l.valor : -l.valor), 0))
  }

  useEffect(() => { carregar() }, [dataFiltro]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { carregarFiados() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { carregarFaturas(); carregarDadosPix(createClient()).then(setPixOficina) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ehProprietario) { carregarCheques(); carregarSaldoBanco() } }, [ehProprietario]) // eslint-disable-line react-hooks/exhaustive-deps

  function podeEditar(l: Lancamento) {
    return ehProprietario || (l.data === hoje() && !fechamento)
  }

  async function guardar(dados: Partial<Lancamento>) {
    const supabase = createClient()
    const resultado = editando
      ? await executarOperacao(() => supabase.from('lancamentos').update(dados).eq('id', editando.id).select().single())
      : await executarOperacao(() => supabase.from('lancamentos').insert(dados).select().single())

    if (!resultado.ok) {
      mostrarErro(`Não foi possível guardar o lançamento: ${resultado.erro}`)
      return // modal continua aberto — nada foi salvo
    }
    mostrarSucesso(editando ? 'Lançamento atualizado.' : 'Lançamento registado.')
    setModalAberto(false)
    setEditando(undefined)
    await carregar()
    if (ehProprietario) await carregarSaldoBanco()
  }

  async function excluir(l: Lancamento) {
    if (!confirm('Excluir este lançamento?')) return
    const supabase = createClient()
    // Soft delete: o banco recusa DELETE físico. Também bloqueia se este lançamento
    // for a contrapartida de caixa de um pagamento de fiado já registrado.
    const resultado = await executarOperacao(() =>
      supabase.from('lancamentos').update({ deleted_at: new Date().toISOString() }).eq('id', l.id).select().single()
    )
    if (!resultado.ok) {
      mostrarErro(`Não foi possível excluir: ${resultado.erro}`)
      return
    }
    mostrarSucesso('Lançamento excluído.')
    await carregar()
    if (ehProprietario) await carregarSaldoBanco()
  }

  async function fecharCaixa(dados: { valor_abertura: number; valor_contado: number; observacoes: string }) {
    const supabase = createClient()
    // "Esperado" é uma conferência do DINHEIRO FÍSICO na gaveta — só entram aqui os
    // lançamentos pagos com destino='caixa' (Dinheiro). Pix/cartão/transferência vão
    // pro banco, não pela gaveta, então não podem entrar nessa conta (esse era o bug:
    // somava tudo, o que nunca batia com o dinheiro contado de verdade).
    const totalEntradasCaixa = lancamentos.filter(l => l.tipo === 'entrada' && l.status === 'pago' && l.destino === 'caixa').reduce((s, l) => s + l.valor, 0)
    const totalSaidasCaixa = lancamentos.filter(l => l.tipo === 'saida' && l.status === 'pago' && l.destino === 'caixa').reduce((s, l) => s + l.valor, 0)
    const valorEsperado = dados.valor_abertura + totalEntradasCaixa - totalSaidasCaixa
    const payload = {
      data: dataFiltro,
      valor_abertura: dados.valor_abertura,
      total_entradas: totalEntradasCaixa,
      total_saidas: totalSaidasCaixa,
      valor_esperado: valorEsperado,
      valor_contado: dados.valor_contado,
      diferenca: dados.valor_contado - valorEsperado,
      observacoes: dados.observacoes || null,
      // Detalhamento do dia (dinheiro/pix/cartão, abates de fiado antigo, fiado novo)
      // calculado pela function resumo_fechamento_dia — persistimos junto pra manter
      // o histórico consultável mesmo que os lançamentos mudem depois.
      total_dinheiro: resumoDia?.total_dinheiro ?? 0,
      total_pix: resumoDia?.total_pix ?? 0,
      total_cartao: resumoDia?.total_cartao ?? 0,
      total_outros: resumoDia?.total_outros ?? 0,
      total_abates_fiado: resumoDia?.total_abates_fiado ?? 0,
      total_fiado_novo: resumoDia?.total_fiado_novo ?? 0,
    }
    const resultado = fechamento
      ? await executarOperacao(() => supabase.from('fechamento_caixa').update(payload).eq('id', fechamento.id).select().single())
      : await executarOperacao(() => supabase.from('fechamento_caixa').insert(payload).select().single())

    if (!resultado.ok) {
      mostrarErro(`Não foi possível fechar o caixa: ${resultado.erro}`)
      return
    }
    mostrarSucesso('Caixa fechado.')
    await carregar()
  }

  async function criarFiado(dados: { cliente_id: string; descricao: string; valor_total: number; data: string; data_vencimento: string | null; observacoes: string | null }) {
    const supabase = createClient()
    const resultado = await executarOperacao(() =>
      supabase.from('fiados').insert({ ...dados, created_by: perfil?.id ?? null }).select().single()
    )
    if (!resultado.ok) {
      mostrarErro(`Não foi possível anotar o fiado: ${resultado.erro}`)
      return // modal continua aberto — nada foi salvo
    }
    mostrarSucesso('Fiado anotado.')
    setModalFiadoAberto(false)
    await carregarFiados()
  }

  async function registrarPagamentoFiado(dados: { valor: number; data: string; forma_pagamento: string; observacoes: string | null }) {
    if (!fiadoSelecionado) return
    const supabase = createClient()

    // Uma única chamada RPC: dentro do banco, o lançamento de caixa e a baixa no
    // fiado são gravados na MESMA transação (registrar_pagamento_fiado_atomico).
    // Se qualquer parte falhar, o Postgres desfaz tudo sozinho — nunca fica
    // dinheiro "recebido" no caixa sem a dívida correspondente ser abatida.
    const resultado = await executarOperacao(() =>
      supabase
        .rpc('registrar_pagamento_fiado_atomico', {
          p_fiado_id: fiadoSelecionado.id,
          p_valor: dados.valor,
          p_forma_pagamento: dados.forma_pagamento,
          p_data: dados.data,
          p_observacoes: dados.observacoes,
        })
        .single()
    )

    if (!resultado.ok) {
      mostrarErro(`Não foi possível registrar o pagamento: ${resultado.erro}`)
      return // modal continua aberto, nada foi salvo (a function reverteu tudo sozinha)
    }

    mostrarSucesso('Pagamento registrado no caixa e abatido do fiado.')
    setReciboPagamento({
      fiado: fiadoSelecionado,
      valorPago: dados.valor,
      saldoApos: Math.max(0, saldoRestante(fiadoSelecionado) - dados.valor),
    })
    setModalPagamentoAberto(false)
    setFiadoSelecionado(null)
    await Promise.all([carregarFiados(), carregar(), ehProprietario ? carregarSaldoBanco() : Promise.resolve()])
  }

  async function excluirFiado(fiado: Fiado) {
    if (!confirm(`Excluir este fiado de ${fiado.cliente?.nome ?? 'cliente'}?`)) return
    const supabase = createClient()
    // Soft delete: o banco bloqueia esta exclusão se o fiado já tiver pagamento
    // registrado (histórico financeiro ativo) — nesse caso a mensagem de erro
    // do próprio Postgres explica o motivo.
    const resultado = await executarOperacao(() =>
      supabase.from('fiados').update({ deleted_at: new Date().toISOString() }).eq('id', fiado.id).select().single()
    )
    if (!resultado.ok) {
      mostrarErro(`Não foi possível excluir: ${resultado.erro}`)
      return
    }
    mostrarSucesso('Fiado excluído.')
    await carregarFiados()
  }

  function onFaturaGerada(fatura: FaturaCriada) {
    mostrarSucesso(`Fatura ${fatura.numero_fatura} gerada — ${formatarMoeda(fatura.valor_total)}.`)
    setModalGerarFatura(false)
    carregarFaturas()
    carregarFiados() // os fiados consolidados somem da lista de "juntar" numa próxima fatura
  }

  async function verFaturaPDF(fatura: Fatura) {
    const supabase = createClient()
    const resultado = await carregarFatura(supabase, fatura.id)
    if (!resultado.ok) {
      mostrarErro(`Não foi possível carregar a fatura: ${resultado.erro}`)
      return
    }
    setFaturaPDF(resultado.data)
  }

  async function enviarFaturaWhatsapp(fatura: Fatura) {
    const supabase = createClient()
    const resultado = await carregarFatura(supabase, fatura.id)
    if (!resultado.ok) {
      mostrarErro(`Não foi possível carregar a fatura: ${resultado.erro}`)
      return
    }
    const enviado = abrirWhatsapp(resultado.data.cliente?.telefone, mensagemFatura(resultado.data))
    if (!enviado) mostrarErro('Este cliente não tem telefone cadastrado.')
  }

  async function confirmarBaixaFatura(formaPagamento: string) {
    if (!faturaBaixa) return
    const supabase = createClient()
    const resultado = await darBaixaFatura(supabase, faturaBaixa.id, formaPagamento, faturaBaixa.valor_total)
    if (!resultado.ok) {
      mostrarErro(`Não foi possível dar baixa na fatura: ${resultado.erro}`)
      return
    }
    mostrarSucesso(`Fatura ${faturaBaixa.numero_fatura} paga — caixa e fiados atualizados.`)
    setFaturaBaixa(null)
    await Promise.all([carregarFaturas(), carregarFiados(), carregar(), ehProprietario ? carregarSaldoBanco() : Promise.resolve()])
  }

  async function cancelarFaturaHandler(fatura: Fatura) {
    if (!confirm(`Cancelar a fatura ${fatura.numero_fatura}? Os fiados voltam a poder ser consolidados em outra fatura.`)) return
    const supabase = createClient()
    const resultado = await cancelarFaturaLib(supabase, fatura.id)
    if (!resultado.ok) {
      mostrarErro(`Não foi possível cancelar a fatura: ${resultado.erro}`)
      return
    }
    mostrarSucesso('Fatura cancelada.')
    await carregarFaturas()
  }

  async function compensarChequeHandler(cheque: Cheque) {
    const supabase = createClient()
    const resultado = await confirmarCheque(supabase, cheque.id, 'compensado', { usuarioId: perfil?.id ?? null })
    if (!resultado.ok) {
      mostrarErro(`Não foi possível confirmar o cheque: ${resultado.erro}`)
      return
    }
    mostrarSucesso(`Cheque nº ${cheque.numero_cheque} compensado — entrada registada no Financeiro.`)
    await Promise.all([carregarCheques(), carregar(), carregarSaldoBanco()])
  }

  async function devolverChequeHandler(motivo: string) {
    if (!chequeDevolvendo) return
    const supabase = createClient()
    const resultado = await confirmarCheque(supabase, chequeDevolvendo.id, 'devolvido', { motivoDevolucao: motivo, usuarioId: perfil?.id ?? null })
    if (!resultado.ok) {
      mostrarErro(`Não foi possível registar a devolução: ${resultado.erro}`)
      return
    }
    mostrarSucesso(`Cheque nº ${chequeDevolvendo.numero_cheque} devolvido — dívida lançada em fiado.`)
    setChequeDevolvendo(null)
    await Promise.all([carregarCheques(), carregarFiados()])
  }

  const chequesFiltrados = filtroStatusCheque === 'todos' ? cheques : cheques.filter(c => c.status === filtroStatusCheque)

  // Visão geral do dia (Lançamentos): soma TODAS as formas de pagamento — só informativo.
  const totalEntradas = lancamentos.filter(l => l.tipo === 'entrada' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
  const totalSaidas = lancamentos.filter(l => l.tipo === 'saida' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
  const totalPendente = lancamentos.filter(l => l.tipo === 'entrada' && l.status === 'pendente').reduce((s, l) => s + l.valor, 0)

  // Caixa físico (pra reconciliação no Fechamento de caixa): só Dinheiro (destino='caixa').
  // Pix/cartão/transferência vão pro banco, não passam pela gaveta.
  const totalEntradasCaixa = lancamentos.filter(l => l.tipo === 'entrada' && l.status === 'pago' && l.destino === 'caixa').reduce((s, l) => s + l.valor, 0)
  const totalSaidasCaixa = lancamentos.filter(l => l.tipo === 'saida' && l.status === 'pago' && l.destino === 'caixa').reduce((s, l) => s + l.valor, 0)

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

  const faturasFiltradas = filtroStatusFatura === 'todos' ? faturas : faturas.filter(f => f.status === filtroStatusFatura)

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
            {aba === 'faturas' && (
              <Button variante="primario" onClick={() => setModalGerarFatura(true)}>
                + Gerar fatura consolidada
              </Button>
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
          <button onClick={() => setAba('faturas')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${aba === 'faturas' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Faturas
          </button>
          <button onClick={() => setAba('caixa')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${aba === 'caixa' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Fechamento de caixa
          </button>
          {ehProprietario && (
            <button onClick={() => setAba('cheques')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${aba === 'cheques' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
              Cheques
            </button>
          )}
        </div>
      </Card>

      {aba === 'lancamentos' && (
        carregando ? (
          <LoadingSpinner />
        ) : (
          <>
            <ResumoFinanceiro entradas={totalEntradas} saidas={totalSaidas} pendente={totalPendente} saldoBanco={saldoBanco} mostrarSaldoBanco={ehProprietario} />

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
            <ReguaCobranca fiados={fiados} onErroSemTelefone={() => mostrarErro('Este cliente não tem telefone cadastrado.')} />

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
              {filtroClienteFiado && (
                <Link href={`/clientes/${filtroClienteFiado}`}>
                  <Button variante="secundario" tamanho="sm">Extrato / fechamento de conta</Button>
                </Link>
              )}
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

      {aba === 'faturas' && (
        carregandoFaturas ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {(['pendente', 'paga', 'cancelada', 'todos'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFiltroStatusFatura(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filtroStatusFatura === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {s === 'todos' ? 'Todas' : s === 'pendente' ? 'Pendentes' : s === 'paga' ? 'Pagas' : 'Canceladas'}
                </button>
              ))}
            </div>

            <Card padding={false}>
              <FaturasList
                faturas={faturasFiltradas}
                ehProprietario={ehProprietario}
                onVerPDF={verFaturaPDF}
                onEnviarWhatsapp={enviarFaturaWhatsapp}
                onDarBaixa={setFaturaBaixa}
                onCancelar={cancelarFaturaHandler}
              />
            </Card>
          </>
        )
      )}

      {aba === 'caixa' && (
        <FluxoCaixa
          data={dataFiltro}
          fechamento={fechamento}
          resumoDia={resumoDia}
          totalEntradas={totalEntradasCaixa}
          totalSaidas={totalSaidasCaixa}
          totalPendente={totalPendente}
          valorAberturaSugerido={fechamentoAnterior?.valor_contado ?? 0}
          ehProprietario={ehProprietario}
          onFechar={fecharCaixa}
        />
      )}

      {aba === 'cheques' && ehProprietario && (
        carregandoCheques ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <p className="text-sm text-gray-500">Aguardando compensar</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {formatarMoeda(cheques.filter(c => c.status === 'aguardando').reduce((s, c) => s + c.valor, 0))}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Cheques aguardando</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{cheques.filter(c => c.status === 'aguardando').length}</p>
              </Card>
            </div>

            <div className="flex gap-2 flex-wrap">
              {(['aguardando', 'compensado', 'devolvido', 'todos'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFiltroStatusCheque(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filtroStatusCheque === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {s === 'todos' ? 'Todos' : s === 'aguardando' ? 'Aguardando' : s === 'compensado' ? 'Compensados' : 'Devolvidos'}
                </button>
              ))}
            </div>

            <Card padding={false}>
              <ChequesList
                cheques={chequesFiltrados}
                onCompensar={compensarChequeHandler}
                onDevolver={setChequeDevolvendo}
              />
            </Card>
          </>
        )
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
        aberto={!!reciboPagamento}
        onFechar={() => setReciboPagamento(null)}
        titulo="Pagamento registrado"
      >
        {reciboPagamento && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-line">
              {mensagemReciboFiado(reciboPagamento.fiado, reciboPagamento.valorPago, reciboPagamento.saldoApos)}
            </p>
            {!reciboPagamento.fiado.cliente?.telefone && (
              <p className="text-xs text-gray-400">Cliente sem telefone cadastrado.</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variante="secundario" onClick={() => setReciboPagamento(null)}>Fechar</Button>
              <Button
                variante="primario"
                onClick={() => {
                  const enviado = abrirWhatsapp(
                    reciboPagamento.fiado.cliente?.telefone,
                    mensagemReciboFiado(reciboPagamento.fiado, reciboPagamento.valorPago, reciboPagamento.saldoApos)
                  )
                  if (!enviado) mostrarErro('Este cliente não tem telefone cadastrado.')
                }}
              >
                Enviar recibo por WhatsApp
              </Button>
            </div>
          </div>
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

      <ModalGerarFatura
        aberto={modalGerarFatura}
        onFechar={() => setModalGerarFatura(false)}
        onGerada={onFaturaGerada}
        onErro={mostrarErro}
      />

      <ModalBaixaFatura
        fatura={faturaBaixa}
        onFechar={() => setFaturaBaixa(null)}
        onConfirmar={confirmarBaixaFatura}
      />

      <Modal
        aberto={!!faturaPDF}
        onFechar={() => setFaturaPDF(null)}
        titulo="Fatura consolidada"
        largura="xl"
      >
        {faturaPDF && (
          <div>
            <div className="flex justify-end mb-4">
              <Button variante="primario" onClick={imprimirFatura}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir / Guardar PDF
              </Button>
            </div>
            <FaturaPDF fatura={faturaPDF} pix={pixOficina} />
          </div>
        )}
      </Modal>

      <Modal
        aberto={!!chequeDevolvendo}
        onFechar={() => setChequeDevolvendo(null)}
        titulo="Registar devolução do cheque"
      >
        {chequeDevolvendo && (
          <DevolverChequeForm
            cheque={chequeDevolvendo}
            onConfirmar={devolverChequeHandler}
            onCancelar={() => setChequeDevolvendo(null)}
          />
        )}
      </Modal>
    </div>
  )
}
