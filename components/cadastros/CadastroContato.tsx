'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHead, TableBody, Th, Td, TableRow } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Fornecedor, Transportadora } from '@/types'
import { formatarTelefone } from '@/lib/utils'
import { executarOperacao } from '@/lib/api-helpers'
import { useToast } from '@/lib/toast-context'

type Registo = Fornecedor | Transportadora

interface CadastroContatoProps {
  tabela: 'fornecedores' | 'transportadoras'
  titulo: string
  tituloSingular: string
}

function ContatoForm({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial?: Partial<Registo>
  onGuardar: (dados: Partial<Registo>) => Promise<void>
  onCancelar: () => void
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [telefone, setTelefone] = useState(inicial?.telefone ?? '')
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '')
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit() {
    if (!nome.trim()) { setErro('Nome é obrigatório'); return }
    setErro('')
    setCarregando(true)
    await onGuardar({
      nome: nome.trim(),
      telefone: telefone?.trim() || null,
      observacoes: observacoes?.trim() || null,
      ativo,
    })
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <Input label="Nome *" value={nome} onChange={e => setNome(e.target.value)} erro={erro} />
      <Input label="Telefone" value={telefone ?? ''} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Observações</label>
        <textarea
          value={observacoes ?? ''}
          onChange={e => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="ativo" checked={ativo} onChange={e => setAtivo(e.target.checked)}
          className="rounded border-gray-300 text-blue-600" />
        <label htmlFor="ativo" className="text-sm text-gray-700">Ativo</label>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>
          {inicial?.id ? 'Guardar alterações' : 'Criar'}
        </Button>
      </div>
    </div>
  )
}

export function CadastroContato({ tabela, titulo, tituloSingular }: CadastroContatoProps) {
  const [registos, setRegistos] = useState<Registo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Registo | undefined>()
  const { mostrarErro, mostrarSucesso } = useToast()

  async function carregar() {
    setCarregando(true)
    const supabase = createClient()
    const resultado = await executarOperacao(() => supabase.from(tabela).select('*').order('nome'))
    if (!resultado.ok) {
      mostrarErro(`Não foi possível carregar ${titulo.toLowerCase()}: ${resultado.erro}`)
      setCarregando(false)
      return
    }
    setRegistos((resultado.data ?? []) as Registo[])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [tabela]) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(dados: Partial<Registo>) {
    const supabase = createClient()
    const resultado = editando
      ? await executarOperacao(() => supabase.from(tabela).update(dados).eq('id', editando.id).select().single())
      : await executarOperacao(() => supabase.from(tabela).insert(dados).select().single())
    if (!resultado.ok) {
      mostrarErro(`Não foi possível guardar: ${resultado.erro}`)
      return // modal continua aberto — nada foi salvo
    }
    mostrarSucesso(editando ? `${tituloSingular} atualizado(a).` : `${tituloSingular} criado(a).`)
    setModalAberto(false)
    setEditando(undefined)
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm(`Excluir este(a) ${tituloSingular.toLowerCase()}?`)) return
    const supabase = createClient()
    const resultado = await executarOperacao(() => supabase.from(tabela).delete().eq('id', id).select().single())
    if (!resultado.ok) {
      mostrarErro(`Não foi possível excluir: ${resultado.erro}`)
      return
    }
    mostrarSucesso(`${tituloSingular} excluído(a).`)
    await carregar()
  }

  const filtrados = registos.filter(r =>
    r.nome.toLowerCase().includes(busca.toLowerCase()) || (r.telefone ?? '').includes(busca)
  )

  if (carregando) return <LoadingSpinner texto={`A carregar ${titulo.toLowerCase()}...`} />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
          <Button variante="primario" onClick={() => { setEditando(undefined); setModalAberto(true) }}>
            + Novo(a) {tituloSingular.toLowerCase()}
          </Button>
        </CardHeader>
        <Input placeholder="Buscar por nome ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />
      </Card>

      <Card padding={false}>
        {filtrados.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Nenhum registo encontrado</p>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Nome</Th>
                <Th>Telefone</Th>
                <Th>Estado</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </TableHead>
            <TableBody>
              {filtrados.map(r => (
                <TableRow key={r.id}>
                  <Td>
                    <span className="font-medium text-gray-900">{r.nome}</span>
                    {r.observacoes && <span className="block text-xs text-gray-400">{r.observacoes}</span>}
                  </Td>
                  <Td>{r.telefone ? formatarTelefone(r.telefone) : '—'}</Td>
                  <Td><Badge cor={r.ativo ? 'green' : 'gray'}>{r.ativo ? 'Ativo' : 'Inativo'}</Badge></Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variante="ghost" tamanho="sm" onClick={() => { setEditando(r); setModalAberto(true) }}>Editar</Button>
                      <Button variante="perigo" tamanho="sm" onClick={() => excluir(r.id)}>Excluir</Button>
                    </div>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        aberto={modalAberto}
        onFechar={() => { setModalAberto(false); setEditando(undefined) }}
        titulo={editando ? `Editar ${tituloSingular.toLowerCase()}` : `Novo(a) ${tituloSingular.toLowerCase()}`}
      >
        <ContatoForm inicial={editando} onGuardar={guardar} onCancelar={() => { setModalAberto(false); setEditando(undefined) }} />
      </Modal>
    </div>
  )
}
