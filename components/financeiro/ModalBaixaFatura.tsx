'use client'

import { useState } from 'react'
import { Fatura } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatarMoeda } from '@/lib/utils'

interface ModalBaixaFaturaProps {
  fatura: Fatura | null
  onFechar: () => void
  onConfirmar: (formaPagamento: string) => Promise<void>
}

export function ModalBaixaFatura({ fatura, onFechar, onConfirmar }: ModalBaixaFaturaProps) {
  const [formaPagamento, setFormaPagamento] = useState('Dinheiro')
  const [carregando, setCarregando] = useState(false)

  async function handleConfirmar() {
    setCarregando(true)
    try {
      await onConfirmar(formaPagamento)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Modal aberto={!!fatura} onFechar={onFechar} titulo="Dar baixa na fatura">
      {fatura && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <p className="text-gray-500">Fatura: <span className="font-medium text-gray-900">{fatura.numero_fatura}</span></p>
            <p className="text-gray-500">Cliente: <span className="font-medium text-gray-900">{fatura.cliente?.nome}</span></p>
            <p className="text-gray-500">Total: <span className="font-semibold text-gray-900">{formatarMoeda(fatura.valor_total)}</span></p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Forma de pagamento</label>
            <select
              value={formaPagamento}
              onChange={e => setFormaPagamento(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Dinheiro">Dinheiro</option>
              <option value="Pix">Pix</option>
              <option value="Débito">Cartão de débito</option>
              <option value="Crédito">Cartão de crédito</option>
              <option value="Transferência">Transferência</option>
            </select>
          </div>

          <p className="text-xs text-gray-400">
            Isso marca a fatura como paga, lança {formatarMoeda(fatura.valor_total)} de entrada no caixa de hoje e quita todos os fiados vinculados — tudo de uma vez.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button variante="secundario" onClick={onFechar} disabled={carregando}>Cancelar</Button>
            <Button variante="primario" carregando={carregando} onClick={handleConfirmar}>Confirmar baixa</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
