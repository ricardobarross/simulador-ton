import { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { registrarPagamentoOrdem } from '@/lib/financeiro'
import { formatarMoeda } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════
// Pendências financeiras (contas a pagar + fiado vencido) — usado tanto no
// resumo automático de abertura do chat quanto na ferramenta
// consultar_pendencias (pra quando a pessoa pergunta de novo no meio da
// conversa). Uma única fonte de verdade pros dois lugares.
// ═══════════════════════════════════════════════════════════

interface ItemPendente {
  id: string
  descricao: string
  valor: number
  /** Negativo = já venceu há X dias. Zero = vence hoje. Positivo = faltam X dias. */
  dias: number
}

interface ClienteVencido {
  cliente_nome: string
  valor: number
  /** Dias de atraso (sempre positivo). */
  dias: number
}

export interface Pendencias {
  contasFixasPendentes: ItemPendente[]
  contasVariaveisPendentes: ItemPendente[]
  clientesVencidos: ClienteVencido[]
  totalAPagarPendente: number
  totalAPagarVencido: number
  totalAReceberAberto: number
  totalAReceberVencido: number
}

function parseDataISO(data: string): Date {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function dataZerada(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Diferença em dias inteiros de `a` até `b` (b - a). Positivo = b é depois de a. */
function diasEntre(a: Date, b: Date): number {
  const MS_DIA = 86400000
  return Math.round((dataZerada(b).getTime() - dataZerada(a).getTime()) / MS_DIA)
}

/** Próxima data de vencimento de uma conta fixa dentro do mês atual (clampada ao último dia, ex.: dia 31 em fevereiro). */
function proximoVencimentoFixa(diaVencimento: number, hoje: Date): Date {
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  return new Date(hoje.getFullYear(), hoje.getMonth(), Math.min(diaVencimento, ultimoDiaMes))
}

export async function buscarPendencias(supabase: SupabaseClient): Promise<Pendencias> {
  const hoje = new Date()
  const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const fimMesData = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  const fimMes = `${fimMesData.getFullYear()}-${String(fimMesData.getMonth() + 1).padStart(2, '0')}-${String(fimMesData.getDate()).padStart(2, '0')}`

  const [fixasRes, lancsFixasRes, variaveisRes, fiadosRes] = await Promise.all([
    supabase.from('contas_fixas').select('id, descricao, valor, dia_vencimento').eq('ativo', true),
    supabase.from('lancamentos').select('conta_fixa_id').eq('status', 'pago').is('deleted_at', null).not('conta_fixa_id', 'is', null).gte('data', inicioMes).lte('data', fimMes),
    supabase.from('contas_variaveis').select('id, descricao, valor, data_vencimento').eq('status', 'pendente'),
    supabase.from('fiados').select('valor_total, data_vencimento, cliente:clientes(nome), pagamentos:fiado_pagamentos(valor)').is('deleted_at', null).neq('status', 'quitado'),
  ])

  const pagasIds = new Set((lancsFixasRes.data ?? []).map((l: { conta_fixa_id: string }) => l.conta_fixa_id))
  const contasFixasPendentes: ItemPendente[] = (fixasRes.data ?? [])
    .filter((f: { id: string }) => !pagasIds.has(f.id))
    .map((f: { id: string; descricao: string; valor: number; dia_vencimento: number }) => ({
      id: f.id,
      descricao: f.descricao,
      valor: f.valor,
      dias: diasEntre(hoje, proximoVencimentoFixa(f.dia_vencimento, hoje)),
    }))
    .sort((a: ItemPendente, b: ItemPendente) => a.dias - b.dias)

  const contasVariaveisPendentes: ItemPendente[] = (variaveisRes.data ?? [])
    .map((v: { id: string; descricao: string; valor: number; data_vencimento: string }) => ({
      id: v.id,
      descricao: v.descricao,
      valor: v.valor,
      dias: diasEntre(hoje, parseDataISO(v.data_vencimento)),
    }))
    .sort((a: ItemPendente, b: ItemPendente) => a.dias - b.dias)

  type FiadoLinha = {
    valor_total: number
    data_vencimento: string | null
    cliente: { nome: string } | { nome: string }[] | null
    pagamentos: { valor: number }[] | null
  }
  const abertos = ((fiadosRes.data ?? []) as FiadoLinha[]).map(f => {
    const pago = (f.pagamentos ?? []).reduce((s, p) => s + p.valor, 0)
    const saldo = Math.max(0, f.valor_total - pago)
    const cliente = Array.isArray(f.cliente) ? f.cliente[0] : f.cliente
    return { cliente_nome: cliente?.nome ?? 'Cliente', saldo, data_vencimento: f.data_vencimento }
  }).filter(f => f.saldo > 0.005)

  const totalAReceberAberto = abertos.reduce((s, f) => s + f.saldo, 0)

  const porCliente = new Map<string, { valor: number; diasMax: number }>()
  abertos
    .filter(f => f.data_vencimento && parseDataISO(f.data_vencimento) < dataZerada(hoje))
    .forEach(f => {
      const dias = diasEntre(parseDataISO(f.data_vencimento as string), hoje)
      const atual = porCliente.get(f.cliente_nome) ?? { valor: 0, diasMax: 0 }
      porCliente.set(f.cliente_nome, { valor: atual.valor + f.saldo, diasMax: Math.max(atual.diasMax, dias) })
    })
  const clientesVencidos: ClienteVencido[] = Array.from(porCliente.entries())
    .map(([cliente_nome, v]) => ({ cliente_nome, valor: v.valor, dias: v.diasMax }))
    .sort((a, b) => b.dias - a.dias)
  const totalAReceberVencido = clientesVencidos.reduce((s, c) => s + c.valor, 0)

  const todasContas = [...contasFixasPendentes, ...contasVariaveisPendentes]
  const totalAPagarPendente = todasContas.reduce((s, c) => s + c.valor, 0)
  const totalAPagarVencido = todasContas.filter(c => c.dias < 0).reduce((s, c) => s + c.valor, 0)

  return { contasFixasPendentes, contasVariaveisPendentes, clientesVencidos, totalAPagarPendente, totalAPagarVencido, totalAReceberAberto, totalAReceberVencido }
}

/**
 * Monta o texto do resumo automático mostrado assim que a secretária é aberta
 * — não passa pela IA (é montado direto com os dados reais), justamente pra
 * garantir que os valores e prazos nunca saiam errados ou inventados.
 */
export function formatarBriefingInicial(p: Pendencias): string {
  const todasContas = [...p.contasFixasPendentes, ...p.contasVariaveisPendentes].sort((a, b) => a.dias - b.dias)
  const vencidas = todasContas.filter(c => c.dias < 0)
  const aVencer = todasContas.filter(c => c.dias >= 0)

  const blocoContas: string[] = []
  if (vencidas.length === 0 && aVencer.length === 0) {
    blocoContas.push('Contas a pagar: nada pendente no momento.')
  } else {
    const linhas: string[] = []
    if (vencidas.length > 0) {
      linhas.push(`${vencidas.length} conta(s) já vencida(s) (${formatarMoeda(vencidas.reduce((s, c) => s + c.valor, 0))}):`)
      vencidas.forEach(c => linhas.push(`  • ${c.descricao} — ${formatarMoeda(c.valor)}, venceu há ${Math.abs(c.dias)} dia${Math.abs(c.dias) === 1 ? '' : 's'}`))
    }
    if (aVencer.length > 0) {
      linhas.push(`${vencidas.length > 0 ? 'Ainda faltam pagar' : 'Faltam pagar'}:`)
      aVencer.slice(0, 5).forEach(c => linhas.push(`  • ${c.descricao} — ${formatarMoeda(c.valor)}, ${c.dias === 0 ? 'vence hoje' : `faltam ${c.dias} dia${c.dias === 1 ? '' : 's'}`}`))
      if (aVencer.length > 5) linhas.push(`  ...e mais ${aVencer.length - 5}.`)
    }
    blocoContas.push(`Contas a pagar:\n${linhas.join('\n')}`)
  }

  const blocoFiado: string[] = []
  if (p.clientesVencidos.length === 0) {
    blocoFiado.push('Fiado: ninguém com pagamento atrasado.')
  } else {
    const linhas = [`${p.clientesVencidos.length} cliente(s) com fiado vencido (${formatarMoeda(p.totalAReceberVencido)} no total):`]
    p.clientesVencidos.slice(0, 5).forEach(c => linhas.push(`  • ${c.cliente_nome} — ${formatarMoeda(c.valor)}, atrasado há ${c.dias} dia${c.dias === 1 ? '' : 's'}`))
    if (p.clientesVencidos.length > 5) linhas.push(`  ...e mais ${p.clientesVencidos.length - 5}.`)
    blocoFiado.push(`Fiado vencido:\n${linhas.join('\n')}`)
  }

  return [...blocoContas, ...blocoFiado].join('\n\n')
}

// ═══════════════════════════════════════════════════════════
// Ferramentas da secretária IA — schema (formato OpenAI/Groq function-calling)
// ═══════════════════════════════════════════════════════════
export const ferramentasSecretaria = [
  {
    type: 'function',
    function: {
      name: 'buscar_clientes',
      description: 'Procura clientes já cadastrados pelo nome (ou parte do nome). Usa isto antes de criar um cliente novo, para não duplicar.',
      parameters: {
        type: 'object',
        properties: { nome: { type: 'string', description: 'Nome ou parte do nome a procurar' } },
        required: ['nome'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_cliente',
      description: 'Cadastra um cliente novo com nome e telefone.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          telefone: { type: 'string', description: 'Telefone do cliente, se souber' },
        },
        required: ['nome'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_servicos',
      description: 'Lista o catálogo de serviços da oficina (tornear, fresar, solda, bancada) com preço base, quando existir.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_orcamento',
      description: 'Cria um orçamento para um cliente com uma lista de itens (serviços/produtos).',
      parameters: {
        type: 'object',
        properties: {
          cliente_id: { type: 'string' },
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                descricao: { type: 'string' },
                quantidade: { type: 'number' },
                unidade: { type: 'string', description: 'Ex: un, hora, kg, m' },
                valor_unitario: { type: 'number' },
              },
              required: ['descricao', 'quantidade', 'valor_unitario'],
            },
          },
          desconto: { type: 'number', description: 'Desconto em reais, opcional' },
          validade_dias: { type: 'number', description: 'Validade do orçamento em dias, padrão 30' },
          observacoes: { type: 'string' },
        },
        required: ['cliente_id', 'itens'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_ordem_servico',
      description: 'Cria uma ordem de serviço diretamente (sem passar por orçamento) para um cliente que já autorizou o serviço. NÃO pergunte forma de pagamento aqui — a O.S. entra "aguardando pagamento" e o pagamento só é registrado depois, quando o cliente vier buscar e pagar de fato (aí sim, use registrar_pagamento_os).',
      parameters: {
        type: 'object',
        properties: {
          cliente_id: { type: 'string' },
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                descricao: { type: 'string' },
                quantidade: { type: 'number' },
                unidade: { type: 'string' },
                valor_unitario: { type: 'number' },
              },
              required: ['descricao', 'quantidade', 'valor_unitario'],
            },
          },
          desconto: { type: 'number' },
          observacoes: { type: 'string' },
        },
        required: ['cliente_id', 'itens'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_pagamento_os',
      description: 'Registra o pagamento de uma ordem de serviço quando o cliente vem buscar e paga de fato — pode ser numa forma diferente da combinada antes, e pode vir dividido entre formas (ex.: metade dinheiro, metade pix). Use buscar_ordens_servico antes para achar o ordem_id e confirmar o total. Cada O.S. só pode ter o pagamento registrado uma vez. Para pagamento em cheque, não use esta ferramenta — oriente a pessoa a usar o botão "Registar pagamento" na tela de Ordens de Serviço, que tem o formulário certo pra anotar os dados do cheque.',
      parameters: {
        type: 'object',
        properties: {
          ordem_id: { type: 'string' },
          forma_pagamento: { type: 'string', description: 'Use quando o pagamento é numa única forma: Dinheiro, Pix, Débito, Crédito, Transferência ou Fiado' },
          pagamentos: {
            type: 'array',
            description: 'Use no lugar de forma_pagamento quando o pagamento foi dividido em mais de uma forma. A soma dos valores precisa ser igual ao total da O.S.',
            items: {
              type: 'object',
              properties: {
                forma: { type: 'string', description: 'Dinheiro, Pix, Débito, Crédito, Transferência ou Fiado' },
                valor: { type: 'number' },
              },
              required: ['forma', 'valor'],
            },
          },
        },
        required: ['ordem_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_lancamento',
      description: 'Registra um lançamento financeiro (entrada ou saída de dinheiro do caixa). IMPORTANTE: confirma sempre com a pessoa se é entrada (dinheiro que entrou) ou saída (dinheiro que saiu) antes de chamar esta ferramenta — nunca adivinhe.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['entrada', 'saida'] },
          descricao: { type: 'string' },
          valor: { type: 'number' },
          categoria: { type: 'string' },
          forma_pagamento: { type: 'string', description: 'Dinheiro, Pix, Débito, Crédito ou Transferência' },
          data: { type: 'string', description: 'Data no formato AAAA-MM-DD. Se não informado, usa hoje.' },
        },
        required: ['tipo', 'descricao', 'valor'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_lancamentos',
      description: 'Procura lançamentos já registrados (por descrição/categoria e opcionalmente uma data) pra achar o lancamento_id certo antes de editar ou excluir. Use SEMPRE antes de editar_lancamento ou excluir_lancamento — nunca adivinhe o id.',
      parameters: {
        type: 'object',
        properties: {
          busca: { type: 'string', description: 'Palavra da descrição ou categoria, ex: "aluguel"' },
          data: { type: 'string', description: 'Data no formato AAAA-MM-DD, se souber' },
        },
        required: ['busca'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editar_lancamento',
      description: 'Corrige um lançamento que já existe (valor, descrição, categoria, forma de pagamento, data ou estado errados) — USE ISTO pra "consertar"/"corrigir" um lançamento, nunca crie um lançamento novo pra corrigir um antigo. Ache o lancamento_id certo com buscar_lancamentos primeiro e confirme com a pessoa qual é antes de alterar. Só manda os campos que realmente mudaram.',
      parameters: {
        type: 'object',
        properties: {
          lancamento_id: { type: 'string' },
          descricao: { type: 'string' },
          valor: { type: 'number' },
          categoria: { type: 'string' },
          forma_pagamento: { type: 'string', description: 'Dinheiro, Pix, Débito, Crédito ou Transferência' },
          data: { type: 'string', description: 'Data no formato AAAA-MM-DD' },
        },
        required: ['lancamento_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'excluir_lancamento',
      description: 'Exclui um lançamento (ex.: foi lançado errado/duplicado e a pessoa quer apagar em vez de corrigir). Ache o lancamento_id certo com buscar_lancamentos primeiro e confirme com a pessoa qual é antes de apagar.',
      parameters: {
        type: 'object',
        properties: { lancamento_id: { type: 'string' } },
        required: ['lancamento_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_fiado',
      description: 'Anota que um cliente ficou devendo (comprou fiado, "no caderno", vai pagar depois). Use isto quando a pessoa disser algo como "fulano ficou devendo X", "anota aí pro fulano", "vendi fiado pro fulano". Procure o cliente primeiro com buscar_clientes.',
      parameters: {
        type: 'object',
        properties: {
          cliente_id: { type: 'string' },
          descricao: { type: 'string', description: 'O que foi vendido ou o motivo do fiado' },
          valor_total: { type: 'number' },
          data: { type: 'string', description: 'Data no formato AAAA-MM-DD. Se não informado, usa hoje.' },
        },
        required: ['cliente_id', 'descricao', 'valor_total'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_fiados_cliente',
      description: 'Consulta quanto um cliente está devendo (fiados em aberto ou parciais) e o histórico. Use antes de registrar um pagamento, para confirmar o saldo devedor com a pessoa.',
      parameters: {
        type: 'object',
        properties: { cliente_id: { type: 'string' } },
        required: ['cliente_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'receber_pagamento_fiado',
      description: 'Registra que um cliente pagou (total ou parcialmente) um fiado em aberto. Use buscar_fiados_cliente antes para saber o fiado_id e o saldo devedor correto. Também lança automaticamente uma entrada no caixa do dia.',
      parameters: {
        type: 'object',
        properties: {
          fiado_id: { type: 'string' },
          valor: { type: 'number' },
          forma_pagamento: { type: 'string', description: 'Dinheiro, Pix, Débito, Crédito ou Transferência' },
          data: { type: 'string', description: 'Data no formato AAAA-MM-DD. Se não informado, usa hoje.' },
        },
        required: ['fiado_id', 'valor'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_ordens_servico',
      description: 'Procura ordens de serviço por número, nome do cliente ou estado.',
      parameters: {
        type: 'object',
        properties: {
          numero: { type: 'string' },
          cliente_nome: { type: 'string' },
          status: { type: 'string', enum: ['aberta', 'em_andamento', 'aguardando', 'concluida', 'cancelada'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'marcar_ordem_pronta',
      description: 'Marca uma ordem de serviço como concluída e devolve uma mensagem pronta para avisar o cliente no WhatsApp. Isso NÃO registra pagamento — só muda o status do serviço pra "pronto pra retirada". Quando o cliente vier buscar e pagar, use registrar_pagamento_os.',
      parameters: {
        type: 'object',
        properties: { ordem_id: { type: 'string' } },
        required: ['ordem_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_pendencias',
      description: 'Reconsulta contas a pagar pendentes (dias até vencer/vencidas) e clientes com fiado vencido. Use se perguntarem de novo depois da abertura, tipo "o que falta pagar essa semana" ou "tem fiado atrasado".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analisar_saude_financeira',
      description: 'Traz o DRE (mês atual e anterior) mais contas a pagar/receber (total e vencido) pra você analisar a saúde financeira e dar conselhos. Use em pedidos de "análise financeira" ou "como tá a saúde da empresa". Só use os números que vierem daqui, nunca invente.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fechar_caixa',
      description: 'Fecha (ou atualiza) o caixa do dia. As entradas e saídas já pagas de hoje são somadas automaticamente — você só precisa perguntar à pessoa o valor de abertura do caixa e quanto ela contou fisicamente na gaveta agora. Use isto quando a pessoa disser algo como "quero fechar o caixa", "vamos fechar o caixa hoje", "bater o caixa".',
      parameters: {
        type: 'object',
        properties: {
          valor_abertura: { type: 'number', description: 'Valor (troco) que tinha no caixa no início do dia' },
          valor_contado: { type: 'number', description: 'Valor que a pessoa contou fisicamente no caixa agora' },
          observacoes: { type: 'string' },
        },
        required: ['valor_abertura', 'valor_contado'],
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════
// Execução das ferramentas — roda no browser, respeita RLS do usuário logado
// ═══════════════════════════════════════════════════════════
type ItemEntrada = { descricao: string; quantidade: number; unidade?: string; valor_unitario: number }

function normalizarItens(itens: ItemEntrada[]) {
  return itens.map(i => ({
    id: crypto.randomUUID(),
    descricao: i.descricao,
    quantidade: i.quantidade,
    unidade: i.unidade ?? 'un',
    valor_unitario: i.valor_unitario,
    valor_total: i.quantidade * i.valor_unitario,
  }))
}

export async function executarFerramenta(nome: string, args: Record<string, unknown>): Promise<unknown> {
  const supabase = createClient()

  switch (nome) {
    case 'buscar_clientes': {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, telefone')
        .ilike('nome', `%${args.nome}%`)
        .eq('ativo', true)
        .is('deleted_at', null)
        .limit(10)
      if (error) return { erro: error.message }
      return { clientes: data }
    }

    case 'criar_cliente': {
      const { data, error } = await supabase
        .from('clientes')
        .insert({ nome: args.nome, telefone: args.telefone ?? null })
        .select()
        .single()
      if (error) return { erro: error.message }
      return { cliente: data }
    }

    case 'listar_servicos': {
      const { data, error } = await supabase
        .from('servicos')
        .select('id, nome, categoria, preco_base')
        .eq('ativo', true)
        .order('categoria')
      if (error) return { erro: error.message }
      return { servicos: data }
    }

    case 'criar_orcamento': {
      const itens = normalizarItens((args.itens as ItemEntrada[]) ?? [])
      const subtotal = itens.reduce((s, i) => s + i.valor_total, 0)
      const desconto = (args.desconto as number) ?? 0
      const { data, error } = await supabase
        .from('orcamentos')
        .insert({
          cliente_id: args.cliente_id,
          itens,
          subtotal,
          desconto,
          total: subtotal - desconto,
          validade_dias: (args.validade_dias as number) ?? 30,
          observacoes: (args.observacoes as string) ?? null,
        })
        .select()
        .single()
      if (error) return { erro: error.message }
      return { orcamento: data }
    }

    case 'criar_ordem_servico': {
      const itens = normalizarItens((args.itens as ItemEntrada[]) ?? [])
      const subtotal = itens.reduce((s, i) => s + i.valor_total, 0)
      const desconto = (args.desconto as number) ?? 0
      const total = subtotal - desconto

      // Sem forma de pagamento aqui — o cliente já autorizou o serviço, o pagamento
      // só é registrado depois (registrar_pagamento_os), quando ele vier buscar.
      const { data, error } = await supabase
        .from('ordens_servico')
        .insert({
          cliente_id: args.cliente_id,
          itens,
          subtotal,
          desconto,
          total,
          observacoes: (args.observacoes as string) ?? null,
        })
        .select('*, cliente:clientes(nome)')
        .single()
      if (error) return { erro: error.message }

      return {
        ordem_servico: data,
        aviso: 'Criada como "aguardando pagamento" — nada foi lançado no Financeiro ainda. Quando o cliente vier buscar e pagar, use registrar_pagamento_os.',
      }
    }

    case 'registrar_pagamento_os': {
      const { data: ordem, error: erroOrdem } = await supabase
        .from('ordens_servico')
        .select('id, numero, total, cliente:clientes(nome)')
        .eq('id', args.ordem_id)
        .is('deleted_at', null)
        .single()
      if (erroOrdem || !ordem) return { erro: erroOrdem?.message ?? 'Ordem de serviço não encontrada.' }

      const pagamentosArg = args.pagamentos as { forma: string; valor: number }[] | undefined
      if (!args.forma_pagamento && !pagamentosArg?.length) {
        return { erro: 'Preciso saber a forma de pagamento (ou como foi dividido) antes de registrar. Pergunte à pessoa.' }
      }
      if (pagamentosArg?.length) {
        const soma = pagamentosArg.reduce((s, p) => s + (Number(p.valor) || 0), 0)
        if (Math.round((soma - ordem.total) * 100) !== 0) {
          return { erro: `A soma dos pagamentos (${soma}) não bate com o total da O.S. (${ordem.total}). Confirme os valores com a pessoa.` }
        }
      }
      const pagamentosFinal = pagamentosArg?.length ? pagamentosArg : [{ forma: args.forma_pagamento as string, valor: ordem.total }]

      if (pagamentosFinal.some(p => p.forma === 'Cheque')) {
        return { erro: 'Pagamento em cheque precisa dos dados do cheque (número, banco, conta, titular) — não dá pra fazer por aqui. Oriente a pessoa a usar o botão "Registar pagamento" na tela de Ordens de Serviço.' }
      }

      const resultado = await registrarPagamentoOrdem(supabase, args.ordem_id as string, pagamentosFinal)
      if (!resultado.ok) return { erro: resultado.erro }

      const cliente = Array.isArray(ordem.cliente) ? ordem.cliente[0] : ordem.cliente
      return {
        confirmado: true,
        ordem_numero: ordem.numero,
        cliente_nome: cliente?.nome,
        valor_total: ordem.total,
        aviso: pagamentosFinal.some(p => p.forma === 'Fiado')
          ? 'A parte em fiado entrou como conta a receber do cliente.'
          : undefined,
      }
    }

    case 'registrar_lancamento': {
      const { data, error } = await supabase
        .from('lancamentos')
        .insert({
          tipo: args.tipo,
          descricao: args.descricao,
          valor: args.valor,
          categoria: (args.categoria as string) ?? null,
          forma_pagamento: (args.forma_pagamento as string) ?? 'Dinheiro',
          data: (args.data as string) ?? new Date().toISOString().slice(0, 10),
          status: 'pago',
        })
        .select()
        .single()
      if (error) return { erro: error.message }
      return { lancamento: data }
    }

    case 'buscar_lancamentos': {
      let query = supabase
        .from('lancamentos')
        .select('id, tipo, descricao, categoria, valor, forma_pagamento, data, status')
        .is('deleted_at', null)
        .or(`descricao.ilike.%${args.busca}%,categoria.ilike.%${args.busca}%`)
        .order('data', { ascending: false })
        .limit(15)
      if (args.data) query = query.eq('data', args.data as string)
      const { data, error } = await query
      if (error) return { erro: error.message }
      return { lancamentos: data }
    }

    case 'editar_lancamento': {
      const dados: Record<string, unknown> = {}
      if (args.descricao !== undefined) dados.descricao = args.descricao
      if (args.valor !== undefined) dados.valor = args.valor
      if (args.categoria !== undefined) dados.categoria = args.categoria
      if (args.forma_pagamento !== undefined) dados.forma_pagamento = args.forma_pagamento
      if (args.data !== undefined) dados.data = args.data
      if (Object.keys(dados).length === 0) return { erro: 'Nenhum campo pra alterar foi informado.' }

      const { data, error } = await supabase
        .from('lancamentos')
        .update(dados)
        .eq('id', args.lancamento_id)
        .is('deleted_at', null)
        .select()
        .single()
      if (error) return { erro: error.message }
      return { lancamento: data, confirmado: true }
    }

    case 'excluir_lancamento': {
      const { data, error } = await supabase
        .from('lancamentos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', args.lancamento_id)
        .is('deleted_at', null)
        .select()
        .single()
      if (error) return { erro: error.message }
      return { excluido: true, lancamento: data }
    }

    case 'registrar_fiado': {
      const { data, error } = await supabase
        .from('fiados')
        .insert({
          cliente_id: args.cliente_id,
          descricao: args.descricao,
          valor_total: args.valor_total,
          data: (args.data as string) ?? new Date().toISOString().slice(0, 10),
        })
        .select('*, cliente:clientes(nome, telefone)')
        .single()
      if (error) return { erro: error.message }
      return { fiado: data }
    }

    case 'buscar_fiados_cliente': {
      const { data, error } = await supabase
        .from('fiados')
        .select('id, descricao, valor_total, data, status, pagamentos:fiado_pagamentos(valor)')
        .eq('cliente_id', args.cliente_id)
        .is('deleted_at', null)
        .order('data', { ascending: false })
      if (error) return { erro: error.message }
      const fiados = (data ?? []).map((f) => {
        const pago = (f.pagamentos ?? []).reduce((s: number, p: { valor: number }) => s + p.valor, 0)
        return {
          fiado_id: f.id,
          descricao: f.descricao,
          valor_total: f.valor_total,
          data: f.data,
          status: f.status,
          valor_pago: pago,
          saldo_devedor: Math.max(0, f.valor_total - pago),
        }
      })
      const totalDevido = fiados.reduce((s, f) => s + f.saldo_devedor, 0)
      return { fiados, total_devido: totalDevido }
    }

    case 'receber_pagamento_fiado': {
      const { data: fiado, error: erroFiado } = await supabase
        .from('fiados')
        .select('*, cliente:clientes(nome)')
        .eq('id', args.fiado_id)
        .is('deleted_at', null)
        .single()
      if (erroFiado || !fiado) return { erro: erroFiado?.message ?? 'Fiado não encontrado.' }

      const dataPagamento = (args.data as string) ?? new Date().toISOString().slice(0, 10)
      const formaPagamento = (args.forma_pagamento as string) ?? 'Dinheiro'

      // Mesma function atômica usada pela tela (registrar_pagamento_fiado_atomico):
      // lançamento no caixa + baixa no fiado saem numa única transação no banco,
      // ou nenhum dos dois é gravado.
      const { error: erroRpc } = await supabase
        .rpc('registrar_pagamento_fiado_atomico', {
          p_fiado_id: args.fiado_id,
          p_valor: args.valor,
          p_forma_pagamento: formaPagamento,
          p_data: dataPagamento,
        })
        .single()
      if (erroRpc) return { erro: erroRpc.message }

      return { confirmado: true, cliente_nome: fiado.cliente?.nome, valor_recebido: args.valor }
    }

    case 'buscar_ordens_servico': {
      let query = supabase.from('ordens_servico').select('id, numero, status, total, cliente:clientes(nome)').is('deleted_at', null)
      if (args.numero) query = query.ilike('numero', `%${args.numero}%`)
      if (args.status) query = query.eq('status', args.status as string)
      const { data, error } = await query.limit(10)
      if (error) return { erro: error.message }
      let ordens = data ?? []
      if (args.cliente_nome) {
        const alvo = String(args.cliente_nome).toLowerCase()
        ordens = ordens.filter((o: { cliente: { nome: string } | { nome: string }[] | null }) => {
          const c = Array.isArray(o.cliente) ? o.cliente[0] : o.cliente
          return c?.nome?.toLowerCase().includes(alvo)
        })
      }
      return { ordens }
    }

    case 'marcar_ordem_pronta': {
      const { data: ordem, error } = await supabase
        .from('ordens_servico')
        .update({ status: 'concluida', data_conclusao: new Date().toISOString() })
        .eq('id', args.ordem_id)
        .select('*, cliente:clientes(nome, telefone)')
        .single()
      if (error) return { erro: error.message }
      const cliente = Array.isArray(ordem.cliente) ? ordem.cliente[0] : ordem.cliente
      const primeiroNome = cliente?.nome?.split(' ')[0] ?? ''
      const mensagem = `Olá, ${primeiroNome}! Aqui é da Surubim Tornearia. Seu serviço (O.S. ${ordem.numero}) já está pronto para retirada. Qualquer dúvida, estamos à disposição!`
      const digitos = (cliente?.telefone ?? '').replace(/\D/g, '')
      const telefoneWa = digitos ? (digitos.startsWith('55') ? digitos : `55${digitos}`) : null
      return {
        ordem_numero: ordem.numero,
        cliente_nome: cliente?.nome,
        mensagem_sugerida: mensagem,
        link_whatsapp: telefoneWa ? `https://wa.me/${telefoneWa}?text=${encodeURIComponent(mensagem)}` : null,
      }
    }

    case 'consultar_pendencias': {
      const pendencias = await buscarPendencias(supabase)
      return {
        contas_fixas_pendentes: pendencias.contasFixasPendentes,
        contas_variaveis_pendentes: pendencias.contasVariaveisPendentes,
        clientes_com_fiado_vencido: pendencias.clientesVencidos,
        total_a_pagar_pendente: pendencias.totalAPagarPendente,
        total_a_pagar_vencido: pendencias.totalAPagarVencido,
        total_a_receber_aberto: pendencias.totalAReceberAberto,
        total_a_receber_vencido: pendencias.totalAReceberVencido,
        aviso: 'Campo "dias": negativo significa que já venceu há esse tanto de dias; positivo é quanto falta.',
      }
    }

    case 'analisar_saude_financeira': {
      const hoje = new Date()
      const mesAtualISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
      const mesAnteriorData = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      const mesAnteriorISO = `${mesAnteriorData.getFullYear()}-${String(mesAnteriorData.getMonth() + 1).padStart(2, '0')}-01`

      const [dreAtualRes, dreAnteriorRes, pendencias] = await Promise.all([
        supabase.rpc('calcular_dre_mensal', { p_mes: mesAtualISO }).single(),
        supabase.rpc('calcular_dre_mensal', { p_mes: mesAnteriorISO }).single(),
        buscarPendencias(supabase),
      ])
      if (dreAtualRes.error) return { erro: dreAtualRes.error.message }

      return {
        dre_mes_atual: dreAtualRes.data,
        dre_mes_anterior: dreAnteriorRes.error ? null : dreAnteriorRes.data,
        contas_a_pagar_pendente: pendencias.totalAPagarPendente,
        contas_a_pagar_vencido: pendencias.totalAPagarVencido,
        a_receber_aberto: pendencias.totalAReceberAberto,
        a_receber_vencido: pendencias.totalAReceberVencido,
        aviso: 'Todo número acima veio direto do banco de dados — use exatamente esses valores na análise, nunca invente, arredonde de cabeça ou complete com estimativa.',
      }
    }

    case 'fechar_caixa': {
      const hoje = new Date().toISOString().slice(0, 10)
      const { data: lancs, error: erroLancs } = await supabase
        .from('lancamentos')
        .select('tipo, valor, status, destino')
        .eq('data', hoje)
        .is('deleted_at', null)
      if (erroLancs) return { erro: erroLancs.message }

      // "Esperado" é conferência de DINHEIRO FÍSICO na gaveta — só entram aqui os
      // lançamentos pagos com destino='caixa' (Dinheiro). Pix/cartão/transferência
      // vão pro banco, não pela gaveta.
      const totalEntradas = (lancs ?? []).filter(l => l.tipo === 'entrada' && l.status === 'pago' && l.destino === 'caixa').reduce((s, l) => s + l.valor, 0)
      const totalSaidas = (lancs ?? []).filter(l => l.tipo === 'saida' && l.status === 'pago' && l.destino === 'caixa').reduce((s, l) => s + l.valor, 0)
      const totalPendente = (lancs ?? []).filter(l => l.tipo === 'entrada' && l.status === 'pendente').reduce((s, l) => s + l.valor, 0)

      const valorAbertura = args.valor_abertura as number
      const valorContado = args.valor_contado as number
      const valorEsperado = valorAbertura + totalEntradas - totalSaidas
      const diferenca = valorContado - valorEsperado

      const payload = {
        data: hoje,
        valor_abertura: valorAbertura,
        total_entradas: totalEntradas,
        total_saidas: totalSaidas,
        valor_esperado: valorEsperado,
        valor_contado: valorContado,
        diferenca,
        observacoes: (args.observacoes as string) ?? null,
      }

      const { data: existente } = await supabase.from('fechamento_caixa').select('id').eq('data', hoje).maybeSingle()
      if (existente) {
        await supabase.from('fechamento_caixa').update(payload).eq('id', existente.id)
      } else {
        await supabase.from('fechamento_caixa').insert(payload)
      }

      return { ...payload, total_pendente_fiado: totalPendente }
    }

    default:
      return { erro: `Ferramenta desconhecida: ${nome}` }
  }
}
