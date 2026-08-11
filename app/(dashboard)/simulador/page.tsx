'use client'

import { useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn, formatarMoeda } from '@/lib/utils'

// ─── Tabela oficial de taxas Ton — "Minhas taxas e prazos" ──────────
// Maquininha · Recebimento no mesmo dia. Atualize aqui sempre que a Ton
// alterar as taxas do seu plano (conferir em ton.com.br ou no app Ton).
type Bandeira = 'Mastercard' | 'Visa' | 'Elo' | 'Amex'

interface TaxasBandeira {
  debito: number
  // índice 0 = crédito à vista (1x), índice 20 = 21x
  credito: number[]
}

const TAXAS: Record<Bandeira, TaxasBandeira> = {
  Mastercard: {
    debito: 0.0198,
    credito: [
      0.0486, 0.1086, 0.1224, 0.1359, 0.1492, 0.1622, 0.1750, 0.1876, 0.1999, 0.2119,
      0.2139, 0.2139, 0.2439, 0.2537, 0.2638, 0.2744, 0.2853, 0.2967, 0.3086, 0.3210, 0.3338,
    ],
  },
  Visa: {
    debito: 0.0198,
    credito: [
      0.0486, 0.1086, 0.1224, 0.1359, 0.1492, 0.1622, 0.1750, 0.1876, 0.1999, 0.2119,
      0.2139, 0.2139, 0.2439, 0.2537, 0.2638, 0.2744, 0.2853, 0.2967, 0.3086, 0.3210, 0.3338,
    ],
  },
  Elo: {
    debito: 0.0317,
    credito: [
      0.0605, 0.1225, 0.1363, 0.1498, 0.1631, 0.1761, 0.1889, 0.2015, 0.2138, 0.2258,
      0.2278, 0.2278, 0.2578, 0.2681, 0.2788, 0.2900, 0.3016, 0.3137, 0.3262, 0.3392, 0.3528,
    ],
  },
  Amex: {
    debito: 0.0317,
    credito: [
      0.0605, 0.1225, 0.1363, 0.1498, 0.1631, 0.1761, 0.1889, 0.2015, 0.2138, 0.2258,
      0.2278, 0.2278, 0.2578, 0.2681, 0.2788, 0.2900, 0.3016, 0.3137, 0.3262, 0.3392, 0.3528,
    ],
  },
}

const TAXA_PIX = 0.0099

type FormaPagamento = 'debito' | 'credito' | 'pix'
type Modo = 'cobrar' | 'receber'

const BANDEIRAS: Bandeira[] = ['Mastercard', 'Visa', 'Elo', 'Amex']

function taxaAtual(bandeira: Bandeira, forma: FormaPagamento, parcelas: number) {
  if (forma === 'pix') return TAXA_PIX
  if (forma === 'debito') return TAXAS[bandeira].debito
  return TAXAS[bandeira].credito[parcelas - 1]
}

