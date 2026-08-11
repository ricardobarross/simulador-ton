'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Orcamento } from '@/types'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { OrcamentoPDF, imprimirOrcamento } from '@/components/orcamentos/OrcamentoPDF'

export default function OrcamentoDetalhe() {
  const { id } = useParams()
  const router = useRouter()
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data } = await supabase
        .from('orcamentos')
        .select('*, cliente:clientes(id, nome, telefone)')
        .eq('id', id)
        .single()
      setOrcamento(data as Orcamento | null)
      setCarregando(false)
    }
    if (id) carregar()
  }, [id])

  if (carregando) return <LoadingSpinner />
  if (!orcamento) return <p className="text-gray-500">Orçamento não encontrado.</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variante="ghost" tamanho="sm" onClick={() => router.back()}>← Voltar</Button>
        <Button variante="primario" onClick={imprimirOrcamento}>Imprimir / Guardar PDF</Button>
      </div>
      <OrcamentoPDF orcamento={orcamento} />
    </div>
  )
}
