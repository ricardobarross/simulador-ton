'use client'

import { useState } from 'react'
import { Cheque } from '@/types'
import { Button } from '@/components/ui/Button'
import { formatarMoeda } from '@/lib/utils'

interface DevolverChequeFormProps {
  cheque: Cheque
  onConfirmar: (motivo: string) => Promise<void>
  onCancelar: () => void
}

export function DevolverChequeForm({ cheque, onConfirmar, onCancelar }: DevolverChequeFormProps) {
  const [motivo, setMotivo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit() {
    if (!motivo.trim()) { setErro('Informa o motivo da devolução (ex.: sem fundos, sustado).'); return }
    setErro('')
    setCarregando(true)
    try {
      await onConfirmar(motivo.trim())
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
        <p className="text-gray-500">Cheque nº <span className="font-medium text-gray-900">{cheque.numero_cheque}</span> — {cheque.nome_titular}</p>
        <p className="text-gray-500">Valor: <span className="font-semibold text-gray-900">{formatarMoeda(cheque.valor)}</span></p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Motivo da devolução *</label>
        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          rows={3}
          placeholder="Ex.: sem fundos, cheque sustado, conta encerrada..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        {erro && <p className="text-xs text-red-600">{erro}</p>}
      </div>

      <p className="text-xs text-gray-400">
        {cheque.cliente_id
          ? 'Isso vira uma dívida (fiado) nova pro cliente que passou o cheque.'
          : 'Este cheque não está ligado a um cliente cadastrado — nenhum fiado será criado automaticamente.'}
      </p>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="perigo" carregando={carregando} onClick={handleSubmit}>Confirmar devolução</Button>
      </div>
    </div>
  )
}
