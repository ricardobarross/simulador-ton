'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { GraficoReceita } from '@/components/relatorios/GraficoReceita'
import { GraficoOrcamentos } from '@/components/relatorios/GraficoOrcamentos'
import { ExportCSV } from '@/components/relatorios/ExportCSV'
import { Lancamento, Orcamento, OrdemServico } from '@/types'
import { formatarMoeda, statusOrcamento, statusOrdem } from '@/lib/utils'

function nomeMes(data: Date) {
  return data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export default function RelatoriosPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const seiseMesesAtras = new Date()
      seiseMesesAtras.setMonth(seiseMesesAtras.getMonth() - 5)
      seiseMesesAtras.setDate(1)
      const desde = seiseMesesAtras.toISOString().slice(0, 10)

      const [lancRes, orcRes, ordRes] = await Promise.all([
        supabase.from('lancamentos').select('*').gte('data', desde).neq('status', 'cancelado'),
        supabase.from('orcamentos').select('*'),
        supabase.from('ordens_servico').select('*'),
      ])
      setLancamentos((lancRes.data ?? []) as Lancamento[])
      setOrcamentos((orcRes.data ?? []) as Orcamento[])
      setOrdens((ordRes.data ?? []) as OrdemServico[])
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <LoadingSpinner texto="A carregar relatórios..." />

  // ─── Receita x despesa por mês (últimos 6 meses) ────────────
  const meses: { chave: string; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    meses.push({ chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: nomeMes(d) })
  }
  const dadosReceita = meses.map(m => {
    const doMes = lancamentos.filter(l => l.data.startsWith(m.chave))
    return {
      mes: m.label,
      receita: doMes.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0),
      despesa: doMes.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0),
    }
  })

  const totalReceita = lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0)
  const totalDespesa = lancamentos.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0)

  // ─── Orçamentos por status ────────────────────────────────
  const dadosOrcamentos = Object.entries(statusOrcamento).map(([status, info]) => ({
    status,
    label: info.label,
    cor: info.cor as 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red',
    quantidade: orcamentos.filter(o => o.status === status).length,
  }))

  const dadosOrdens = Object.entries(statusOrdem).map(([status, info]) => ({
    status,
    label: info.label,
    cor: info.cor as 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red',
    quantidade: ordens.filter(o => o.status === status).length,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Relatórios</h2>
        <p className="text-sm text-gray-500">Últimos 6 meses</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Receita total (6 meses)</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatarMoeda(totalReceita)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Despesa total (6 meses)</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{formatarMoeda(totalDespesa)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receitas x Despesas por mês</CardTitle>
          <ExportCSV
            nomeArquivo="lancamentos.csv"
            linhas={lancamentos.map(l => ({ data: l.data, tipo: l.tipo, categoria: l.categoria ?? '', descricao: l.descricao, valor: l.valor, status: l.status }))}
          />
        </CardHeader>
        <GraficoReceita dados={dadosReceita} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Orçamentos por estado</CardTitle>
            <ExportCSV
              nomeArquivo="orcamentos.csv"
              linhas={orcamentos.map(o => ({ numero: o.numero, status: o.status, total: o.total, criado_em: o.created_at }))}
            />
          </CardHeader>
          <GraficoOrcamentos dados={dadosOrcamentos} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ordens de serviço por estado</CardTitle>
            <ExportCSV
              nomeArquivo="ordens_servico.csv"
              linhas={ordens.map(o => ({ numero: o.numero, status: o.status, total: o.total, aberta_em: o.data_abertura }))}
            />
          </CardHeader>
          <GraficoOrcamentos dados={dadosOrdens} />
        </Card>
      </div>
    </div>
  )
}
