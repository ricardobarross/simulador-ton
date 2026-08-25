import { Fiado, Orcamento, OrdemServico, Fatura } from '@/types'
import { DadosExtratoCliente } from '@/lib/extrato'
import { diasEmAtraso } from '@/lib/cobranca'
import { formatarMoeda, formatarData } from '@/lib/utils'

/**
 * Normaliza um telefone brasileiro para o formato que o wa.me espera
 * (código do país + DDD + número, só dígitos). Retorna `null` se não
 * houver telefone válido.
 */
export function telefoneParaWhatsapp(telefone?: string | null): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10) return null
  return digitos.startsWith('55') ? digitos : `55${digitos}`
}

/** Monta o link `https://wa.me/...` pronto para abrir, ou `null` se não houver telefone. */
export function linkWhatsapp(telefone: string | null | undefined, mensagem: string): string | null {
  const numero = telefoneParaWhatsapp(telefone)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}

/** Abre a conversa no WhatsApp numa nova aba. Retorna `false` se o cliente não tiver telefone. */
export function abrirWhatsapp(telefone: string | null | undefined, mensagem: string): boolean {
  const link = linkWhatsapp(telefone, mensagem)
  if (!link) return false
  window.open(link, '_blank', 'noopener,noreferrer')
  return true
}

function primeiroNome(nomeCompleto?: string | null): string {
  return (nomeCompleto ?? '').split(' ')[0] || 'Cliente'
}

// ─── Mensagens formatadas ──────────────────────────────────────

/** Recibo de abate/pagamento de fiado — para enviar logo após registar um pagamento. */
export function mensagemReciboFiado(fiado: Fiado, valorPago: number, saldoApos: number): string {
  const nome = primeiroNome(fiado.cliente?.nome)
  const linhaSaldo = saldoApos > 0.01
    ? `Saldo restante: ${formatarMoeda(saldoApos)}.`
    : 'Fiado quitado — obrigado! ✅'
  return `Olá, ${nome}! Aqui é da Surubim Tornearia. Confirmamos o recebimento de ${formatarMoeda(valorPago)} referente a "${fiado.descricao}". ${linhaSaldo}`
}

/** Resumo de orçamento com os itens e total, para pedir aprovação rápida por WhatsApp. */
export function mensagemResumoOrcamento(orcamento: Orcamento): string {
  const nome = primeiroNome(orcamento.cliente?.nome)
  const linhasItens = orcamento.itens
    .map(i => `• ${i.descricao} (${i.quantidade} ${i.unidade}) — ${formatarMoeda(i.valor_total)}`)
    .join('\n')
  const linhaDesconto = orcamento.desconto > 0 ? `\nDesconto: -${formatarMoeda(orcamento.desconto)}` : ''
  return `Olá, ${nome}! Aqui é da Surubim Tornearia. Segue o orçamento ${orcamento.numero}:\n\n${linhasItens}${linhaDesconto}\n\n*Total: ${formatarMoeda(orcamento.total)}*\nVálido por ${orcamento.validade_dias} dias.\n\nPode confirmar a aprovação para seguirmos com o serviço?`
}

/** Resumo de O.S. com os itens, total e forma de pagamento, para envio/aprovação por WhatsApp. */
export function mensagemResumoOrdemServico(ordem: OrdemServico): string {
  const nome = primeiroNome(ordem.cliente?.nome)
  const linhasItens = ordem.itens
    .map(i => `• ${i.descricao} (${i.quantidade} ${i.unidade}) — ${formatarMoeda(i.valor_total)}`)
    .join('\n')
  const linhaDesconto = ordem.desconto > 0 ? `\nDesconto: -${formatarMoeda(ordem.desconto)}` : ''
  const linhaPagamento = ordem.forma_pagamento ? `\nPagamento: ${ordem.forma_pagamento}` : ''
  return `Olá, ${nome}! Aqui é da Surubim Tornearia. Segue o resumo da Ordem de Serviço ${ordem.numero}:\n\n${linhasItens}${linhaDesconto}\n\n*Total: ${formatarMoeda(ordem.total)}*${linhaPagamento}\n\nQualquer dúvida, estamos à disposição!`
}

/** Aviso de que a O.S. está pronta para retirada. */
export function mensagemOrdemPronta(ordem: OrdemServico): string {
  const nome = primeiroNome(ordem.cliente?.nome)
  return `Olá, ${nome}! Aqui é da Surubim Tornearia. Seu serviço (O.S. ${ordem.numero}) já está pronto para retirada. Valor total: ${formatarMoeda(ordem.total)}. Qualquer dúvida, estamos à disposição!`
}

/** Cobrança de um fiado vencido — usada na régua de cobrança do Financeiro. */
export function mensagemCobrancaFiado(fiado: Fiado, saldo: number): string {
  const nome = primeiroNome(fiado.cliente?.nome)
  const atraso = diasEmAtraso(fiado)
  const linhaAtraso = atraso > 0 ? ` (${atraso} ${atraso === 1 ? 'dia' : 'dias'} em atraso)` : ''
  return `Olá, ${nome}! Aqui é da Surubim Tornearia. Passando pra lembrar do fiado em aberto referente a "${fiado.descricao}"${linhaAtraso}. Saldo devedor: ${formatarMoeda(saldo)}. Pode nos avisar quando conseguir regularizar? Qualquer dúvida, estamos à disposição!`
}

