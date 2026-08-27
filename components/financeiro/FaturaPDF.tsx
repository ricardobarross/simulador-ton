import { Fatura } from '@/types'
import { DadosPix, DadosEmpresa } from '@/lib/configuracoes'
import { formatarMoeda, formatarData } from '@/lib/utils'
import { ImprimirPortal } from '@/components/ui/ImprimirPortal'

interface FaturaPDFProps {
  fatura: Fatura
  pix: DadosPix
  empresa?: DadosEmpresa
  /** @deprecated use `empresa.nome` — mantido por compatibilidade */
  nomeEmpresa?: string
}

export function FaturaPDF({ fatura, pix, empresa, nomeEmpresa }: FaturaPDFProps) {
  const itens = fatura.itens ?? []
  const dadosEmpresa: DadosEmpresa = empresa ?? { nome: nomeEmpresa ?? 'Surubim Tornearia', cnpj: null, endereco: null, telefone: null }
  const temDadosPagamento = !!(pix.chave || pix.dadosBancarios)

  return (
    <ImprimirPortal>
      <div id="pdf-fatura" className="imprimir-area bg-white p-8 max-w-3xl mx-auto font-sans text-sm text-gray-800 print:p-0">
        {/* ── Cabeçalho ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6 pb-6 border-b-2 border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{dadosEmpresa.nome}</h1>
            {dadosEmpresa.cnpj && <p className="text-gray-500 text-xs mt-1">CNPJ: {dadosEmpresa.cnpj}</p>}
            {dadosEmpresa.endereco && <p className="text-gray-500 text-xs">{dadosEmpresa.endereco}</p>}
            {dadosEmpresa.telefone && <p className="text-gray-500 text-xs">Contato: {dadosEmpresa.telefone}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-blue-700 tracking-wide">FATURA CONSOLIDADA</p>
            <p className="text-gray-900 font-mono text-base font-semibold mt-0.5">{fatura.numero_fatura}</p>
            <p className="text-xs text-gray-400 mt-1">Emitida em {formatarData(fatura.created_at)}</p>
          </div>
        </div>

        {/* ── Dados do cliente ──────────────────────────────────── */}
        <div className="mb-6 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cliente</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <p><span className="text-gray-400">Nome: </span><span className="font-semibold text-gray-900">{fatura.cliente?.nome ?? '—'}</span></p>
            <p><span className="text-gray-400">CPF/CNPJ: </span><span className="text-gray-700">{fatura.cliente?.cpf_cnpj ?? '—'}</span></p>
            <p><span className="text-gray-400">Telefone: </span><span className="text-gray-700">{fatura.cliente?.telefone ?? '—'}</span></p>
            <p><span className="text-gray-400">Endereço: </span><span className="text-gray-700">{fatura.cliente?.endereco ?? '—'}</span></p>
          </div>
        </div>

        {/* ── Itens (fiados/O.S. consolidados) — código, data, descrição
            real dos serviços (não descrição genérica) e valor individual. ── */}
        <table className="w-full mb-6 border-collapse" style={{ breakInside: 'auto' }}>
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide">Código</th>
              <th className="text-center px-3 py-2 text-xs font-semibold uppercase tracking-wide">Data</th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide">Descrição</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide">Valor</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, i) => {
              const itensOS = item.fiado?.ordem_servico?.itens ?? []
              return (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ breakInside: 'avoid' }}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500 align-top border-b border-gray-100">
                    {item.fiado?.ordem_servico ? item.fiado.ordem_servico.numero : '—'}
                  </td>
                  <td className="px-3 py-2 text-center align-top border-b border-gray-100">
                    {item.fiado?.data ? formatarData(item.fiado.data) : '—'}
                  </td>
                  <td className="px-3 py-2 align-top border-b border-gray-100">
                    <span className="font-medium">{item.fiado?.descricao ?? '—'}</span>
                    {itensOS.length > 0 && (
                      <ul className="mt-0.5">
                        {itensOS.map((servicoItem, idx) => (
                          <li key={servicoItem.id ?? idx} className="text-xs text-gray-500">
                            {servicoItem.descricao}{servicoItem.quantidade > 1 ? ` (${servicoItem.quantidade}x)` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium align-top border-b border-gray-100">{formatarMoeda(item.valor)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* ── Resumo financeiro ─────────────────────────────────── */}
        <div className="flex justify-end mb-6">
          <div className="w-72 bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Valor total acumulado</span>
              <span>{formatarMoeda(fatura.valor_total)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg text-gray-900 border-t border-blue-200 pt-2 mt-1">
              <span>Valor final a pagar</span>
              <span>{formatarMoeda(fatura.valor_total)}</span>
            </div>
          </div>
        </div>

        {/* ── Dados para pagamento ──────────────────────────────── */}
        {temDadosPagamento && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 text-sm text-gray-700 space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dados para pagamento</p>
            {pix.chave && (
              <p>Chave Pix: <strong className="text-gray-900">{pix.chave}</strong>{pix.titular ? ` — ${pix.titular}` : ''}</p>
            )}
            {pix.dadosBancarios && <p className="whitespace-pre-line">{pix.dadosBancarios}</p>}
            <p className="text-xs text-gray-500 pt-1">Após o pagamento, envie o comprovante para confirmarmos o recebimento.</p>
          </div>
        )}

        {/* ── Rodapé: assinatura e termo de aceite ──────────────── */}
        <div className="pt-8 mt-4 border-t border-gray-200 text-xs text-gray-500">
          <p className="mb-10">
            Declaro estar de acordo com os valores acima e confirmo o recebimento/execução dos serviços de usinagem descritos nesta fatura.
          </p>
          <div className="flex justify-center">
            <div className="w-72 text-center">
              <div className="border-t border-gray-400 pt-1">
                {fatura.cliente?.nome ?? 'Assinatura do cliente'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ImprimirPortal>
  )
}

// Função utilitária para imprimir / guardar como PDF
export function imprimirFatura() {
  window.print()
}
