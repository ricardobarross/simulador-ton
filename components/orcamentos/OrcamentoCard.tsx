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
  onEnviarWhatsapp: () => void
}

export function OrcamentoCard({
  orcamento,
  onEditar,
  onExcluir,
  onPDF,
  onConverterOS,
  onEnviarWhatsapp,
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
        <Button variante="ghost" tamanho="sm" onClick={onEnviarWhatsapp}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.868-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12.001 2C6.478 2 2 6.477 2 12c0 1.876.508 3.63 1.394 5.132L2 22l4.98-1.362A9.955 9.955 0 0012.001 22C17.523 22 22 17.523 22 12S17.523 2 12.001 2zm0 18.031a8.02 8.02 0 01-4.086-1.117l-.293-.174-3.032.83.822-3.015-.19-.301A8.008 8.008 0 014 12c0-4.418 3.582-8 8.001-8 4.418 0 7.999 3.582 7.999 8 0 4.418-3.581 8.031-7.999 8.031z" />
          </svg>
          Enviar
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