'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { OrdemServico, StatusOrdem } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { OrdemStatus } from '@/components/ordens/OrdemStatus'
import { formatarMoeda, formatarDataHora } from '@/lib/utils'
import { sincronizarLancamentoOrdem } from '@/lib/financeiro'

export default function OrdemDetalhe() {
  const { id } = useParams()
  const router = useRouter()
  const [ordem, setOrdem] = useState<OrdemServico | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [copiado, setCopiado] = useState(false)

  async function carregar() {
    const supabase = createClient()
    const { data } = await supabase
      .from('ordens_servico')
      .select('*, cliente:clientes(id, nome, telefone)')
      .eq('id', id)
      .single()
    setOrdem(data as OrdemServico | null)
    setCarregando(false)
  }

  useEffect(() => { if (id) carregar() }, [id])

  async function alterarStatus(novo: StatusOrdem) {
    if (!ordem) return
    const supabase = createClient()
    const dados: Partial<OrdemServico> = { status: novo }
    if (novo === 'concluida') dados.data_conclusao = new Date().toISOString()
    await supabase.from('ordens_servico').update(dados).eq('id', ordem.id)
    await sincronizarLancamentoOrdem(supabase, ordem.id, novo)
    await carregar()
  }

  function mensagemPronto() {
    if (!ordem) return ''
    const primeiroNome = ordem.cliente?.nome?.split(' ')[0] ?? ''
    return `Olá, ${primeiroNome}! Aqui é da Surubim Tornearia. Seu serviço (O.S. ${ordem.numero}) já está pronto para retirada. Valor total: ${formatarMoeda(ordem.total)}. Qualquer dúvida, estamos à disposição!`
  }

  function telefoneWhatsapp() {
    const digitos = (ordem?.cliente?.telefone ?? '').replace(/\D/g, '')
    if (!digitos) return null
    return digitos.startsWith('55') ? digitos : `55${digitos}`
  }

  async function copiarMensagem() {
    await navigator.clipboard.writeText(mensagemPronto())
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (carregando) return <LoadingSpinner />
  if (!ordem) return <p className="text-gray-500">Ordem de serviço não encontrada.</p>

  const numeroWa = telefoneWhatsapp()
  const linkWa = numeroWa ? `https://wa.me/${numeroWa}?text=${encodeURIComponent(mensagemPronto())}` : null

  return (
    <div className="space-y-4 max-w-2xl">
      <Button variante="ghost" tamanho="sm" onClick={() => router.back()}>← Voltar</Button>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{ordem.numero} — {ordem.cliente?.nome}</CardTitle>
            <p className="text-sm text-gray-400 mt-0.5">Aberta em {formatarDataHora(ordem.data_abertura)}</p>
          </div>
          <OrdemStatus status={ordem.status} onAlterar={alterarStatus} />
        </CardHeader>

        <div className="divide-y divide-gray-100">
          {ordem.itens.map(item => (
            <div key={item.id} className="flex justify-between py-2 text-sm">
              <span>{item.descricao} <span className="text-gray-400">({item.quantidade} {item.unidade})</span></span>
              <span className="font-medium">{formatarMoeda(item.valor_total)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-end gap-1 text-sm pt-3 mt-3 border-t border-gray-100">
          <div className="flex gap-6"><span className="text-gray-500">Subtotal</span><span>{formatarMoeda(ordem.subtotal)}</span></div>
          {ordem.desconto > 0 && <div className="flex gap-6"><span className="text-gray-500">Desconto</span><span>- {formatarMoeda(ordem.desconto)}</span></div>}
          <div className="flex gap-6 text-base font-bold"><span>Total</span><span>{formatarMoeda(ordem.total)}</span></div>
          {ordem.pagamentos && ordem.pagamentos.length > 1 ? (
            <div className="flex flex-col items-end gap-0.5 w-full">
              <span className="text-gray-500 self-end">Pagamento</span>
              {ordem.pagamentos.map((p, i) => (
                <div key={i} className="flex gap-6 text-gray-700">
                  <span>{p.forma === 'Fiado' ? 'Fiado (a prazo)' : p.forma}</span>
                  <span>{formatarMoeda(p.valor)}</span>
                </div>
              ))}
            </div>
          ) : (
            ordem.forma_pagamento && <div className="flex gap-6"><span className="text-gray-500">Pagamento</span><span>{ordem.forma_pagamento}</span></div>
          )}
        </div>

        {ordem.observacoes && (
          <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100 whitespace-pre-line">{ordem.observacoes}</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avisar cliente</CardTitle>
        </CardHeader>
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3 whitespace-pre-line">{mensagemPronto()}</p>
        <div className="flex gap-3">
          <Button variante="secundario" onClick={copiarMensagem}>{copiado ? 'Copiado!' : 'Copiar mensagem'}</Button>
          {linkWa && (
            <a href={linkWa} target="_blank" rel="noopener noreferrer">
              <Button variante="primario">Abrir no WhatsApp</Button>
            </a>
          )}
        </div>
        {!numeroWa && <p className="text-xs text-gray-400 mt-2">Cliente sem telefone cadastrado.</p>}
      </Card>
    </div>
  )
}
