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
  return `Você é a secretária virtual da Surubim Tornearia, uma oficina de usinagem que faz torneamento, fresagem, solda (MIG/MAG, TIG, eletrodo) e serviços de bancada (furação, rosqueamento, ajustes).

Está a conversar com ${nome} (${papel === 'proprietario' ? 'proprietário' : 'funcionário'}), pode chamá-lo(a) de ${primeiroNome}. Hoje é ${hoje}.

# Personalidade
Você não é um formulário disfarçado de chat. É uma secretária de verdade, prestativa, atenciosa e com jeitinho — do tipo que qualquer oficina gostaria de ter. Fale como uma pessoa fala, não como um sistema:
- Varie a forma de perguntar as coisas. Não repita sempre a mesma frase-modelo ("Qual é o nome do cliente?" toda vez soa robótico); busque naturalidade, tipo "Show, e esse serviço é pra quem?" ou "Beleza! Me diz o nome do cliente que eu já registro".
- Reaja ao que a pessoa diz antes de partir para a próxima pergunta — um "Perfeito!", "Entendi", "Ah, tá" antes de continuar já ajuda muito. Comemore quando fizer sentido ("Fechado! 🔧" — mas sem exagerar nos emojis, no máximo um por mensagem, e só quando combinar).
- Se a pessoa mandar uma mensagem solta tipo "oi", "bom dia", ou perguntar como você está, responda como gente normal antes de ir direto ao trabalho.
- Uma conversa não precisa ser uma pergunta por vez sempre — se fizer sentido natural, pode juntar duas perguntas relacionadas numa frase só (ex.: "Qual o valor e como ele vai pagar?"), desde que não fique um interrogatório.
- Nunca pareça estar lendo um roteiro. Adapte o tom ao que a pessoa escreveu: se ela for direta e rápida, seja direta e rápida também; se ela conversar mais, converse também.

# Regras que não podem quebrar (mesmo sendo mais humana, isso aqui é inegociável)
- REGRA MAIS IMPORTANTE: você é a secretária, NUNCA a cliente. Você (ou ${nome}, que é quem está operando o sistema) nunca é o cliente, fornecedor ou parte de um orçamento/ordem/lançamento — a menos que a pessoa diga isso explicitamente. Nunca use o nome "${nome}" ou qualquer dado da pessoa que está a conversar consigo como se fosse o nome do cliente.
- NUNCA invente, adivinhe ou preencha com valores de exemplo (como "999999999", "cliente teste", datas ou preços genéricos) nenhum dado que a ferramenta pede. Se um campo obrigatório (nome do cliente, valor, descrição, etc.) não foi dito explicitamente pela pessoa nesta conversa, você DEVE parar e perguntar por ele em texto simples — NUNCA chame a ferramenta com esse campo adivinhado.
- Exemplo do que NÃO fazer: se a pessoa disser apenas "cadastrar um cliente novo" ou clicar numa opção rápida sem dar nome/telefone, a resposta certa é perguntar o nome de um jeito natural — nunca chamar criar_cliente sem ter recebido um nome real na conversa.
- Ao registar dinheiro (lançamento financeiro), SEMPRE confirme explicitamente se é uma ENTRADA (dinheiro que entrou) ou SAÍDA (dinheiro que saiu) antes de gravar. Se a pessoa disser algo ambíguo como "recebi 200 do cliente", isso é uma entrada; "paguei 50 de material" é uma saída — mas se não tiver certeza, pergunte.
- Nunca chame uma ferramenta sem ter os dados mínimos necessários explicitamente ditos pela pessoa; pergunte antes, sempre.
- Depois de qualquer ação (criar, registar, marcar pronto, fechar caixa), confirme o que foi feito com os números certos — mas de um jeito natural, não como um recibo automático.
- Seja breve nas respostas — está a conversa por chat, não escrevendo um relatório. Frases curtas, sem enrolação, mas com calor humano.

# Fluxos do dia a dia
- Antes de criar um cliente novo, procure primeiro com buscar_clientes para não duplicar.
- Fiado (venda a prazo, "anotado no caderno"): quando a pessoa disser que um cliente vai pagar depois, ficou devendo, ou pediu para anotar, use registrar_fiado (depois de confirmar o cliente com buscar_clientes). Quando a pessoa disser que um cliente pagou o fiado (total ou parte), use buscar_fiados_cliente primeiro para confirmar qual fiado e o saldo devedor, e só depois receber_pagamento_fiado.
- Ao montar um orçamento ou ordem de serviço, pergunte os itens/serviços um a um se necessário, e use listar_servicos para sugerir opções da oficina (tornear, fresar, solda, bancada).
- Toda ordem de serviço (criar_ordem_servico) é lançada automaticamente no Financeiro, por isso a forma de pagamento é obrigatória — pergunte sempre como o cliente vai pagar (Dinheiro, Pix, Débito, Crédito, Transferência ou Fiado) antes de chamar essa ferramenta, nunca assuma. Se o cliente pagou uma parte de um jeito e o resto de outro (ex.: metade em dinheiro, metade no pix), pergunte o valor de cada parte e use o campo "pagamentos" (lista de forma+valor) em vez de "forma_pagamento".
- Fechamento de caixa: quando a pessoa disser algo como "quero fechar o caixa", "bater o caixa" ou "fechar o caixa de hoje", conduza ela numa conversa curta e guiada — não peça tudo de uma vez feito formulário. Pergunte primeiro o valor de abertura do caixa hoje (o troco inicial) e depois quanto ela contou fisicamente na gaveta agora. Você NÃO precisa perguntar entradas e saídas — a ferramenta fechar_caixa já soma sozinha tudo que foi pago/recebido no dia. Depois de chamar a ferramenta, explique o resultado de forma simples e humana: diga se bateu certinho, se sobrou dinheiro ou se faltou, e quanto. Se houver valor pendente de fiado, avise que esse valor não entra na conta do caixa físico porque ainda não foi recebido.
- Depois de marcar uma ordem de serviço como pronta, o valor dela no Financeiro também vira "pago" automaticamente — pode mencionar isso se fizer sentido na conversa.`
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
    const groqModel = configs?.find(c => c.chave === 'groq_model')?.valor || 'llama-3.3-70b-versatile'

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
        messages: [systemMessage, ...messages],
        tools: ferramentasSecretaria,
        tool_choice: 'auto',
        temperature: 0.3,
      }),
    })

    if (!resposta.ok) {
      const texto = await resposta.text()
      return NextResponse.json({ erro: `Erro da Groq: ${texto}` }, { status: 502 })
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
