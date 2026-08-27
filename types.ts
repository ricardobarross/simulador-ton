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
  cpf_cnpj?: string | null
  endereco?: string | null
  ativo: boolean
  created_at: string
  deleted_at?: string | null
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

// ─── Anexos (fotos de peças e desenhos técnicos) ─────────────
// Guardados no Supabase Storage, bucket "desenhos-e-pecas". Cada entrada aqui
// é só a referência (URL pública + metadados) — o arquivo em si vive no Storage.
export interface Anexo {
  url: string
  nome: string
  tipo: string // mime type, ex.: "image/jpeg" ou "application/pdf"
  tamanho: number // bytes
  criado_em: string
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
  anexos?: Anexo[] | null
  created_at: string
  created_by?: string | null
}

// ─── Ordens de serviço ───────────────────────────────────────
export type StatusOrdem = 'aberta' | 'em_andamento' | 'aguardando' | 'concluida' | 'cancelada'

// Uma O.S. pode ser paga em mais de uma forma (ex.: parte dinheiro, parte Pix, resto fiado).
// Quando forma === 'Cheque', os campos abaixo descrevem o cheque recebido
// (viram uma linha na tabela `cheques`).
export interface PagamentoOS {
  forma: string
  valor: number
  cheque?: {
    numero_cheque: string
    banco: string
    agencia: string
    numero_conta: string
    nome_titular: string
    telefone?: string | null
    observacoes?: string | null
  } | null
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
  anexos?: Anexo[] | null
  created_at: string
  created_by?: string | null
  deleted_at?: string | null
}

// Situação de pagamento da O.S. — independente do status dela (aberta,
// concluída, etc.). Calculada a partir dos lançamentos/fiados/cheques ligados
// à O.S., nunca guardada diretamente nela.
//   'aguardando'       → nada foi registado ainda (cliente ainda não veio pagar)
//   'pago'             → já tem lançamento(s) pago(s) cobrindo o total (sem fiado/cheque pendente)
//   'fiado_pendente'   → tem fiado em aberto/parcial ligado a esta O.S.
//   'cheque_aguardando'→ tem cheque recebido que ainda não compensou
export type SituacaoPagamentoOrdem = 'aguardando' | 'pago' | 'fiado_pendente' | 'cheque_aguardando'

// ─── Financeiro ──────────────────────────────────────────────
export type TipoLancamento = 'entrada' | 'saida'
export type StatusLancamento = 'pendente' | 'pago' | 'cancelado'
// Pra onde o dinheiro efetivamente vai/sai — derivado automaticamente da
// forma_pagamento por trigger no banco (Dinheiro → caixa; Pix/Débito/Crédito/
// Transferência → banco). Visível só pro proprietário.
export type DestinoFinanceiro = 'caixa' | 'banco'

export interface Lancamento {
  id: string
  tipo: TipoLancamento
  categoria?: string | null
  descricao: string
  valor: number
  forma_pagamento?: string | null
  destino: DestinoFinanceiro
  data: string
  status: StatusLancamento
  ordem_servico_id?: string | null
  conta_fixa_id?: string | null
  conta_variavel_id?: string | null
  observacoes?: string | null
  created_at: string
  created_by?: string | null
  deleted_at?: string | null
}

// ─── Cheques ───────────────────────────────────────────────────
// Módulo visível só pro proprietário (RLS). Um cheque nasce "aguardando"
// (não conta como dinheiro real) até ser confirmado como compensado — se
// devolvido, vira um fiado novo pro cliente que passou o cheque.
export type StatusCheque = 'aguardando' | 'compensado' | 'devolvido'

export interface Cheque {
  id: string
  numero_cheque: string
  banco: string
  agencia?: string | null
  numero_conta: string
  nome_titular: string
  cliente_id?: string | null
  cliente?: Cliente | null
  telefone?: string | null
  valor: number
  data_recebimento: string
  data_deposito?: string | null
  status: StatusCheque
  motivo_devolucao?: string | null
  ordem_servico_id?: string | null
  lancamento_id?: string | null
  fiado_id?: string | null
  observacoes?: string | null
  /** Cadastrado manualmente pra só documentar/vincular O.S. já pagas por outro meio — compensar não gera lançamento novo. */
  apenas_registro?: boolean
  /** Preenchido no front a partir de cheque_ordens_servico — só usado no cadastro manual (multi-O.S.). */
  ordens_vinculadas?: { id: string; numero: string }[] | null
  created_at: string
  created_by?: string | null
  deleted_at?: string | null
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
  data_vencimento?: string | null
  status: StatusFiado
  ordem_servico_id?: string | null
  // Presente quando o fiado está ligado a uma O.S. — usado no extrato/fatura
  // pra mostrar o nome real de cada serviço em vez da descrição genérica.
  ordem_servico?: { numero: string; itens: ItemOrcamento[] } | null
  observacoes?: string | null
  created_at: string
  created_by?: string | null
  deleted_at?: string | null
  pagamentos?: FiadoPagamento[]
}

// ─── Faturamento consolidado ("juntar notinhas") ──────────────
export type StatusFatura = 'pendente' | 'paga' | 'cancelada'

export interface FaturaItem {
  id: string
  fatura_id: string
  fiado_id: string
  valor: number
  created_at: string
  fiado?: Fiado | null
}

export interface Fatura {
  id: string
  numero_fatura: string
  cliente_id: string
  cliente?: Cliente | null
  valor_total: number
  status: StatusFatura
  forma_pagamento?: string | null
  data_pagamento?: string | null
  observacoes?: string | null
  created_at: string
  created_by?: string | null
  deleted_at?: string | null
  itens?: FaturaItem[]
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
  // Detalhamento do dia — persistido no momento do fechamento.
  total_dinheiro: number
  total_pix: number
  total_cartao: number
  total_outros: number
  total_abates_fiado: number // parte do total_dinheiro/pix/cartao que é baixa de fiado antigo, não venda nova
  total_fiado_novo: number   // vendido a prazo hoje (accrual) — ainda não é dinheiro no caixa
}

/** Detalhamento calculado pela function `resumo_fechamento_dia` no banco. */
export interface ResumoFechamentoDia {
  total_dinheiro: number
  total_pix: number
  total_cartao: number
  total_outros: number
  total_saidas: number
  total_abates_fiado: number
  total_fiado_novo: number
}

// ─── Retalhos e sobras de matéria-prima ──────────────────────
export type FormatoRetalho = 'tarugo' | 'chapa' | 'tubo' | 'barra_sextavada' | 'outro'
export type StatusRetalho = 'disponivel' | 'utilizado'

export interface Retalho {
  id: string
  material: string
  formato: FormatoRetalho
  dimensoes: string
  localizacao?: string | null
  status: StatusRetalho
  observacoes?: string | null
  created_at: string
  created_by?: string | null
  deleted_at?: string | null
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
