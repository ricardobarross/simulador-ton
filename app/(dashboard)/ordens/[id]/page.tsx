'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { OrdemServico, StatusOrdem, PagamentoOS, SituacaoPagamentoOrdem } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { OrdemStatus } from '@/components/ordens/OrdemStatus'
import { PagamentoOrdemForm } from '@/components/financeiro/PagamentoOrdemForm'
import { formatarMoeda, formatarDataHora } from '@/lib/utils'
import { sincronizarLancamentoOrdem, registrarPagamentoOrdem, calcularSituacoesPagamento } from '@/lib/financeiro'
import { executarOperacao } from '@/lib/api-helpers'
import { useToast } from '@/lib/toast-context'
import { useAuth } from '@/lib/auth-context'
import { abrirWhatsapp, linkWhatsapp, mensagemOrdemPronta, mensagemResumoOrdemServico } from '@/lib/whatsapp'

const situacaoInfo: Record<SituacaoPagamentoOrdem, { texto: string; cor: 'green' | 'red' | 'yellow' | 'gray' }> = {
  pago:              { texto: 'Pago', cor: 'green' },
  fiado_pendente:    { texto: 'Fiado pendente', cor: 'red' },
  cheque_aguardando: { texto: 'Cheque aguardando', cor: 'yellow' },
  aguardando:        { texto: 'Aguardando pagamento', cor: 'gray' },
}

