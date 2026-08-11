'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { OrdemCard } from '@/components/ordens/OrdemCard'
import { OrdemForm } from '@/components/ordens/OrdemForm'
import { OrdemServico, StatusOrdem } from '@/types'
import { lancarOrdemNoFinanceiro, sincronizarLancamentoOrdem } from '@/lib/financeiro'

const statusOpcoes: (StatusOrdem | 'todos')[] = ['todos', 'aberta', 'em_andamento', 'aguardando', 'concluida', 'cancelada']
const statusLabel: Record<string, string> = {
  todos: 'Todas', aberta: 'Aberta', em_andamento: 'Em andamento', aguardando: 'Aguardando', concluida: 'Concluída', cancelada: 'Cancelada',
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
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<StatusOrdem | 'todos'>(statusInicial ?? 'todos')

  async function carregar() {
    const supabase = createClient()
    const { data } = await supabase
      .from('ordens_servico')
      .select('*, cliente:clientes(id, nome, telefone)')
      .order('created_at', { ascending: false })
    setOrdens((data as OrdemServico[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function criar(dados: Partial<OrdemServico>) {
    const supabase = createClient()
    const { data: nova } = await supabase
      .from('ordens_servico')
      .insert(dados)
      .select('*, cliente:clientes(nome)')
      .single()
    if (nova) {
      await lancarOrdemNoFinanceiro(supabase, {
        id: nova.id,
        numero: nova.numero,
        total: nova.total,
        forma_pagamento: nova.forma_pagamento,
        pagamentos: nova.pagamentos,
        cliente_id: nova.cliente_id,
        cliente_nome: nova.cliente?.nome,
      })
    }
    setModalAberto(false)
    await carregar()
  }

  async function alterarStatus(ordem: OrdemServico, novo: StatusOrdem) {
    const supabase = createClient()
    const dados: Partial<OrdemServico> = { status: novo }
    if (novo === 'concluida') dados.data_conclusao = new Date().toISOString()
    await supabase.from('ordens_servico').update(dados).eq('id', ordem.id)
    await sincronizarLancamentoOrdem(supabase, ordem.id, novo)
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta ordem de serviço?')) return
    const supabase = createClient()
    await supabase.from('ordens_servico').delete().eq('id', id)
    await carregar()
  }

  const filtradas = filtroStatus === 'todos' ? ordens : ordens.filter(o => o.status === filtroStatus)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Ordens de Serviço</h2>
          <p className="text-sm text-gray-500">{ordens.length} ordens registadas</p>
        </div>
        <Button variante="primario" onClick={() => setModalAberto(true)}>+ Nova ordem de serviço</Button>
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
            />
          ))}
        </div>
      )}

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Nova ordem de serviço" largura="xl">
        <OrdemForm onGuardar={criar} onCancelar={() => setModalAberto(false)} />
      </Modal>
    </div>
  )
}
