'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { executarFerramenta } from '@/lib/secretaria-tools'
import { cn } from '@/lib/utils'

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

interface BolhaVisivel {
  autor: 'usuario' | 'ia'
  texto: string
}

const opcoesRapidas = [
  'Registrar uma entrada de dinheiro',
  'Registrar uma saída de dinheiro',
  'Cadastrar um cliente novo',
  'Anotar um fiado',
  'Registrar pagamento de um fiado',
  'Montar um orçamento',
  'Abrir uma ordem de serviço',
  'Avisar que um serviço ficou pronto',
  'Fechar o caixa de hoje',
]

export function ChatSecretaria() {
  const { perfil } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [historico, setHistorico] = useState<ChatMessage[]>([])
  const [bolhas, setBolhas] = useState<BolhaVisivel[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bolhas, enviando, aberto])

  async function enviarParaAPI(mensagens: ChatMessage[]): Promise<ChatMessage> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const resp = await fetch('/api/secretaria', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ messages: mensagens }),
    })

    const dados = await resp.json()
    if (!resp.ok) throw new Error(dados.erro ?? 'Erro ao falar com a secretária.')
    return dados.mensagem as ChatMessage
  }

  async function processarConversa(mensagensAtualizadas: ChatMessage[]) {
    let mensagens = mensagensAtualizadas
    // Loop agente: chama a API, executa ferramentas se pedido, repete até ter resposta final em texto.
    for (let volta = 0; volta < 6; volta++) {
      const respostaIA = await enviarParaAPI(mensagens)
      mensagens = [...mensagens, respostaIA]

      if (!respostaIA.tool_calls || respostaIA.tool_calls.length === 0) {
        if (respostaIA.content) {
          setBolhas(prev => [...prev, { autor: 'ia', texto: respostaIA.content as string }])
        }
        setHistorico(mensagens)
        return
      }

      // Executa cada ferramenta pedida e devolve o resultado para a IA continuar.
      for (const chamada of respostaIA.tool_calls) {
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(chamada.function.arguments || '{}') } catch { /* ignora */ }
        const resultado = await executarFerramenta(chamada.function.name, args)
        mensagens = [
          ...mensagens,
          {
            role: 'tool',
            tool_call_id: chamada.id,
            name: chamada.function.name,
            content: JSON.stringify(resultado),
          },
        ]
      }
    }
    setHistorico(mensagens)
    setBolhas(prev => [...prev, { autor: 'ia', texto: 'Desculpa, me perdi um pouco aqui — pode repetir o que precisa?' }])
  }

  async function enviarMensagem(mensagemTexto: string) {
    if (!mensagemTexto.trim() || enviando) return
    setErro('')
    setTexto('')
    setBolhas(prev => [...prev, { autor: 'usuario', texto: mensagemTexto }])
    setEnviando(true)
    const novoHistorico: ChatMessage[] = [...historico, { role: 'user', content: mensagemTexto }]
    setHistorico(novoHistorico)
    try {
      await processarConversa(novoHistorico)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setEnviando(false)
    }
  }

  function abrir() {
    setAberto(true)
    if (bolhas.length === 0) {
      setBolhas([{
        autor: 'ia',
        texto: `${saudacao()}, ${perfil?.nome?.split(' ')[0] ?? ''}! Sou a secretária da oficina. O que vamos fazer?`,
      }])
    }
  }

  function saudacao() {
    const hora = new Date().getHours()
    if (hora < 12) return 'Bom dia'
    if (hora < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={abrir}
        className={cn(
          'fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors',
          aberto && 'hidden'
        )}
        aria-label="Abrir secretária IA"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* Painel do chat */}
      {aberto && (
        <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] sm:w-96 h-[32rem] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div>
              <p className="text-sm font-semibold">Secretária IA</p>
              <p className="text-xs text-blue-100">Surubim Tornearia</p>
            </div>
            <button onClick={() => setAberto(false)} className="text-blue-100 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {bolhas.map((b, i) => (
              <div key={i} className={cn('flex', b.autor === 'usuario' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line',
                  b.autor === 'usuario' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                )}>
                  {b.texto}
                </div>
              </div>
            ))}

            {bolhas.length === 1 && !enviando && (
              <div className="flex flex-col gap-2 pt-2">
                {opcoesRapidas.map(op => (
                  <button
                    key={op}
                    onClick={() => enviarMensagem(op)}
                    className="text-left text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    {op}
                  </button>
                ))}
              </div>
            )}

            {enviando && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-gray-400">
                  a escrever...
                </div>
              </div>
            )}

            {erro && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
            <div ref={fimRef} />
          </div>

          <div className="p-3 border-t border-gray-200 flex gap-2">
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarMensagem(texto)}
              placeholder="Escreve aqui..."
              disabled={enviando}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
            <button
              onClick={() => enviarMensagem(texto)}
              disabled={enviando || !texto.trim()}
              className="w-10 h-10 flex-shrink-0 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
