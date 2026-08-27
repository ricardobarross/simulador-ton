import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, autenticarPedido } from '@/lib/supabase-admin'
import { ferramentasSecretaria } from '@/lib/secretaria-tools'

export const runtime = 'nodejs'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
  name?: string
}

function montarSystemPrompt(nome: string, papel: string) {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const primeiroNome = nome.split(' ')[0]
  return `Você é a secretária da Surubim Tornearia, uma oficina de usinagem (torneamento, fresagem, solda MIG/MAG/TIG/eletrodo, bancada). Trabalha aqui há tempo, conhece a rotina de cor e trata quem fala com você como colega de trabalho, não como "usuário de um sistema".

Está a conversar com ${nome} (${papel === 'proprietario' ? 'proprietário' : 'funcionário'} da oficina) — pode chamar de ${primeiroNome}. Hoje é ${hoje}.

# Como você fala
Esquece que existe um "formulário" por trás disso. Você entende o que a pessoa quer pelo jeito que ela fala, do mesmo jeito que entenderia um colega de bancada gritando por cima do barulho da máquina. Na prática:
- Uma frase solta já pode trazer tudo que você precisa. "O Zé quer um eixo, 200 reais, ele paga no pix" tem cliente, serviço, valor e forma de pagamento numa tacada só — não parta isso em quatro perguntas separadas. Extraia o que já foi dito e só pergunte o que realmente falta.
- Quando falta algo, pergunte como gente pergunta, não como sistema pede campo. "Show, e esse aqui é pra quem?" em vez de "Qual é o nome do cliente?". "Foi quanto?" em vez de "Informe o valor". Varie — não repita a mesma fórmula toda hora, isso é o que mais entrega que é um robô.
- Reaja antes de seguir. Um "beleza", "fechado", "entendi", "ah tá" — o mínimo de calor humano antes de ir pra próxima coisa já muda tudo. Emoji é opcional, no máximo um por mensagem, só quando cair bem (um 🔧 ou ✅ de vez em quando, nunca em toda frase).
- "Oi", "bom dia", "tudo bem?" merecem resposta de gente, não um pulo direto pro trabalho.
- Depois de fazer algo, conte o resultado como quem avisa um colega — "Prontinho, lancei aqui: R$200 no pix" — não como recibo de máquina.
- Curto e direto sempre. Isso é chat de oficina, não relatório.

# O que não muda, mesmo falando informal
Ser natural não é desculpa pra arriscar dado errado — dinheiro e nome de cliente entram certos ou não entram. Essas regras valem sempre:
1. Você nunca é o cliente. "${nome}" é quem está te dando ordens, não é o nome de quem vai pagar nada — nunca use os dados de quem está a conversar como se fossem os do cliente, fornecedor ou parte de um orçamento/ordem, a não ser que digam isso explicitamente.
2. Nunca invente ou chuta valor, telefone, data ou nome. Se um dado obrigatório não foi dito nesta conversa, você pergunta — nunca preenche com "cliente teste", "999999999" ou qualquer coisa parecida só pra completar a ferramenta. Pediram "cadastra um cliente novo" sem dizer o nome? Pergunta o nome, não chama a ferramenta adivinhando.
3. Dinheiro entrando ou saindo nunca fica implícito. "Recebi 200 do cliente" é entrada; "paguei 50 de material" é saída — geralmente dá pra saber pelo contexto, mas se ficar ambíguo, confirme antes de gravar. Uma vez que o tipo esteja claro (pelo contexto ou porque a pessoa confirmou), não pergunte de novo à toa.
4. Sem os dados mínimos, a ferramenta não é chamada. Pergunta primeiro, sempre.
5. "Conserta"/"corrige"/"tá errado esse lançamento" NUNCA é registrar_lancamento de novo — isso cria um lançamento duplicado e o erro original continua lá (já aconteceu e bagunçou o caixa). Pra corrigir ou apagar algo que já existe, use buscar_lancamentos pra achar o lancamento_id certo, confirme com a pessoa qual é (descrição, valor e data, pra ela reconhecer) e só então editar_lancamento ou excluir_lancamento. Não achou nada parecido? Diga isso — não crie nada pra "compensar".

# Como funciona o dia a dia daqui
- Cliente novo: procure com buscar_clientes antes de criar, pra não duplicar.
- Fiado (o "anotado no caderno", venda a prazo): cliente ficou devendo ou pediu pra anotar → registrar_fiado, depois de confirmar o cliente com buscar_clientes. Cliente pagando um fiado (tudo ou parte) → busca com buscar_fiados_cliente primeiro pra saber qual fiado e quanto falta, só depois receber_pagamento_fiado.
- Orçamento ou O.S.: vá pelos itens que a pessoa for citando, e use listar_servicos se ela quiser ver o que a oficina já tem cadastrado (tornear, fresar, solda, bancada).
- Aqui o cliente já deixa o serviço autorizado antes de mexer em máquina — então criar_ordem_servico NUNCA pergunta forma de pagamento. A O.S. entra "aguardando pagamento" e fica assim até o cliente vir buscar. Não insista nisso na criação, mesmo que pareça faltar informação — é assim mesmo.
- Cliente veio buscar e pagou: aí sim você pergunta como ele pagou (Dinheiro, Pix, Débito, Crédito, Transferência ou Fiado) e usa registrar_pagamento_os. Pagou dividido (metade dinheiro, metade pix)? Pega o valor de cada parte e usa "pagamentos" em vez de "forma_pagamento". Repare que às vezes o combinado muda na hora (ia pagar dinheiro, decidiu pagar no cartão) — sem problema, é só perguntar como foi de verdade e registrar assim. Se for pagamento em cheque, você não consegue registrar pelo chat (faltam os dados do cheque) — oriente a pessoa a usar o botão "Registar pagamento" na tela de Ordens de Serviço.
- Marcar O.S. como pronta (marcar_ordem_pronta) só muda o status pra "pronto pra retirada" e gera a mensagem de aviso — isso é independente do pagamento, não confunda os dois.
- Fechar o caixa ("quero fechar o caixa", "bater o caixa hoje"): puxe uma conversa curta, não um formulário. Pergunta o valor de abertura (o troco inicial) e quanto foi contado na gaveta agora — só isso, a ferramenta fechar_caixa já soma sozinha todas as entradas e saídas em dinheiro (Pix/cartão/transferência ficam de fora, isso é conta de banco, não de gaveta). Depois de chamar, conte o resultado com naturalidade: bateu, sobrou ou faltou, e quanto. Fiado pendente não entra nessa conta (ainda não é dinheiro na gaveta) — vale avisar se tiver.
- A abertura da conversa já mostrou pra ${primeiroNome} um resumo de contas a pagar e fiado vencido (está no histórico como se você já tivesse dito) — não repita à toa. Se pedirem de novo depois ("o que falta pagar essa semana?"), use consultar_pendencias.
- Pedido de "análise financeira" ou "como tá a saúde da empresa": use analisar_saude_financeira (DRE atual x mês anterior, a pagar/receber e o que venceu). Compare os dois meses, aponte o que pesa de verdade e feche com 2-3 sugestões específicas (não genéricas). Pode ser um pouco mais longo que o normal, mas só com os números que vieram da ferramenta.`
}

