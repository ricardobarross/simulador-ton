'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { OrdemCard } from '@/components/ordens/OrdemCard'
import { OrdemForm } from '@/components/ordens/OrdemForm'
import { PagamentoOrdemForm } from '@/components/financeiro/PagamentoOrdemForm'
import { OrdemServico, StatusOrdem, Servico, PagamentoOS, SituacaoPagamentoOrdem } from '@/types'
import { sincronizarLancamentoOrdem, registrarPagamentoOrdem, calcularSituacoesPagamento } from '@/lib/financeiro'
import { executarOperacao } from '@/lib/api-helpers'
import { useToast } from '@/lib/toast-context'
import { useAuth } from '@/lib/auth-context'
import { abrirWhatsapp, mensagemResumoOrdemServico } from '@/lib/whatsapp'

const statusOpcoes: (StatusOrdem | 'todos' | 'fiado_pendente')[] = ['todos', 'aberta', 'em_andamento', 'aguardando', 'concluida', 'cancelada', 'fiado_pendente']
const statusLabel: Record<string, string> = {
  todos: 'Todas', aberta: 'Abertas', em_andamento: 'Em usinagem', aguardando: 'Prontas', concluida: 'Concluídas', cancelada: 'Canceladas', fiado_pendente: 'Fiado pendente',
}
const categoriaLabel: Record<string, string> = {
  tornear: 'Tornear', fresar: 'Fresar', solda: 'Solda', bancada: 'Bancada', outro: 'Outro',
}

export default function OrdensPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <OrdensPageInner />
    </Suspense>
  )
}

