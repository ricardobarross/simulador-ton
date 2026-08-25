import { DadosExtratoCliente } from '@/lib/extrato'
import { formatarMoeda, formatarData, statusOrdem } from '@/lib/utils'
import { ImprimirPortal } from '@/components/ui/ImprimirPortal'

interface ExtratoClienteProps {
  extrato: DadosExtratoCliente
  nomeEmpresa?: string
  // Filtra a seção "Fiados pagos" pela data do pagamento — sem isso o extrato
  // mostra TODO o histórico de fiados quitados do cliente desde sempre, o que
  // mistura fechamentos antigos (já entregues/acertados) com o de agora e
  // infla o "Total já pago". Fiados em aberto e saldo devedor não são afetados
  // por este filtro — esses são sempre a situação atual, não histórico.
  pagosDe?: string
  pagosAte?: string
}

/** Data do pagamento mais recente de um fiado (usada pra decidir se ele entra
 * no período filtrado) — um fiado pago em parcelas conta pela última parcela. */
function dataUltimoPagamento(f: DadosExtratoCliente['fiados'][number]): string | null {
  const pagamentos = f.pagamentos ?? []
  if (pagamentos.length === 0) return null
  return pagamentos.reduce((maisRecente, p) => (p.data > maisRecente ? p.data : maisRecente), pagamentos[0].data)
}

