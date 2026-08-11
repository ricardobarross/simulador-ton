'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Cliente } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ClientesList } from '@/components/clientes/ClientesList'
import { ClienteForm } from '@/components/clientes/ClienteForm'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtro, setFiltro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null)

  async function carregar() {
    const supabase = createClient()
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('nome')
    setClientes(data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function handleGuardar(dados: Partial<Cliente>) {
    const supabase = createClient()
    if (clienteEditando?.id) {
      await supabase.from('clientes').update(dados).eq('id', clienteEditando.id)
    } else {
      await supabase.from('clientes').insert(dados)
    }
    setModalAberto(false)
    setClienteEditando(null)
    await carregar()
  }

  async function handleExcluir(id: string) {
    if (!confirm('Tens a certeza que queres excluir este cliente?')) return
    const supabase = createClient()
    await supabase.from('clientes').delete().eq('id', id)
    await carregar()
  }

  function abrirEditar(cliente: Cliente) {
    setClienteEditando(cliente)
    setModalAberto(true)
  }

  function abrirNovo() {
    setClienteEditando(null)
    setModalAberto(true)
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(filtro.toLowerCase()) ||
    (c.telefone ?? '').includes(filtro)
  )

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500">{clientes.length} clientes registados</p>
        </div>
        <Button variante="primario" onClick={abrirNovo}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo cliente
        </Button>
      </div>

      {/* Pesquisa */}
      <Input
        placeholder="Pesquisar por nome ou telefone..."
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
      />

      {/* Tabela */}
      <Card padding={false}>
        {carregando ? (
          <LoadingSpinner />
        ) : (
          <ClientesList
            clientes={clientesFiltrados}
            onEditar={abrirEditar}
            onExcluir={handleExcluir}
          />
        )}
      </Card>

      {/* Modal */}
      <Modal
        aberto={modalAberto}
        onFechar={() => { setModalAberto(false); setClienteEditando(null) }}
        titulo={clienteEditando ? 'Editar cliente' : 'Novo cliente'}
        largura="lg"
      >
        <ClienteForm
          inicial={clienteEditando ?? undefined}
          onGuardar={handleGuardar}
          onCancelar={() => { setModalAberto(false); setClienteEditando(null) }}
        />
      </Modal>
    </div>
  )
}