function OrdensPageInner() {
  const searchParams = useSearchParams()
  const statusInicial = searchParams.get('status') as StatusOrdem | null
  const { mostrarErro, mostrarSucesso } = useToast()
  const { ehProprietario, perfil } = useAuth()
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [ordemPagando, setOrdemPagando] = useState<OrdemServico | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<StatusOrdem | 'todos' | 'fiado_pendente'>(statusInicial ?? 'todos')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [buscaServico, setBuscaServico] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [categoriaPorServico, setCategoriaPorServico] = useState<Map<string, string>>(new Map())
  const [ordensComFiadoPendente, setOrdensComFiadoPendente] = useState<Set<string>>(new Set())
  const [situacoesPagamento, setSituacoesPagamento] = useState<Map<string, SituacaoPagamentoOrdem>>(new Map())

  async function carregar() {
    const supabase = createClient()
    const [ordensRes, servicosRes, fiadosRes, lancamentosRes, chequesRes] = await Promise.all([
      executarOperacao(() =>
        supabase
          .from('ordens_servico')
          .select('*, cliente:clientes(id, nome, telefone)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
      ),
      executarOperacao(() => supabase.from('servicos').select('id, categoria')),
      executarOperacao(() => supabase.from('fiados').select('ordem_servico_id').neq('status', 'quitado').is('deleted_at', null).not('ordem_servico_id', 'is', null)),
      executarOperacao(() => supabase.from('lancamentos').select('ordem_servico_id').is('deleted_at', null).not('ordem_servico_id', 'is', null)),
      executarOperacao(() => supabase.from('cheques').select('ordem_servico_id, status').is('deleted_at', null).not('ordem_servico_id', 'is', null)),
    ])
    if (!ordensRes.ok) {
      mostrarErro(`Não foi possível carregar as ordens de serviço: ${ordensRes.erro}`)
      setCarregando(false)
      return
    }
    setOrdens((ordensRes.data as OrdemServico[]) ?? [])
    if (servicosRes.ok) {
      setCategoriaPorServico(new Map((servicosRes.data as Pick<Servico, 'id' | 'categoria'>[]).map(s => [s.id, s.categoria])))
    }
    const fiadosPendentes = fiadosRes.ok
      ? new Set((fiadosRes.data as { ordem_servico_id: string }[]).map(f => f.ordem_servico_id))
      : new Set<string>()
    setOrdensComFiadoPendente(fiadosPendentes)
    setSituacoesPagamento(
      calcularSituacoesPagamento(
        fiadosPendentes,
        lancamentosRes.ok ? (lancamentosRes.data as { ordem_servico_id: string | null }[]) : [],
        chequesRes.ok ? (chequesRes.data as { ordem_servico_id: string | null; status: string }[]) : []
      )
    )
    setCarregando(false)
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function criar(dados: Partial<OrdemServico>) {
    const supabase = createClient()
    const inserir = await executarOperacao(() =>
      supabase.from('ordens_servico').insert(dados).select('*, cliente:clientes(nome)').single()
    )
    if (!inserir.ok) {
      mostrarErro(`Não foi possível criar a ordem de serviço: ${inserir.erro}`)
      return // modal continua aberto — nada foi salvo
    }

    // Sem lançamento automático — a O.S. entra "aguardando pagamento" e só é
    // lançada no Financeiro quando o cliente vier buscar e pagar de fato
    // (botão "Registar pagamento").
    mostrarSucesso(`O.S. ${inserir.data.numero} criada.`)
    setModalAberto(false)
    await carregar()
  }

  async function registrarPagamento(pagamentos: PagamentoOS[]) {
    if (!ordemPagando) return
    const supabase = createClient()
    const resultado = await registrarPagamentoOrdem(supabase, ordemPagando.id, pagamentos, perfil?.id ?? null)
    if (!resultado.ok) {
      mostrarErro(`Não foi possível registar o pagamento: ${resultado.erro}`)
      return
    }
    mostrarSucesso(`Pagamento da O.S. ${ordemPagando.numero} registado.`)
    setOrdemPagando(null)
    await carregar()
  }

  async function alterarStatus(ordem: OrdemServico, novo: StatusOrdem) {
    const supabase = createClient()
    const dados: Partial<OrdemServico> = { status: novo }
    if (novo === 'concluida') dados.data_conclusao = new Date().toISOString()

    const atualizar = await executarOperacao(() =>
      supabase.from('ordens_servico').update(dados).eq('id', ordem.id).select().single()
    )
    if (!atualizar.ok) {
      mostrarErro(`Não foi possível alterar o status da O.S.: ${atualizar.erro}`)
      return
    }

    const sync = await sincronizarLancamentoOrdem(supabase, ordem.id, novo)
    if (!sync.ok) {
      mostrarErro(`Status alterado, mas houve um problema ao atualizar o Financeiro: ${sync.erro}`)
    }
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta ordem de serviço?')) return
    const supabase = createClient()
    // Soft delete: o banco recusa DELETE físico e também bloqueia esta exclusão
    // se houver lançamento financeiro ativo ou fiado em aberto ligado a esta O.S.
    const resultado = await executarOperacao(() =>
      supabase.from('ordens_servico').update({ deleted_at: new Date().toISOString() }).eq('id', id).select().single()
    )
    if (!resultado.ok) {
      mostrarErro(`Não foi possível excluir: ${resultado.erro}`)
      return
    }
    mostrarSucesso('Ordem de serviço excluída.')
    await carregar()
  }

  function enviarWhatsapp(ordem: OrdemServico) {
    const enviado = abrirWhatsapp(ordem.cliente?.telefone, mensagemResumoOrdemServico(ordem))
    if (!enviado) mostrarErro('Este cliente não tem telefone cadastrado.')
  }

  const filtradas = ordens
    .filter(o => {
      if (filtroStatus === 'todos') return true
      if (filtroStatus === 'fiado_pendente') return ordensComFiadoPendente.has(o.id)
      return o.status === filtroStatus
    })
    .filter(o => !buscaCliente || (o.cliente?.nome ?? '').toLowerCase().includes(buscaCliente.toLowerCase()))
    .filter(o => {
      if (!buscaServico) return true
      const termo = buscaServico.toLowerCase()
      return o.itens.some(item =>
        item.descricao.toLowerCase().includes(termo) ||
        (item.servico_id && (categoriaLabel[categoriaPorServico.get(item.servico_id) ?? ''] ?? '').toLowerCase().includes(termo))
      )
    })
    .filter(o => !dataInicio || o.data_abertura.slice(0, 10) >= dataInicio)
    .filter(o => !dataFim || o.data_abertura.slice(0, 10) <= dataFim)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Ordens de Serviço</h2>
          <p className="text-sm text-gray-500">{ordens.length} ordens registadas</p>
        </div>
        <Button variante="primario" onClick={() => setModalAberto(true)}>+ Nova ordem de serviço</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-wrap">
        <Input placeholder="Buscar por cliente..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} className="max-w-xs" />
        <Input placeholder="Buscar por serviço/categoria..." value={buscaServico} onChange={e => setBuscaServico(e.target.value)} className="max-w-xs" />
        <div className="flex items-center gap-2">
          <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-auto" />
          <span className="text-xs text-gray-400">até</span>
          <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-auto" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {statusOpcoes.map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filtroStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {statusLabel[s]}
          </button>
        ))}
      </div>

      {carregando ? (
        <LoadingSpinner />
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Nenhuma ordem de serviço encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtradas.map(o => (
            <OrdemCard
              key={o.id}
              ordem={o}
              onAlterarStatus={(novo) => alterarStatus(o, novo)}
              onExcluir={() => excluir(o.id)}
              onEnviarWhatsapp={() => enviarWhatsapp(o)}
              onRegistrarPagamento={() => setOrdemPagando(o)}
              situacaoPagamento={situacoesPagamento.get(o.id) ?? 'aguardando'}
            />
          ))}
        </div>
      )}

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Nova ordem de serviço" largura="xl">
        <OrdemForm onGuardar={criar} onCancelar={() => setModalAberto(false)} />
      </Modal>

      <Modal aberto={!!ordemPagando} onFechar={() => setOrdemPagando(null)} titulo="Registar pagamento">
        {ordemPagando && (
          <PagamentoOrdemForm
            ordem={ordemPagando}
            ehProprietario={ehProprietario}
            onGuardar={registrarPagamento}
            onCancelar={() => setOrdemPagando(null)}
          />
        )}
      </Modal>
    </div>
  )
}
