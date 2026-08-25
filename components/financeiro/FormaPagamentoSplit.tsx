'use client'

import { PagamentoOS } from '@/types'
import { formatarMoeda } from '@/lib/utils'
import { Input } from '@/components/ui/Input'

const FORMAS_BASE = ['Dinheiro', 'Pix', 'Débito', 'Crédito', 'Transferência', 'Fiado']

interface FormaPagamentoSplitProps {
  total: number
  pagamentos: PagamentoOS[]
  onChange: (pagamentos: PagamentoOS[]) => void
  /** Só o proprietário vê e cadastra cheques. */
  mostrarCheque?: boolean
  /** Texto de rodapé — muda conforme o contexto (lançamento automático vs. registro de pagamento). */
  textoRodape?: string
}

const CHEQUE_VAZIO = { numero_cheque: '', banco: '', numero_conta: '', nome_titular: '', telefone: '', observacoes: '' }

export function FormaPagamentoSplit({ total, pagamentos, onChange, mostrarCheque = false, textoRodape }: FormaPagamentoSplitProps) {
  const FORMAS = mostrarCheque ? [...FORMAS_BASE.slice(0, -1), 'Cheque', 'Fiado'] : FORMAS_BASE
  const dividido = pagamentos.length > 1
  const soma = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0)
  const restante = Math.round((total - soma) * 100) / 100

  function atualizarForma(i: number, forma: string) {
    onChange(pagamentos.map((p, idx) => (idx === i ? { ...p, forma, cheque: forma === 'Cheque' ? { ...CHEQUE_VAZIO } : null } : p)))
  }
  function atualizarValor(i: number, valor: number) {
    onChange(pagamentos.map((p, idx) => (idx === i ? { ...p, valor } : p)))
  }
  function atualizarCheque(i: number, campo: keyof NonNullable<PagamentoOS['cheque']>, valor: string) {
    onChange(pagamentos.map((p, idx) => (idx === i ? { ...p, cheque: { ...(p.cheque ?? CHEQUE_VAZIO), [campo]: valor } } : p)))
  }
  function dividirPagamento() {
    const faltaAlocar = Math.max(Math.round((total - soma) * 100) / 100, 0)
    onChange([...pagamentos, { forma: 'Dinheiro', valor: faltaAlocar }])
  }
  function removerLinha(i: number) {
    onChange(pagamentos.filter((_, idx) => idx !== i))
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">Forma de pagamento *</label>

      <div className="space-y-3">
        {pagamentos.map((p, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={p.forma}
                onChange={e => atualizarForma(i, e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FORMAS.map(f => (
                  <option key={f} value={f}>{f === 'Fiado' ? 'Fiado (a prazo)' : f}</option>
                ))}
              </select>

              {dividido ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={p.valor}
                  onChange={e => atualizarValor(i, parseFloat(e.target.value) || 0)}
                  className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="w-28 text-right text-sm text-gray-500">{formatarMoeda(total)}</span>
              )}

              {dividido && (
                <button type="button" onClick={() => removerLinha(i)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {p.forma === 'Cheque' && (
              <div className="ml-1 pl-3 border-l-2 border-gray-200 grid grid-cols-2 gap-2">
                <Input label="Número do cheque *" value={p.cheque?.numero_cheque ?? ''} onChange={e => atualizarCheque(i, 'numero_cheque', e.target.value)} />
                <Input label="Banco *" value={p.cheque?.banco ?? ''} onChange={e => atualizarCheque(i, 'banco', e.target.value)} />
                <Input label="Número da conta *" value={p.cheque?.numero_conta ?? ''} onChange={e => atualizarCheque(i, 'numero_conta', e.target.value)} />
                <Input label="Nome do titular *" value={p.cheque?.nome_titular ?? ''} onChange={e => atualizarCheque(i, 'nome_titular', e.target.value)} />
                <Input label="Telefone" value={p.cheque?.telefone ?? ''} onChange={e => atualizarCheque(i, 'telefone', e.target.value)} />
                <Input label="Observações" value={p.cheque?.observacoes ?? ''} onChange={e => atualizarCheque(i, 'observacoes', e.target.value)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {!dividido ? (
        <button type="button" onClick={dividirPagamento} className="text-xs text-blue-600 hover:underline self-start">
          Foi pago só uma parte nessa forma? Dividir pagamento
        </button>
      ) : restante > 0 ? (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-orange-600 font-medium">
            Falta especificar {formatarMoeda(restante)} — como será pago o restante?
          </span>
          <button type="button" onClick={dividirPagamento} className="text-xs text-blue-600 hover:underline">
            + Adicionar forma
          </button>
        </div>
      ) : restante < 0 ? (
        <span className="text-xs text-red-600 font-medium">
          A soma dos pagamentos passa {formatarMoeda(-restante)} do valor da O.S.
        </span>
      ) : (
        <span className="text-xs text-green-600 font-medium">Pagamento totalmente especificado ✓</span>
      )}

      <p className="text-xs text-gray-400 mt-0.5">{textoRodape ?? 'Esta O.S. será lançada automaticamente no Financeiro (cada forma em separado).'}</p>
    </div>
  )
}