export default function SimuladorPage() {
  const [modo, setModo] = useState<Modo>('cobrar')
  const [valor, setValor] = useState<string>('')
  const [bandeira, setBandeira] = useState<Bandeira>('Mastercard')
  const [forma, setForma] = useState<FormaPagamento>('credito')
  const [parcelas, setParcelas] = useState(1)
  const [verTodasParcelas, setVerTodasParcelas] = useState(false)

  const valorNum = parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0
  const taxa = taxaAtual(bandeira, forma, parcelas)

  // No modo "Cobrar", o valor digitado é o valor da venda (bruto).
  // No modo "Receber", o valor digitado é o quanto você quer receber
  // líquido, e calculamos o valor bruto necessário: bruto = líquido / (1 - taxa)
  const { bruto, liquido, desconto } = useMemo(() => {
    if (modo === 'cobrar') {
      const bruto = valorNum
      const desconto = bruto * taxa
      return { bruto, liquido: bruto - desconto, desconto }
    } else {
      const liquido = valorNum
      const bruto = taxa < 1 ? liquido / (1 - taxa) : 0
      const desconto = bruto - liquido
      return { bruto, liquido, desconto }
    }
  }, [valorNum, taxa, modo])

  const parcelasOpcoes = Array.from({ length: 21 }, (_, i) => i + 1)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Simulador de taxas Ton</h2>
        <p className="text-sm text-gray-500">Baseado na tabela oficial "Minhas taxas e prazos" — recebimento no mesmo dia</p>
      </div>

      {/* Toggle Cobrar / Receber */}
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setModo('cobrar')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            modo === 'cobrar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Cobrar
        </button>
        <button
          onClick={() => setModo('receber')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            modo === 'receber' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Receber
        </button>
      </div>

      {/* Personalize sua simulação */}
      <Card>
        <CardHeader>
          <CardTitle>Personalize sua simulação</CardTitle>
        </CardHeader>

        <div className="space-y-4">
          <Input
            label={modo === 'cobrar' ? 'Valor da venda' : 'Valor que você quer receber'}
            prefixo="R$"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Forma de pagamento</label>
              <select
                value={forma}
                onChange={(e) => {
                  const f = e.target.value as FormaPagamento
                  setForma(f)
                  if (f !== 'credito') setParcelas(1)
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="debito">Cartão de débito</option>
                <option value="credito">Cartão de crédito</option>
                <option value="pix">Pix</option>
              </select>
            </div>

            {forma !== 'pix' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Bandeira</label>
                <select
                  value={bandeira}
                  onChange={(e) => setBandeira(e.target.value as Bandeira)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {BANDEIRAS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {forma === 'credito' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Número de parcelas</label>
              <select
                value={parcelas}
                onChange={(e) => setParcelas(parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {parcelasOpcoes.map((p) => (
                  <option key={p} value={p}>{p === 1 ? 'À vista (1x)' : `${p}x`}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Resultado */}
      <div className="rounded-xl border border-gray-800 shadow-sm p-6" style={{ backgroundColor: '#111827' }}>
        <p className="text-sm" style={{ color: '#9ca3af' }}>
          {modo === 'cobrar' ? 'Você recebe' : 'Valor a cobrar do cliente'}
        </p>
        <p className="text-3xl font-bold mt-1" style={{ color: '#ffffff' }}>
          {formatarMoeda(modo === 'cobrar' ? liquido : bruto)}
        </p>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-5" style={{ borderTop: '1px solid #374151' }}>
          <div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Taxa aplicada</p>
            <p className="text-base font-semibold mt-0.5" style={{ color: '#ffffff' }}>{(taxa * 100).toFixed(2).replace('.', ',')}%</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Desconto</p>
            <p className="text-base font-semibold mt-0.5" style={{ color: '#f87171' }}>- {formatarMoeda(desconto)}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 text-xs space-y-1" style={{ borderTop: '1px solid #374151', color: '#9ca3af' }}>
          <p>Valor da venda: <span style={{ color: '#e5e7eb' }}>{formatarMoeda(bruto)}</span></p>
          <p>Forma de pagamento: <span style={{ color: '#e5e7eb' }}>
            {forma === 'pix' ? 'Pix' : forma === 'debito' ? `Débito — ${bandeira}` : `Crédito ${parcelas}x — ${bandeira}`}
          </span></p>
          <p>Prazo: <span style={{ color: '#e5e7eb' }}>Recebimento no mesmo dia</span></p>
        </div>
      </div>

      {/* Conferir todas as parcelas */}
      {forma === 'credito' && (
        <Card padding={false}>
          <button
            onClick={() => setVerTodasParcelas((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-gray-900"
          >
            Conferir todas as parcelas
            <svg
              className={cn('w-4 h-4 text-gray-400 transition-transform', verTodasParcelas && 'rotate-180')}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {verTodasParcelas && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {parcelasOpcoes.map((p) => {
                const t = TAXAS[bandeira].credito[p - 1]
                const base = modo === 'cobrar' ? valorNum : (t < 1 ? valorNum / (1 - t) : 0)
                const liq = base - base * t
                return (
                  <button
                    key={p}
                    onClick={() => { setParcelas(p); setVerTodasParcelas(false) }}
                    className={cn(
                      'w-full flex items-center justify-between px-5 py-2.5 text-sm hover:bg-gray-50 transition-colors',
                      p === parcelas && 'bg-blue-50'
                    )}
                  >
                    <span className={cn('text-gray-700', p === parcelas && 'font-semibold text-blue-700')}>
                      {p === 1 ? 'À vista (1x)' : `${p}x`}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-gray-400">{(t * 100).toFixed(2).replace('.', ',')}%</span>
                      <span className={cn('font-medium text-gray-900', p === parcelas && 'text-blue-700')}>
                        {formatarMoeda(liq)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      )}

      <p className="text-xs text-gray-400 text-center">
        Simulador independente baseado na tabela oficial de taxas Ton (Maquininha, recebimento no mesmo dia).
        As taxas podem ser alteradas pela operadora sem aviso prévio — confira sempre no app da Ton.
      </p>
    </div>
  )
}
