// ─── Utilizador / Auth ────────────────────────────────────────
export interface Usuario {
  id: string
  email: string
  nome: string
  cargo?: string
  avatar_url?: string
  created_at: string
}

// ─── Cliente ─────────────────────────────────────────────────
export interface Cliente {
  id: string
  nome: string
  documento?: string        // CPF ou CNPJ
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  observacoes?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

// ─── Orçamento ────────────────────────────────────────────────
export type OrcamentoStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expirado'

export interface ItemOrcamento {
  id: string
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario: number
  valor_total: number
}

export interface Orcamento {
  id: string
  numero: string
  cliente_id: string
  cliente?: Cliente
  status: OrcamentoStatus
  itens: ItemOrcamento[]
  subtotal: number
  desconto: number
  total: number
  validade_dias: number
  observacoes?: string
  created_at: string
  updated_at: string
}

// ─── Ordem de Serviço ─────────────────────────────────────────
export type OrdemStatus = 'aberta' | 'em_andamento' | 'aguardando' | 'concluida' | 'cancelada'

export interface OrdemServico {
  id: string
  numero: string
  cliente_id: string
  cliente?: Cliente
  orcamento_id?: string
  status: OrdemStatus
  descricao: string
  prazo?: string
  responsavel?: string
  valor_total: number
  observacoes?: string
  created_at: string
  updated_at: string
}

// ─── Financeiro ───────────────────────────────────────────────
export type LancamentoTipo = 'receita' | 'despesa'
export type LancamentoStatus = 'pendente' | 'pago' | 'cancelado'

export interface Lancamento {
  id: string
  tipo: LancamentoTipo
  descricao: string
  valor: number
  status: LancamentoStatus
  data_vencimento: string
  data_pagamento?: string
  categoria?: string
  cliente_id?: string
  cliente?: Cliente
  ordem_id?: string
  observacoes?: string
  created_at: string
}

// ─── Simulador TON ────────────────────────────────────────────
export type ModoSimulador = 'cobrar' | 'receber'
export type BandeiraCartao = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard'

export interface TaxaTon {
  bandeira: BandeiraCartao
  parcelas: number
  taxa: number
}

// ─── Dashboard / Relatórios ───────────────────────────────────
export interface ResumoMensal {
  mes: string
  receitas: number
  despesas: number
  resultado: number
}

export interface ResumoGeral {
  clientes_ativos: number
  orcamentos_pendentes: number
  ordens_abertas: number
  receita_mes: number
  despesa_mes: number
  resultado_mes: number
}