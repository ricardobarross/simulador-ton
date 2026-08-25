'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Cliente, Orcamento, OrdemServico } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ExtratoCliente, imprimirExtratoCliente } from '@/components/clientes/ExtratoCliente'
import { carregarExtratoCliente, DadosExtratoCliente } from '@/lib/extrato'
import { abrirWhatsapp, mensagemExtratoCliente } from '@/lib/whatsapp'
import { useToast } from '@/lib/toast-context'
import { formatarTelefone, formatarData, formatarMoeda, statusOrcamento, statusOrdem } from '@/lib/utils'

export default function ClienteDetalhe() {
  const { id } = useParams()
  const router = useRouter()
  const { mostrarErro } = useToast()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [carregando, setCarregando] = useState(true)

  const [modalExtrato, setModalExtrato] = useState(false)
  const [extrato, setExtrato] = useState<DadosExtratoCliente | null>(null)
  const [carregandoExtrato, setCarregandoExtrato] = useState(false)
  // Por padrão, "Fiados pagos" só mostra o que foi pago hoje — é o caso comum
  // de gerar o extrato logo depois de dar baixa num pagamento. Ajustável, ou
  // dá pra ligar "histórico completo" pra ver tudo que o cliente já pagou.
  const hojeISO = new Date().toISOString().slice(0, 10)
  const [pagosDe, setPagosDe] = useState(hojeISO)
  const [pagosAte, setPagosAte] = useState(hojeISO)
  const [historicoCompleto, setHistoricoCompleto] = useState(false)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const [clienteRes, orcamentosRes, ordensRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', id).is('deleted_at', null).single(),
        supabase.from('orcamentos').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
        supabase.from('ordens_servico').select('*').eq('cliente_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      ])
      setCliente(clienteRes.data)
      setOrcamentos(orcamentosRes.data ?? [])
      setOrdens(ordensRes.data ?? [])
      setCarregando(false)
    }
    if (id) carregar()
  }, [id])

  async function abrirExtrato() {
    setModalExtrato(true)
    setCarregandoExtrato(true)
    const supabase = createClient()
    const resultado = await carregarExtratoCliente(supabase, String(id))
    if (!resultado.ok) {
      mostrarErro(resultado.erro)
      setModalExtrato(false)
      setCarregandoExtrato(false)
      return
    }
    setExtrato(resultado.data)
    setCarregandoExtrato(false)
  }

  if (carregando) return <LoadingSpinner />
  if (!cliente) return <p className="text-gray-500">Cliente não encontrado.</p>

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variante="ghost" tamanho="sm" onClick={() => router.back()}>
          ← Voltar
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variante="secundario" tamanho="sm" onClick={abrirExtrato}>
            Extrato / fechamento de conta
          </Button>
          <Link href="/financeiro">
            <Button variante="secundario" tamanho="sm">Juntar fiados numa fatura</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{cliente.nome}</CardTitle>
            <p className="text-sm text-gray-400 mt-0.5">
              Registado em {formatarData(cliente.created_at)}
            </p>
          </div>
          <Badge cor={cliente.ativo ? 'green' : 'gray'}>
            {cliente.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </CardHeader>

        {cliente.telefone && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Telefone</p>
            <p className="text-sm text-gray-900 mt-0.5">{formatarTelefone(cliente.telefone)}</p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orçamentos</CardTitle>
        </CardHeader>
        {orcamentos.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum orçamento registado.</p>
        ) : (
          <div className="space-y-2">
            {orcamentos.map(o => (
              <div key={o.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{o.numero}</span>
                  <Badge cor={statusOrcamento[o.status].cor as 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red'}>
                    {statusOrcamento[o.status].label}
                  </Badge>
                </div>
                <span className="font-medium text-gray-900">{formatarMoeda(o.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ordens de serviço</CardTitle>
        </CardHeader>
        {ordens.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma ordem de serviço registada.</p>
        ) : (
          <div className="space-y-2">
            {ordens.map(o => (
              <div key={o.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{o.numero}</span>
                  <Badge cor={statusOrdem[o.status].cor as 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red'}>
                    {statusOrdem[o.status].label}
                  </Badge>
                </div>
                <span className="font-medium text-gray-900">{formatarMoeda(o.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal aberto={modalExtrato} onFechar={() => { setModalExtrato(false); setExtrato(null) }} titulo="Extrato / fechamento de conta" largura="xl">
        {carregandoExtrato ? (
          <LoadingSpinner />
        ) : extrato ? (
          <div>
            <div className="flex flex-col gap-3 mb-4 print:hidden">
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  label="Fiados pagos de"
                  type="date"
                  value={pagosDe}
                  onChange={e => setPagosDe(e.target.value)}
                  disabled={historicoCompleto}
                  className="w-auto"
                />
                <Input
                  label="até"
                  type="date"
                  value={pagosAte}
                  onChange={e => setPagosAte(e.target.value)}
                  disabled={historicoCompleto}
                  className="w-auto"
                />
                <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
                  <input
                    type="checkbox"
                    checked={historicoCompleto}
                    onChange={e => setHistoricoCompleto(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  Ver histórico completo
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variante="secundario"
                  onClick={() => {
                    const enviado = abrirWhatsapp(
                      extrato.cliente.telefone,
                      mensagemExtratoCliente(extrato, historicoCompleto ? undefined : pagosDe, historicoCompleto ? undefined : pagosAte)
                    )
                    if (!enviado) mostrarErro('Este cliente não tem telefone cadastrado.')
                  }}
                >
                  Enviar por WhatsApp
                </Button>
                <Button variante="primario" onClick={imprimirExtratoCliente}>
                  Imprimir / Guardar PDF
                </Button>
              </div>
            </div>
            <ExtratoCliente
              extrato={extrato}
              pagosDe={historicoCompleto ? undefined : pagosDe}
              pagosAte={historicoCompleto ? undefined : pagosAte}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Não foi possível carregar o extrato.</p>
        )}
      </Modal>
    </div>
  )
}
