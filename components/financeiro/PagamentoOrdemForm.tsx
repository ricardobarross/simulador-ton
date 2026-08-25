'use client'

import { useState } from 'react'
import { OrdemServico, PagamentoOS } from '@/types'
import { Button } from '@/components/ui/Button'
import { FormaPagamentoSplit } from '@/components/financeiro/FormaPagamentoSplit'
import { formatarMoeda } from '@/lib/utils'

interface PagamentoOrdemFormProps {
  ordem: OrdemServico
  ehProprietario: boolean
  onGuardar: (pagamentos: PagamentoOS[]) => Promise<void>
  onCancelar: () => void
}

/**
 * Form pra registar o pagamento de uma O.S. quando o cliente vem buscar —
 * separado da criação da O.S. e do status dela. Suporta dividir entre várias
 * formas (ex.: metade Pix, metade cartão) e, pro proprietário, receber em
 * cheque (pede os dados do cheque na hora). A soma tem que bater exatamente
 * com o total da O.S. — só pode ser registado uma vez por O.S.
 */
export function PagamentoOrdemForm({ ordem, ehProprietario, onGuardar, onCancelar }: PagamentoOrdemFormProps) {
  const [pagamentos, setPagamentos] = useState<PagamentoOS[]>([{ forma: 'Dinheiro', valor: ordem.total }])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  function validar(): boolean {
    const soma = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0)
    if (Math.round((soma - ordem.total) * 100) !== 0) {
      setErro('A soma das formas de pagamento precisa bater com o total da O.S.')
      return false
    }
    for (const p of pagamentos) {
      if (p.valor <= 0) continue
      if (p.forma === 'Cheque') {
        const c = p.cheque
        if (!c?.numero_cheque?.trim() || !c?.banco?.trim() || !c?.numero_conta?.trim() || !c?.nome_titular?.trim()) {
          setErro('Preenche número do cheque, banco, número da conta e titular.')
          return false
        }
      }
    }
    setErro('')
    return true
  }

  async function handleSubmit() {
    if (!validar()) return
    setCarregando(true)
    try {
      await onGuardar(pagamentos.filter(p => p.valor > 0))
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : 'Erro inesperado ao registar o pagamento.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
        <p className="text-gray-500">O.S. <span className="font-medium text-gray-900">{ordem.numero}</span> — {ordem.cliente?.nome}</p>
        <p className="text-gray-500">Valor total: <span className="font-semibold text-gray-900">{formatarMoeda(ordem.total)}</span></p>
      </div>

      <FormaPagamentoSplit
        total={ordem.total}
        pagamentos={pagamentos}
        onChange={setPagamentos}
        mostrarCheque={ehProprietario}
        textoRodape="Cada forma vira uma entrada separada: dinheiro/Pix/cartão no Financeiro, fiado em aberto ou cheque a compensar."
      />
      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>Registar pagamento</Button>
      </div>
    </div>
  )
}
