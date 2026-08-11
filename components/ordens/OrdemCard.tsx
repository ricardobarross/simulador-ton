import Link from 'next/link'
import { OrdemServico, StatusOrdem } from '@/types'
import { Button } from '@/components/ui/Button'
import { OrdemStatus } from '@/components/ordens/OrdemStatus'
import { formatarMoeda, formatarData } from '@/lib/utils'

interface OrdemCardProps {
  ordem: OrdemServico
  onAlterarStatus: (novo: StatusOrdem) => void
  onExcluir: () => void
}

export function OrdemCard({ ordem, onAlterarStatus, onExcluir }: OrdemCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{ordem.numero}</span>
            <OrdemStatus status={ordem.status} onAlterar={onAlterarStatus} />
          </div>
          <Link href={`/ordens/${ordem.id}`} className="font-semibold text-gray-900 mt-1 truncate hover:underline block">
            {ordem.cliente?.nome ?? '—'}
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">
            {ordem.itens.length} {ordem.itens.length === 1 ? 'item' : 'itens'} · Aberta em {formatarData(ordem.data_abertura)}
            {ordem.forma_pagamento && <> · {ordem.forma_pagamento}</>}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-gray-900">{formatarMoeda(ordem.total)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-100">
        <Link href={`/ordens/${ordem.id}`}>
          <Button variante="ghost" tamanho="sm">Ver detalhes</Button>
        </Link>
        <Button variante="perigo" tamanho="sm" onClick={onExcluir} className="ml-auto">Excluir</Button>
      </div>
    </div>
  )
}
