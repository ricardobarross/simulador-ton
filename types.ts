// ═══════════════════════════════════════════════════════════
// Tipos do sistema de gestão — Surubim Tornearia
// ═══════════════════════════════════════════════════════════

export type PapelUsuario = 'proprietario' | 'funcionario'

export interface Perfil {
  id: string
  nome: string
  telefone?: string | null
  papel: PapelUsuario
  ativo: boolean
  created_at: string
}

// ─── Clientes ───────────────────────────────────────────────
export interface Cliente {
  id: string
  nome: string
  telefone?: string | null
  ativo: boolean
  created_at: string
}

// ─── Serviços ───────────────────────────────────────────────
export type CategoriaServico = 'tornear' | 'fresar' | 'solda' | 'bancada' | 'outro'

export interface Servico {
  id: string
  nome: string
  categoria: CategoriaServico
  descricao?: string | null
  preco_base?: number | null
  ativo: boolean
  created_at: string
}

// ─── Fornecedores e transportadoras ─────────────────────────
export interface Fornecedor {
  id: string
  nome: string
  telefone?: string | null
  observacoes?: string | null
  ativo: boolean
  created_at: string
}

export interface Transportadora {
  id: string
  nome: string
  telefone?: string | null
  observacoes?: string | null
  ativo: boolean
  created_at: string
}

// ─── Contas ─────────────────────────────────────────────────
export interface ContaFixa {
  id: string
  descricao: string
  valor: number
  dia_vencimento: number
  categoria?: string | null
  ativo: boolean
  created_at: string
}

export type StatusConta = 'pendente' | 'pago' | 'cancelado'

export interface ContaVariavel {
  id: string
  descricao: string
  valor: number
  data_vencimento: string
  fornecedor_id?: string | null
  fornecedor?: Fornecedor | null
  categoria?: string | null
  status: StatusConta
  created_at: string
}

// ─── Itens de orçamento / O.S. ──────────────────────────────
export interface ItemOrcamento {
  id: string
  servico_id?: string | null
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario: number
  valor_total: number
}

// ─── Orçamentos ──────────────────────────────────────────────
export type StatusOrcamento = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expirado'

export interface Orcamento {
  id: string
  numero: string
  cliente_id: string
  cliente?: Cliente | null
  status: StatusOrcamento
  itens: ItemOrcamento[]
  subtotal: number
  desconto: number
  total: number
  validade_dias: number
  observacoes?: string | null
  created_at: string
  created_by?: string | null
}

// ─── Ordens de serviço ───────────────────────────────────────
export type StatusOrdem = 'aberta' | 'em_andamento' | 'aguardando' | 'concluida' | 'cancelada'

// Uma O.S. pode ser paga em mais de uma forma (ex.: parte dinheiro, parte Pix, resto fiado).
export interface PagamentoOS {
  forma: string
  valor: number
}

export interface OrdemServico {
  id: string
  numero: string
  orcamento_id?: string | null
  cliente_id: string
  cliente?: Cliente | null
  status: StatusOrdem
  itens: ItemOrcamento[]
  subtotal: number
  desconto: number
  total: number
  forma_pagamento?: string | null
  pagamentos?: PagamentoOS[] | null
  data_abertura: string
  data_conclusao?: string | null
  observacoes?: string | null
  created_at: string
  created_by?: string | null
}

// ─── Financeiro ──────────────────────────────────────────────
export type TipoLancamento = 'entrada' | 'saida'
export type StatusLancamento = 'pendente' | 'pago' | 'cancelado'

export interface Lancamento {
  id: string
  tipo: TipoLancamento
  categoria?: string | null
  descricao: string
  valor: number
  forma_pagamento?: string | null
  data: string
  status: StatusLancamento
  ordem_servico_id?: string | null
  conta_fixa_id?: string | null
  conta_variavel_id?: string | null
  observacoes?: string | null
  created_at: string
  created_by?: string | null
}

// ─── Fiados (vendas a prazo) ──────────────────────────────────
export type StatusFiado = 'aberto' | 'parcial' | 'quitado'

export interface FiadoPagamento {
  id: string
  fiado_id: string
  valor: number
  data: string
  forma_pagamento?: string | null
  lancamento_id?: string | null
  observacoes?: string | null
  created_at: string
  created_by?: string | null
}

export interface Fiado {
  id: string
  cliente_id: string
  cliente?: Cliente | null
  descricao: string
  valor_total: number
  data: string
  status: StatusFiado
  ordem_servico_id?: string | null
  observacoes?: string | null
  created_at: string
  created_by?: string | null
  pagamentos?: FiadoPagamento[]
}

export interface FechamentoCaixa {
  id: string
  data: string
  valor_abertura: number
  total_entradas: number
  total_saidas: number
  valor_esperado: number
  valor_contado?: number | null
  diferenca?: number | null
  observacoes?: string | null
  fechado_por?: string | null
  created_at: string
}

// ─── Configurações ───────────────────────────────────────────
export interface Configuracao {
  id: string
  chave: string
  valor?: string | null
  descricao?: string | null
  updated_at: string
}

// ─── Dashboard ────────────────────────────────────────────────
export interface ResumoGeral {
  clientes_ativos: number
  orcamentos_pendentes: number
  ordens_abertas: number
  receita_mes: number
  despesa_mes: number
  resultado_mes: number
}
