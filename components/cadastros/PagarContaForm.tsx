'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatarMoeda } from '@/lib/utils'

interface PagarContaFormProps {
  descricao: string
  valorReferencia: number
  dataSugerida: string
  onConfirmar: (dados: { valor: number; formaPagamento: string; data: string; observacoes: string | null }) => Promise<void>
  onCancelar: () => void
}

/**
 * Confirma o pagamento de uma conta (fixa ou variável). O valor vem
 * pré-preenchido com o valor de referência cadastrado, mas é editável — contas
 * como energia variam de mês pra mês, então o valor real pago pode ser
 * diferente do cadastrado sem precisar mudar o cadastro.
 */
export function PagarContaForm({ descricao, valorReferencia, dataSugerida, onConfirmar, onCancelar }: PagarContaFormProps) {
  const [valor, setValor] = useState(valorReferencia.toString())
  const [formaPagamento, setFormaPagamento] = useState('Dinheiro')
  const [data, setData] = useState(dataSugerida)
  const [observacoes, setObservacoes] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit() {
    if (!valor || parseFloat(valor) <= 0) { setErro('Informe o valor pago'); return }
    setErro('')
    setCarregando(true)
    await onConfirmar({
      valor: parseFloat(valor),
      formaPagamento,
      data,
      observacoes: observacoes.trim() || null,
    })
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-500">Conta</p>
        <p className="text-sm font-semibold text-gray-900">{descricao}</p>
        <p className="text-xs text-gray-400 mt-0.5">Valor de referência: {formatarMoeda(valorReferencia)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Valor pago *" type="number" step="0.01" prefixo="R$" value={valor} onChange={e => setValor(e.target.value)} erro={erro} />
        <Input label="Data do pagamento" type="date" value={data} onChange={e => setData(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Forma de pagamento</label>
        <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="Dinheiro">Dinheiro</option>
          <option value="Pix">Pix</option>
          <option value="Débito">Cartão de débito</option>
          <option value="Crédito">Cartão de crédito</option>
          <option value="Transferência">Transferência</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Observações</label>
        <textarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>Confirmar pagamento</Button>
      </div>
    </div>
  )
}
