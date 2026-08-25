import { createClient } from '@/lib/supabase'
import { registrarPagamentoOrdem } from '@/lib/financeiro'

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