export function ExtratoCliente({ extrato, nomeEmpresa = 'Surubim Tornearia', pagosDe, pagosAte }: ExtratoClienteProps) {
  const { cliente, ordensAbertas, fiados, saldoDevedorTotal, pix } = extrato
  const fiadosAbertos = fiados.filter(f => f.status !== 'quitado')
  const fiadosQuitados = fiados
    .filter(f => f.status === 'quitado')
    .filter(f => {
      if (!pagosDe && !pagosAte) return true
      const data = dataUltimoPagamento(f)
      if (!data) return true
      if (pagosDe && data < pagosDe) return false
      if (pagosAte && data > pagosAte) return false
      return true
    })
  const totalPago = fiadosQuitados.reduce((soma, f) => soma + (f.pagamentos ?? []).reduce((s, p) => s + p.valor, 0), 0)
  const hoje = new Date().toISOString()
  const periodoFiltrado = Boolean(pagosDe || pagosAte)

  return (
    <ImprimirPortal>
    <div id="pdf-extrato-cliente" className="imprimir-area bg-white p-8 max-w-3xl mx-auto font-sans text-sm text-gray-800">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{nomeEmpresa}</h1>
          <p className="text-gray-500 text-xs mt-1">Sistema de Gestão</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-blue-600">EXTRATO / FECHAMENTO DE CONTA</p>
          <p className="text-xs text-gray-400 mt-1">Emitido em {formatarData(hoje)}</p>
        </div>
      </div>

      {/* Cliente */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cliente</p>
        <p className="font-semibold text-gray-900 text-base">{cliente.nome}</p>
        {cliente.telefone && <p className="text-gray-500 text-xs">{cliente.telefone}</p>}
      </div>

      {/* O.S. em aberto */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ordens de serviço em andamento</p>
        {ordensAbertas.length === 0 ? (
          <p className="text-gray-400 text-xs">Nenhuma O.S. em andamento.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">O.S.</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Aberta em</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {ordensAbertas.map((o, i) => (
                <tr key={o.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-mono text-xs">{o.numero}</td>
                  <td className="px-3 py-2">{statusOrdem[o.status]?.label ?? o.status}</td>
                  <td className="px-3 py-2 text-center">{formatarData(o.data_abertura)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatarMoeda(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Fiados e histórico de pagamentos */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fiados em aberto</p>
        {fiadosAbertos.length === 0 ? (
          <p className="text-gray-400 text-xs">Nenhum fiado em aberto.</p>
        ) : (
          <div className="space-y-3">
            {fiadosAbertos.map(f => {
              const pago = (f.pagamentos ?? []).reduce((s, p) => s + p.valor, 0)
              const saldo = Math.max(0, f.valor_total - pago)
              const itensOS = f.ordem_servico?.itens ?? []
              return (
                <div key={f.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {f.ordem_servico ? f.ordem_servico.numero : f.descricao}
                    </span>
                    <span className="text-xs text-gray-400">{formatarData(f.data)}</span>
                  </div>
                  {/* Nome real de cada serviço da O.S., não a descrição genérica —
                      é o que o cliente precisa pra saber do que se trata cada cobrança. */}
                  {itensOS.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {itensOS.map((item, idx) => (
                        <li key={item.id ?? idx} className="text-xs text-gray-600 flex justify-between">
                          <span>{item.descricao}{item.quantidade > 1 ? ` (${item.quantidade}x)` : ''}</span>
                          <span>{formatarMoeda(item.valor_total)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between text-xs mt-1 text-gray-500">
                    <span>Total: {formatarMoeda(f.valor_total)} · Pago: {formatarMoeda(pago)}</span>
                    <span className="font-semibold text-red-600">Saldo: {formatarMoeda(saldo)}</span>
                  </div>
                  {(f.pagamentos ?? []).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
                      {f.pagamentos!.map(p => (
                        <div key={p.id} className="flex justify-between text-xs text-gray-500">
                          <span>{formatarData(p.data)} · {p.forma_pagamento ?? '—'}</span>
                          <span className="text-green-600">{formatarMoeda(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Fiados já pagos — serve de comprovante pro cliente */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Fiados pagos (comprovante)
          {periodoFiltrado && (
            <span className="normal-case font-normal text-gray-400">
              {' '}— {pagosDe ? formatarData(pagosDe) : 'início'} a {pagosAte ? formatarData(pagosAte) : 'hoje'}
            </span>
          )}
        </p>
        {fiadosQuitados.length === 0 ? (
          <p className="text-gray-400 text-xs">Nenhum fiado pago {periodoFiltrado ? 'neste período' : 'ainda'}.</p>
        ) : (
          <div className="space-y-3">
            {fiadosQuitados.map(f => {
              const itensOS = f.ordem_servico?.itens ?? []
              return (
                <div key={f.id} className="border border-green-200 bg-green-50/40 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {f.ordem_servico ? f.ordem_servico.numero : f.descricao}
                    </span>
                    <span className="text-xs font-semibold text-green-700">Quitado</span>
                  </div>
                  {itensOS.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {itensOS.map((item, idx) => (
                        <li key={item.id ?? idx} className="text-xs text-gray-600 flex justify-between">
                          <span>{item.descricao}{item.quantidade > 1 ? ` (${item.quantidade}x)` : ''}</span>
                          <span>{formatarMoeda(item.valor_total)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between text-xs mt-1 text-gray-500">
                    <span>Valor: {formatarMoeda(f.valor_total)}</span>
                  </div>
                  {(f.pagamentos ?? []).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-green-100 space-y-0.5">
                      {f.pagamentos!.map(p => (
                        <div key={p.id} className="flex justify-between text-xs text-gray-500">
                          <span>Pago em {formatarData(p.data)} · {p.forma_pagamento ?? '—'}</span>
                          <span className="text-green-600">{formatarMoeda(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Saldo total */}
      <div className="flex justify-end mb-6">
        <div className="w-64 space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Total já pago</span>
            <span className="text-green-600 font-medium">{formatarMoeda(totalPago)}</span>
          </div>
          <div className="flex justify-between font-bold text-base text-gray-900 border-t-2 border-gray-300 pt-2 mt-2">
            <span>Saldo devedor total</span>
            <span>{formatarMoeda(saldoDevedorTotal)}</span>
          </div>
        </div>
      </div>

      {/* Dados para pagamento */}
      {(pix.chave || pix.dadosBancarios) && (
        <div className="border-t border-gray-200 pt-4 text-xs text-gray-600 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Dados para pagamento</p>
          {pix.chave && <p>Chave Pix: <strong className="text-gray-800">{pix.chave}</strong>{pix.titular ? ` — ${pix.titular}` : ''}</p>}
          {pix.dadosBancarios && <p className="whitespace-pre-line">{pix.dadosBancarios}</p>}
        </div>
      )}
    </div>
    </ImprimirPortal>
  )
}

// Função utilitária para imprimir / guardar como PDF
export function imprimirExtratoCliente() {
  window.print()
}