export default function OrdemDetalhe() {
  const { id } = useParams()
  const router = useRouter()
  const { mostrarErro, mostrarSucesso } = useToast()
  const { ehProprietario, perfil } = useAuth()
  const [ordem, setOrdem] = useState<OrdemServico | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [situacaoPagamento, setSituacaoPagamento] = useState<SituacaoPagamentoOrdem>('aguardando')
  const [modalPagamento, setModalPagamento] = useState(false)

  async function carregar() {
    const supabase = createClient()
    const [resultado, fiadosRes, lancamentosRes, chequesRes] = await Promise.all([
      executarOperacao(() =>
        supabase
          .from('ordens_servico')
          .select('*, cliente:clientes(id, nome, telefone)')
          .eq('id', id)
          .is('deleted_at', null)
          .single()
      ),
      executarOperacao(() => supabase.from('fiados').select('ordem_servico_id').eq('ordem_servico_id', id).neq('status', 'quitado').is('deleted_at', null)),
      executarOperacao(() => supabase.from('lancamentos').select('ordem_servico_id').eq('ordem_servico_id', id).is('deleted_at', null)),
      executarOperacao(() => supabase.from('cheques').select('ordem_servico_id, status').eq('ordem_servico_id', id).is('deleted_at', null)),
    ])
    if (!resultado.ok) {
      mostrarErro(`Não foi possível carregar a O.S.: ${resultado.erro}`)
      setCarregando(false)
      return
    }
    setOrdem(resultado.data as OrdemServico | null)
    const fiadosPendentes = fiadosRes.ok ? new Set((fiadosRes.data as { ordem_servico_id: string }[]).map(f => f.ordem_servico_id)) : new Set<string>()
    const situacoes = calcularSituacoesPagamento(
      fiadosPendentes,
      lancamentosRes.ok ? (lancamentosRes.data as { ordem_servico_id: string | null }[]) : [],
      chequesRes.ok ? (chequesRes.data as { ordem_servico_id: string | null; status: string }[]) : []
    )
    setSituacaoPagamento(situacoes.get(id as string) ?? 'aguardando')
    setCarregando(false)
  }

  useEffect(() => { if (id) carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function registrarPagamento(pagamentos: PagamentoOS[]) {
    if (!ordem) return
    const supabase = createClient()
    const resultado = await registrarPagamentoOrdem(supabase, ordem.id, pagamentos, perfil?.id ?? null)
    if (!resultado.ok) {
      mostrarErro(`Não foi possível registar o pagamento: ${resultado.erro}`)
      return
    }
    mostrarSucesso(`Pagamento da O.S. ${ordem.numero} registado.`)
    setModalPagamento(false)
    await carregar()
  }

  async function alterarStatus(novo: StatusOrdem) {
    if (!ordem) return
    const supabase = createClient()
    const dados: Partial<OrdemServico> = { status: novo }
    if (novo === 'concluida') dados.data_conclusao = new Date().toISOString()

    const atualizar = await executarOperacao(() =>
      supabase.from('ordens_servico').update(dados).eq('id', ordem.id).select().single()
    )
    if (!atualizar.ok) {
      mostrarErro(`Não foi possível alterar o status: ${atualizar.erro}`)
      return
    }

    const sync = await sincronizarLancamentoOrdem(supabase, ordem.id, novo)
    if (!sync.ok) {
      mostrarErro(`Status alterado, mas houve um problema ao atualizar o Financeiro: ${sync.erro}`)
    } else {
      mostrarSucesso('Status atualizado.')
    }
    await carregar()
  }

  async function copiarMensagem() {
    if (!ordem) return
    await navigator.clipboard.writeText(mensagemOrdemPronta(ordem))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (carregando) return <LoadingSpinner />
  if (!ordem) return <p className="text-gray-500">Ordem de serviço não encontrada.</p>

  const temTelefone = !!ordem.cliente?.telefone
  const linkWa = ordem ? linkWhatsapp(ordem.cliente?.telefone, mensagemOrdemPronta(ordem)) : null

  return (
    <div className="space-y-4 max-w-2xl">
      <Button variante="ghost" tamanho="sm" onClick={() => router.back()}>← Voltar</Button>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{ordem.numero} — {ordem.cliente?.nome}</CardTitle>
            <p className="text-sm text-gray-400 mt-0.5">Aberta em {formatarDataHora(ordem.data_abertura)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge cor={situacaoInfo[situacaoPagamento].cor}>{situacaoInfo[situacaoPagamento].texto}</Badge>
            <OrdemStatus status={ordem.status} onAlterar={alterarStatus} />
          </div>
        </CardHeader>

        {situacaoPagamento === 'aguardando' && (
          <div className="flex justify-end mb-3">
            <Button variante="secundario" tamanho="sm" onClick={() => setModalPagamento(true)}>Registar pagamento</Button>
          </div>
        )}

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

        {ordem.anexos && ordem.anexos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fotos e desenhos técnicos</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ordem.anexos.map(a => (
                <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="block border border-gray-200 rounded-lg overflow-hidden">
                  {a.tipo.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.nome} className="w-full h-20 object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-20 bg-gray-50 gap-1 text-gray-500 px-1">
                      <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-[9px] truncate w-full text-center">{a.nome}</span>
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avisar cliente</CardTitle>
        </CardHeader>
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3 whitespace-pre-line">{mensagemOrdemPronta(ordem)}</p>
        <div className="flex gap-3 flex-wrap">
          <Button variante="secundario" onClick={copiarMensagem}>{copiado ? 'Copiado!' : 'Copiar mensagem'}</Button>
          {linkWa && (
            <a href={linkWa} target="_blank" rel="noopener noreferrer">
              <Button variante="primario">Abrir no WhatsApp</Button>
            </a>
          )}
          <Button variante="ghost" onClick={() => abrirWhatsapp(ordem.cliente?.telefone, mensagemResumoOrdemServico(ordem))}>
            Enviar resumo p/ aprovação
          </Button>
        </div>
        {!temTelefone && <p className="text-xs text-gray-400 mt-2">Cliente sem telefone cadastrado.</p>}
      </Card>

      <Modal aberto={modalPagamento} onFechar={() => setModalPagamento(false)} titulo="Registar pagamento">
        <PagamentoOrdemForm
          ordem={ordem}
          ehProprietario={ehProprietario}
          onGuardar={registrarPagamento}
          onCancelar={() => setModalPagamento(false)}
        />
      </Modal>
    </div>
  )
}