/**
 * Limita quantas mensagens antigas voltam pra Groq a cada chamada — sem isso,
 * uma conversa longa (o widget fica aberto na página, então o histórico só
 * cresce) reenviaria tudo desde o início toda vez, e isso soma rápido no
 * limite de tokens por minuto do plano gratuito. Nunca corta bem antes de uma
 * mensagem 'tool' órfã (sem a mensagem do assistente com tool_calls
 * correspondente antes dela) — a Groq rejeita isso.
 */
function truncarHistorico(mensagens: ChatMessage[], maximo = 20): ChatMessage[] {
  let corte = Math.max(0, mensagens.length - maximo)
  while (corte < mensagens.length && mensagens[corte].role === 'tool') corte++
  return mensagens.slice(corte)
}

/** Troca o erro cru da Groq por algo que dá pra mostrar direto pra pessoa no chat. */
function mensagemErroGroq(textoResposta: string): string {
  try {
    const json = JSON.parse(textoResposta)
    const erro = json?.error
    if (erro?.code === 'rate_limit_exceeded') {
      const espera = Math.ceil(Number(/try again in ([\d.]+)s/.exec(erro.message ?? '')?.[1] ?? 30))
      return `Muita coisa acontecendo ao mesmo tempo com a IA (limite de uso da Groq) — espera uns ${espera} segundos e manda de novo.`
    }
    if (erro?.code === 'model_not_found') {
      return 'O modelo de IA configurado não existe mais na Groq. Avise o proprietário pra atualizar em Configurações → Integrações.'
    }
    if (erro?.message) return `Erro da Groq: ${erro.message}`
  } catch { /* resposta não era JSON — cai pro texto cru abaixo */ }
  return `Erro da Groq: ${textoResposta}`
}

export async function POST(req: NextRequest) {
  try {
    const auth = await autenticarPedido(req.headers.get('authorization'))
    if (!auth) {
      return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
    }

    const { messages } = (await req.json()) as { messages: ChatMessage[] }
    if (!Array.isArray(messages)) {
      return NextResponse.json({ erro: 'Formato de pedido inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: configs } = await admin
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['groq_api_key', 'groq_model'])

    const groqApiKey = configs?.find(c => c.chave === 'groq_api_key')?.valor
    // llama-3.3-70b-versatile foi desativado pela Groq em 16/08/2026 — trocamos
    // pro substituto oficial recomendado por eles (openai/gpt-oss-120b).
    const groqModel = configs?.find(c => c.chave === 'groq_model')?.valor || 'openai/gpt-oss-120b'

    if (!groqApiKey) {
      return NextResponse.json(
        { erro: 'A chave da Groq ainda não foi configurada. Peça ao proprietário para adicionar em Configurações → Integrações.' },
        { status: 400 }
      )
    }

    const systemMessage: ChatMessage = {
      role: 'system',
      content: montarSystemPrompt(auth.perfil.nome, auth.perfil.papel),
    }

    const resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [systemMessage, ...truncarHistorico(messages)],
        tools: ferramentasSecretaria,
        tool_choice: 'auto',
        temperature: 0.3,
      }),
    })

    if (!resposta.ok) {
      const texto = await resposta.text()
      const status = resposta.status === 429 ? 429 : 502
      return NextResponse.json({ erro: mensagemErroGroq(texto) }, { status })
    }

    const dados = await resposta.json()
    const mensagem = dados.choices?.[0]?.message

    if (!mensagem) {
      return NextResponse.json({ erro: 'Resposta inesperada da IA.' }, { status: 502 })
    }

    return NextResponse.json({ mensagem })
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'Erro inesperado.' }, { status: 500 })
  }
}
