'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { DRE, DadosDRE } from '@/components/relatorios/DRE'
import { CurvaABC, ItemCurvaABC } from '@/components/relatorios/CurvaABC'
import { RankingDevedores, ItemDevedor } from '@/components/relatorios/RankingDevedores'
import { executarOperacao } from '@/lib/api-helpers'
import { useToast } from '@/lib/toast-context'

function mesAtualISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// O Postgres devolve `numeric` como string via RPC (pra não perder precisão) —
// convertemos explicitamente pra number aqui, uma vez só, em vez de espalhar
// `Number(...)` pelos componentes visuais.
function paraDRE(d: Record<string, unknown>): DadosDRE {
  return {
    receita_lancamentos: Number(d.receita_lancamentos),
    receita_fiados: Number(d.receita_fiados),
    receita_bruta: Number(d.receita_bruta),
    custos_variaveis: Number(d.custos_variaveis),
    margem_contribuicao: Number(d.margem_contribuicao),
    custos_fixos: Number(d.custos_fixos),
    lucro_liquido: Number(d.lucro_liquido),
    margem_lucro_pct: Number(d.margem_lucro_pct),
  }
}
function paraCurvaAbc(linhas: Record<string, unknown>[]): ItemCurvaABC[] {
  return linhas.map(l => ({ categoria: String(l.categoria), total: Number(l.total), percentual: Number(l.percentual) }))
}
function paraDevedores(linhas: Record<string, unknown>[]): ItemDevedor[] {
  return linhas.map(l => ({
    cliente_id: String(l.cliente_id),
    cliente_nome: String(l.cliente_nome),
    saldo_devedor: Number(l.saldo_devedor),
    quantidade_fiados: Number(l.quantidade_fiados),
  }))
}

export default function RelatoriosPage() {
  const { mostrarErro } = useToast()
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualISO())
  const [dre, setDre] = useState<DadosDRE | null>(null)
  const [curvaAbc, setCurvaAbc] = useState<ItemCurvaABC[]>([])
  const [devedores, setDevedores] = useState<ItemDevedor[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const primeiroDia = `${mesSelecionado}-01`
      const [dreRes, abcRes, devRes] = await Promise.all([
        executarOperacao(() => supabase.rpc('calcular_dre_mensal', { p_mes: primeiroDia }).single()),
        executarOperacao(() => supabase.rpc('curva_abc_servicos', { p_mes: primeiroDia })),
        executarOperacao(() => supabase.rpc('ranking_devedores', { p_limite: 10 })),
      ])
      if (!dreRes.ok) mostrarErro(`Não foi possível calcular o DRE: ${dreRes.erro}`)
      if (!abcRes.ok) mostrarErro(`Não foi possível calcular a curva ABC: ${abcRes.erro}`)
      if (!devRes.ok) mostrarErro(`Não foi possível calcular a lista de devedores: ${devRes.erro}`)
      setDre(dreRes.ok ? paraDRE(dreRes.data as Record<string, unknown>) : null)
      setCurvaAbc(abcRes.ok ? paraCurvaAbc(abcRes.data as Record<string, unknown>[]) : [])
      setDevedores(devRes.ok ? paraDevedores(devRes.data as Record<string, unknown>[]) : [])
      setCarregando(false)
    }
    carregar()
  }, [mesSelecionado]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Relatórios</h2>
        <p className="text-sm text-gray-500">DRE, rentabilidade por categoria e devedores</p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>DRE simplificado</CardTitle>
            <p className="text-sm text-gray-400 mt-0.5">Demonstração do resultado do mês selecionado</p>
          </div>
          <input
            type="month"
            value={mesSelecionado}
            onChange={e => setMesSelecionado(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </CardHeader>
        {carregando ? (
          <LoadingSpinner texto="A calcular DRE..." />
        ) : dre ? (
          <DRE dados={dre} />
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Não foi possível calcular o DRE deste mês.</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Curva ABC de rentabilidade</CardTitle>
            <p className="text-sm text-gray-400 mt-0.5">Receita por categoria de serviço no mês selecionado</p>
          </div>
        </CardHeader>
        {carregando ? <LoadingSpinner /> : <CurvaABC dados={curvaAbc} />}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Lista de devedores</CardTitle>
            <p className="text-sm text-gray-400 mt-0.5">Clientes com fiado em aberto, do maior pro menor saldo</p>
          </div>
        </CardHeader>
        {carregando ? <LoadingSpinner /> : <RankingDevedores dados={devedores} />}
      </Card>
    </div>
  )
}
