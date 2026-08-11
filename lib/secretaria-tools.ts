import { createClient } from '@/lib/supabase'
import { lancarOrdemNoFinanceiro, sincronizarLancamentoOrdem } from '@/lib/financeiro'

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
      description: 'Cria uma ordem de serviço diretamente (sem passar por orçamento) para um cliente. A O.S. é lançada automaticamente no Financeiro, por isso a forma de pagamento é obrigatória — pergunte sempre antes de chamar esta ferramenta. Se a pessoa disser que o pagamento foi dividido (ex.: "parte em dinheiro e o resto no pix"), pergunte o valor de cada parte e use o campo "pagamentos" em vez de "forma_pagamento" — a soma das partes precisa bater com o total da O.S.',
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
          observacoes: { type: 'string' },
        },
        required: ['cliente_id', 'itens'],
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
      description: 'Marca uma ordem de serviço como concluída e devolve uma mensagem pronta para avisar o cliente no WhatsApp.',
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

      const pagamentosArg = args.pagamentos as { forma: string; valor: number }[] | undefined
      if (!args.forma_pagamento && !pagamentosArg?.length) {
        return { erro: 'Forma de pagamento é obrigatória. Pergunte à pessoa antes de criar a O.S.' }
      }
      if (pagamentosArg?.length) {
        const soma = pagamentosArg.reduce((s, p) => s + (Number(p.valor) || 0), 0)
        if (Math.round((soma - total) * 100) !== 0) {
          return { erro: `A soma das formas de pagamento (${soma}) não bate com o total da O.S. (${total}). Confirme os valores com a pessoa.` }
        }
      }
      const pagamentosFinal = pagamentosArg?.length ? pagamentosArg : [{ forma: args.forma_pagamento as string, valor: total }]
      const formaResumo = pagamentosFinal.map(p => p.forma).join(' + ')

      const { data, error } = await supabase
        .from('ordens_servico')
        .insert({
          cliente_id: args.cliente_id,
          itens,
          subtotal,
          desconto,
          total,
          forma_pagamento: formaResumo,
          pagamentos: pagamentosFinal,
          observacoes: (args.observacoes as string) ?? null,
        })
        .select('*, cliente:clientes(nome)')
        .single()
      if (error) return { erro: error.message }
      await lancarOrdemNoFinanceiro(supabase, {
        id: data.id,
        numero: data.numero,
        total: data.total,
        forma_pagamento: data.forma_pagamento,
        pagamentos: data.pagamentos,
        cliente_id: data.cliente_id,
        cliente_nome: data.cliente?.nome,
      })
      return {
        ordem_servico: data,
        aviso: pagamentosFinal.some(p => p.forma === 'Fiado')
          ? 'Já foi lançada automaticamente no Financeiro; a parte em fiado entrou como conta a receber do cliente.'
          : 'Já foi lançada automaticamente no Financeiro como pendente.',
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
        .single()
      if (erroFiado || !fiado) return { erro: erroFiado?.message ?? 'Fiado não encontrado.' }

      const dataPagamento = (args.data as string) ?? new Date().toISOString().slice(0, 10)
      const formaPagamento = (args.forma_pagamento as string) ?? 'Dinheiro'

      const { data: lancamento, error: erroLancamento } = await supabase
        .from('lancamentos')
        .insert({
          tipo: 'entrada',
          categoria: 'Fiado recebido',
          descricao: `Pagamento de fiado — ${fiado.cliente?.nome ?? ''}`,
          valor: args.valor,
          forma_pagamento: formaPagamento,
          data: dataPagamento,
          status: 'pago',
        })
        .select()
        .single()
      if (erroLancamento) return { erro: erroLancamento.message }

      const { error: erroPagamento } = await supabase.from('fiado_pagamentos').insert({
        fiado_id: args.fiado_id,
        valor: args.valor,
        data: dataPagamento,
        forma_pagamento: formaPagamento,
        lancamento_id: lancamento?.id ?? null,
      })
      if (erroPagamento) return { erro: erroPagamento.message }

      return { confirmado: true, cliente_nome: fiado.cliente?.nome, valor_recebido: args.valor }
    }

    case 'buscar_ordens_servico': {
      let query = supabase.from('ordens_servico').select('id, numero, status, total, cliente:clientes(nome)')
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
      await sincronizarLancamentoOrdem(supabase, ordem.id, 'concluida')
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

    case 'fechar_caixa': {
      const hoje = new Date().toISOString().slice(0, 10)
      const { data: lancs, error: erroLancs } = await supabase
        .from('lancamentos')
        .select('tipo, valor, status')
        .eq('data', hoje)
      if (erroLancs) return { erro: erroLancs.message }

      // Só o que já foi efetivamente pago/recebido entra na conta do caixa físico.
      const totalEntradas = (lancs ?? []).filter(l => l.tipo === 'entrada' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
      const totalSaidas = (lancs ?? []).filter(l => l.tipo === 'saida' && l.status === 'pago').reduce((s, l) => s + l.valor, 0)
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
