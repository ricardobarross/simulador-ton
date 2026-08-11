// ─── Formatação ───────────────────────────────────────────────
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

export function formatarData(data: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(data))
}

export function formatarDataHora(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(data))
}

export function formatarDocumento(doc: string): string {
  const limpo = doc.replace(/\D/g, '')
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (limpo.length === 14) {
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return doc
}

export function formatarTelefone(tel: string): string {
  const limpo = tel.replace(/\D/g, '')
  if (limpo.length === 11) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (limpo.length === 10) {
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return tel
}

// ─── Numeração automática ─────────────────────────────────────
export function gerarNumero(prefixo: string, sequencia: number): string {
  return `${prefixo}-${String(sequencia).padStart(4, '0')}`
}

// ─── Status ───────────────────────────────────────────────────
export const statusOrcamento: Record<string, { label: string; cor: string }> = {
  rascunho:  { label: 'Rascunho',  cor: 'gray'   },
  enviado:   { label: 'Enviado',   cor: 'blue'   },
  aprovado:  { label: 'Aprovado',  cor: 'green'  },
  recusado:  { label: 'Recusado',  cor: 'red'    },
  expirado:  { label: 'Expirado',  cor: 'orange' },
}

export const statusOrdem: Record<string, { label: string; cor: string }> = {
  aberta:        { label: 'Aberta',        cor: 'blue'   },
  em_andamento:  { label: 'Em andamento',  cor: 'yellow' },
  aguardando:    { label: 'Aguardando',    cor: 'orange' },
  concluida:     { label: 'Concluída',     cor: 'green'  },
  cancelada:     { label: 'Cancelada',     cor: 'red'    },
}

export const statusLancamento: Record<string, { label: string; cor: string }> = {
  pendente:   { label: 'Pendente',   cor: 'yellow' },
  pago:       { label: 'Pago',       cor: 'green'  },
  cancelado:  { label: 'Cancelado',  cor: 'red'    },
}

// ─── Misc ─────────────────────────────────────────────────────
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function truncar(texto: string, max = 40): string {
  return texto.length > max ? texto.slice(0, max) + '…' : texto
}

export function calcularTotal(itens: { valor_total: number }[]): number {
  return itens.reduce((acc, item) => acc + item.valor_total, 0)
}