/** Fatura consolidada (várias notinhas juntas). Como o wa.me só manda texto (não
 * anexa arquivo), a mensagem já traz o resumo completo — o PDF é baixado à parte
 * pelo botão "Imprimir / Guardar PDF" e pode ser anexado manualmente se preciso. */
export function mensagemFatura(fatura: Fatura): string {
  const nome = primeiroNome(fatura.cliente?.nome)
  const itens = fatura.itens ?? []
  const linhas = itens.length > 0
    ? itens.map(i => `• ${i.fiado?.descricao ?? 'Fiado'} — ${formatarMoeda(i.valor)}`).join('\n')
    : null
  const partes = [`Olá, ${nome}! Aqui é da Surubim Tornearia. Segue a fatura consolidada ${fatura.numero_fatura}:`]
  if (linhas) partes.push(`\n${linhas}`)
  partes.push(`\n*Total: ${formatarMoeda(fatura.valor_total)}*`)
  partes.push(`\nO PDF detalhado segue em anexo. Qualquer dúvida, estamos à disposição!`)
  return partes.join('\n')
}

/** Extrato/fechamento de conta consolidado — O.S. em aberto, fiados e saldo total, pronto pra mandar por WhatsApp. */
/** Identificação de um fiado pro cliente: número da O.S. + nomes reais dos
 * serviços quando disponíveis, ou a descrição genérica como último recurso. */
function identificacaoFiado(f: Fiado): string {
  if (!f.ordem_servico) return f.descricao
  const nomesServicos = (f.ordem_servico.itens ?? []).map(i => i.descricao).join(', ')
  return nomesServicos ? `O.S. ${f.ordem_servico.numero} — ${nomesServicos}` : `O.S. ${f.ordem_servico.numero}`
}

/** Data do pagamento mais recente de um fiado — usada pra filtrar por período. */
function dataUltimoPagamento(f: Fiado): string | null {
  const pagamentos = f.pagamentos ?? []
  if (pagamentos.length === 0) return null
  return pagamentos.reduce((maisRecente, p) => (p.data > maisRecente ? p.data : maisRecente), pagamentos[0].data)
}

export function mensagemExtratoCliente(extrato: DadosExtratoCliente, pagosDe?: string, pagosAte?: string): string {
  const nome = primeiroNome(extrato.cliente.nome)
  const linhasOS = extrato.ordensAbertas.length > 0
    ? extrato.ordensAbertas.map(o => `• O.S. ${o.numero} — ${formatarMoeda(o.total)}`).join('\n')
    : null
  const fiadosAbertos = extrato.fiados.filter(f => f.status !== 'quitado')
  const linhasFiados = fiadosAbertos.length > 0
    ? fiadosAbertos.map(f => {
        const pago = (f.pagamentos ?? []).reduce((s, p) => s + p.valor, 0)
        const saldo = Math.max(0, f.valor_total - pago)
        return `• ${identificacaoFiado(f)} (${formatarData(f.data)}) — saldo ${formatarMoeda(saldo)}`
      }).join('\n')
    : null
  // Sem filtro de data, "Fiados pagos" mostraria TODO o histórico do cliente,
  // misturando fechamentos antigos já entregues com o de agora — por isso
  // filtramos pela data do último pagamento quando pagosDe/pagosAte é passado.
  const fiadosQuitados = extrato.fiados
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
  const linhasPagos = fiadosQuitados.length > 0
    ? fiadosQuitados.map(f => {
        const ultimoPagamento = (f.pagamentos ?? []).slice().sort((a, b) => a.data.localeCompare(b.data)).pop()
        const dataForma = ultimoPagamento ? ` — pago em ${formatarData(ultimoPagamento.data)} (${ultimoPagamento.forma_pagamento ?? '—'})` : ''
        return `• ${identificacaoFiado(f)} — ${formatarMoeda(f.valor_total)}${dataForma}`
      }).join('\n')
    : null

  const partes = [`Olá, ${nome}! Aqui é da Surubim Tornearia. Segue o resumo da sua conta:`]
  if (linhasOS) partes.push(`\n*Serviços em andamento:*\n${linhasOS}`)
  if (linhasFiados) partes.push(`\n*Fiados em aberto:*\n${linhasFiados}`)
  if (linhasPagos) partes.push(`\n*Fiados pagos (comprovante):*\n${linhasPagos}\n_Total já pago: ${formatarMoeda(totalPago)}_`)
  partes.push(`\n*Saldo devedor total: ${formatarMoeda(extrato.saldoDevedorTotal)}*`)
  if (extrato.pix.chave) {
    partes.push(`\nPara pagar via Pix:\nChave: ${extrato.pix.chave}${extrato.pix.titular ? `\nTitular: ${extrato.pix.titular}` : ''}`)
  }
  return partes.join('\n')
}
