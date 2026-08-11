'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Cliente, Orcamento, OrdemServico } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatarTelefone, formatarData, formatarMoeda, statusOrcamento, statusOrdem } from '@/lib/utils'

export default function ClienteDetalhe() {
  const { id } = useParams()
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const [clienteRes, orcamentosRes, ordensRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', id).single(),
        supabase.from('orcamentos').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
        supabase.from('ordens_servico').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
      ])
      setCliente(clienteRes.data)
      setOrcamentos(orcamentosRes.data ?? [])
      setOrdens(ordensRes.data ?? [])
      setCarregando(false)
    }
    if (id) carregar()
  }, [id])

  if (carregando) return <LoadingSpinner />
  if (!cliente) return <p className="text-gray-500">Cliente não encontrado.</p>

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variante="ghost" tamanho="sm" onClick={() => router.back()}>
          ← Voltar
        </Button>
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
    </div>
  )
}
