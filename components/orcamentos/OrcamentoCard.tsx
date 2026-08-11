import { Orcamento } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatarMoeda, formatarData, statusOrcamento } from '@/lib/utils'

interface OrcamentoCardProps {
  orcamento: Orcamento
  onEditar:    () => void
  onExcluir:   () => void
  onPDF:       () => void
  onConverterOS: () => void
}

export function OrcamentoCard({
  orcamento,
  onEditar,
  onExcluir,
  onPDF,
  onConverterOS,
}: OrcamentoCardProps) {
  const st = statusOrcamento[orcamento.status]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{orcamento.numero}</span>
            <Badge cor={st.cor as 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red'}>
              {st.label}
            </Badge>
          </div>
          <p className="font-semibold text-gray-900 mt-1 truncate">
            {orcamento.cliente?.nome ?? '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {orcamento.itens.length} {orcamento.itens.length === 1 ? 'item' : 'itens'} ·{' '}
            Válido por {orcamento.validade_dias} dias ·{' '}
            {formatarData(orcamento.created_at)}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-gray-900">{formatarMoeda(orcamento.total)}</p>
          {orcamento.desconto > 0 && (
            <p className="text-xs text-green-600">-{formatarMoeda(orcamento.desconto)}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-100">
        <Button variante="ghost" tamanho="sm" onClick={onEditar}>Editar</Button>
        <Button variante="ghost" tamanho="sm" onClick={onPDF}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          PDF
        </Button>
        {orcamento.status === 'aprovado' && (
          <Button variante="secundario" tamanho="sm" onClick={onConverterOS}>
            → Ordem de serviço
          </Button>
        )}
        <Button variante="perigo" tamanho="sm" onClick={onExcluir} className="ml-auto">
          Excluir
        </Button>
      </div>
    </div>
  )
}