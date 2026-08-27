'use client'

import { useState } from 'react'
import { DestinoFinanceiro } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatarMoeda } from '@/lib/utils'

interface AjustarSaldoFormProps {
  conta: DestinoFinanceiro
  saldoAtual: number
  onConfirmar: (saldoReal: number, observacaoExtra: string) => Promise<void>
  onCancelar: () => void
}

/**
 * Reconciliação de saldo: o usuário confere o valor real (extrato do banco,
 * dinheiro contado na gaveta) e informa aqui. A diferença em relação ao que
 * o sistema calculou (soma dos lançamentos) é mostrada ao vivo e, ao
 * confirmar, vira um lançamento de ajuste — a comparação "sistema x real"
 * fica registada nas observações desse lançamento, pra auditoria futura.
 */
export function AjustarSaldoForm({ conta, saldoAtual, onConfirmar, onCancelar }: AjustarSaldoFormProps) {
  const [saldoReal, setSaldoReal] = useState(saldoAtual.toFixed(2))
  const [observacao, setObservacao] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const saldoRealNum = parseFloat(saldoReal.replace(',', '.'))
  const diferenca = Number.isFinite(saldoRealNum) ? Math.round((saldoRealNum - saldoAtual) * 100) / 100 : 0
  const semDiferenca = diferenca === 0

  async function handleSubmit() {
    if (!saldoReal || !Number.isFinite(saldoRealNum)) {
      setErro('Informe o saldo real conferido')
      return
    }
    setErro('')
    setCarregando(true)
    await onConfirmar(saldoRealNum, observacao.trim())
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-500">Saldo no sistema ({conta === 'caixa' ? 'Dinheiro' : 'Banco'})</p>
        <p className="text-lg font-semibold text-gray-900">{formatarMoeda(saldoAtual)}</p>
      </div>

      <Input
        label="Saldo real conferido *"
        type="number"
        step="0.01"
        prefixo="R$"
        value={saldoReal}
        onChange={e => setSaldoReal(e.target.value)}
        erro={erro}
        placeholder="Ex: 480,00"
      />

      {!semDiferenca && Number.isFinite(saldoRealNum) && (
        <div className={`rounded-lg p-3 text-sm font-medium ${diferenca > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          Diferença: {diferenca > 0 ? '+ ' : '- '}{formatarMoeda(Math.abs(diferenca))}
          {' '}({diferenca > 0 ? 'sistema estava a menos' : 'sistema estava a mais'}) — vai criar um lançamento de ajuste.
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Observação (opcional)</label>
        <textarea
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          rows={2}
          placeholder="Ex: taxa do cartão descontada, saque não lançado..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>
          {semDiferenca ? 'Sem diferença' : 'Confirmar ajuste'}
        </Button>
      </div>
    </div>
  )
}
