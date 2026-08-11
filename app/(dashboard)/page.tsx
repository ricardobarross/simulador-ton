'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatarMoeda } from '@/lib/utils'
import { ResumoGeral } from '@/types'

export default function DashboardPage() {
  const [resumo, setResumo] = useState<ResumoGeral | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()

      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

      const [clientes, orcamentos, ordens, lancamentos] = await Promise.all([
        supabase.from('clientes').select('id', { count: 'exact' }).eq('ativo', true),
        supabase.from('orcamentos').select('id', { count: 'exact' }).in('status', ['rascunho', 'enviado']),
        supabase.from('ordens_servico').select('id', { count: 'exact' }).in('status', ['aberta', 'em_andamento']),
        supabase.from('lancamentos').select('tipo, valor').eq('status', 'pago').gte('data', inicioMes),
      ])

      const receitas = lancamentos.data?.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0) ?? 0
      const despesas = lancamentos.data?.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0) ?? 0

      setResumo({
        clientes_ativos:       clientes.count ?? 0,
        orcamentos_pendentes:  orcamentos.count ?? 0,
        ordens_abertas:        ordens.count ?? 0,
        receita_mes:           receitas,
        despesa_mes:           despesas,
        resultado_mes:         receitas - despesas,
      })
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <LoadingSpinner texto="A carregar dashboard..." />

  const cartoes = [
    {
      label: 'Clientes activos',
      valor: resumo?.clientes_ativos ?? 0,
      tipo: 'numero',
      cor: 'blue',
      href: '/clientes',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Orçamentos pendentes',
      valor: resumo?.orcamentos_pendentes ?? 0,
      tipo: 'numero',
      cor: 'yellow',
      href: '/orcamentos?status=enviado',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Ordens abertas',
      valor: resumo?.ordens_abertas ?? 0,
      tipo: 'numero',
      cor: 'orange',
      href: '/ordens?status=aberta',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
      ),
    },
    {
      label: 'Resultado do mês',
      valor: resumo?.resultado_mes ?? 0,
      tipo: 'moeda',
      cor: (resumo?.resultado_mes ?? 0) >= 0 ? 'green' : 'red',
      href: '/financeiro',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  const coresBg: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    orange: 'bg-orange-50 text-orange-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
  }

  return (
    <div className="space-y-6">
      {/* Cartões de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cartoes.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="hover:shadow-sm hover:border-gray-300 transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {c.tipo === 'moeda' ? formatarMoeda(c.valor as number) : c.valor}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${coresBg[c.cor]}`}>
                  {c.icon}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Receita vs Despesa do mês */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/financeiro">
          <Card className="hover:shadow-sm hover:border-gray-300 transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Receitas do mês</CardTitle>
            </CardHeader>
            <p className="text-3xl font-bold text-green-600">
              {formatarMoeda(resumo?.receita_mes ?? 0)}
            </p>
          </Card>
        </Link>
        <Link href="/financeiro">
          <Card className="hover:shadow-sm hover:border-gray-300 transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Despesas do mês</CardTitle>
            </CardHeader>
            <p className="text-3xl font-bold text-red-500">
              {formatarMoeda(resumo?.despesa_mes ?? 0)}
            </p>
          </Card>
        </Link>
      </div>

      {/* Atalhos rápidos */}
      <Card>
        <CardHeader>
          <CardTitle>Acções rápidas</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Novo cliente',    href: '/clientes',    cor: 'bg-blue-600'   },
            { label: 'Novo orçamento',  href: '/orcamentos',  cor: 'bg-purple-600' },
            { label: 'Nova ordem',      href: '/ordens',      cor: 'bg-amber-600'  },
            { label: 'Novo lançamento', href: '/financeiro',  cor: 'bg-green-600'  },
          ].map((a) => (
            <a
              key={a.href}
              href={a.href}
              className={`${a.cor} text-white text-sm font-medium px-4 py-3 rounded-xl text-center hover:opacity-90 transition-opacity`}
            >
              {a.label}
            </a>
          ))}
        </div>
      </Card>
    </div>
  )
}