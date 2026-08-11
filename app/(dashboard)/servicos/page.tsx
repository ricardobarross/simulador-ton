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
import { Servico, CategoriaServico } from '@/types'
import { formatarMoeda } from '@/lib/utils'

const categorias: { valor: CategoriaServico; label: string }[] = [
  { valor: 'tornear', label: 'Tornear' },
  { valor: 'fresar',  label: 'Fresar' },
  { valor: 'solda',   label: 'Solda' },
  { valor: 'bancada', label: 'Bancada' },
  { valor: 'outro',   label: 'Outro' },
]

const corCategoria: Record<CategoriaServico, 'blue' | 'green' | 'orange' | 'yellow' | 'gray'> = {
  tornear: 'blue',
  fresar:  'green',
  solda:   'orange',
  bancada: 'yellow',
  outro:   'gray',
}

function ServicoForm({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial?: Partial<Servico>
  onGuardar: (dados: Partial<Servico>) => Promise<void>
  onCancelar: () => void
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [categoria, setCategoria] = useState<CategoriaServico>(inicial?.categoria ?? 'tornear')
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [precoBase, setPrecoBase] = useState(inicial?.preco_base?.toString() ?? '')
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit() {
    if (!nome.trim()) { setErro('Nome é obrigatório'); return }
    setErro('')
    setCarregando(true)
    await onGuardar({
      nome: nome.trim(),
      categoria,
      descricao: descricao.trim() || null,
      preco_base: precoBase ? parseFloat(precoBase) : null,
      ativo,
    })
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <Input label="Nome *" value={nome} onChange={e => setNome(e.target.value)} erro={erro} />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Categoria</label>
        <select
          value={categoria}
          onChange={e => setCategoria(e.target.value as CategoriaServico)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categorias.map(c => <option key={c.valor} value={c.valor}>{c.label}</option>)}
        </select>
      </div>

      <Input
        label="Preço base (opcional)"
        type="number"
        step="0.01"
        prefixo="R$"
        value={precoBase}
        onChange={e => setPrecoBase(e.target.value)}
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Descrição</label>
        <textarea
          value={descricao ?? ''}
          onChange={e => setDescricao(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="ativo" checked={ativo} onChange={e => setAtivo(e.target.checked)}
          className="rounded border-gray-300 text-blue-600" />
        <label htmlFor="ativo" className="text-sm text-gray-700">Serviço ativo</label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>
          {inicial?.id ? 'Guardar alterações' : 'Criar serviço'}
        </Button>
      </div>
    </div>
  )
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaServico | 'todos'>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Servico | undefined>()

  async function carregar() {
    setCarregando(true)
    const supabase = createClient()
    const { data } = await supabase.from('servicos').select('*').order('categoria').order('nome')
    setServicos((data ?? []) as Servico[])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function guardar(dados: Partial<Servico>) {
    const supabase = createClient()
    if (editando) {
      await supabase.from('servicos').update(dados).eq('id', editando.id)
    } else {
      await supabase.from('servicos').insert(dados)
    }
    setModalAberto(false)
    setEditando(undefined)
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este serviço?')) return
    const supabase = createClient()
    await supabase.from('servicos').delete().eq('id', id)
    await carregar()
  }

  const filtrados = filtroCategoria === 'todos' ? servicos : servicos.filter(s => s.categoria === filtroCategoria)

  if (carregando) return <LoadingSpinner texto="A carregar serviços..." />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Serviços</CardTitle>
          <Button variante="primario" onClick={() => { setEditando(undefined); setModalAberto(true) }}>
            + Novo serviço
          </Button>
        </CardHeader>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroCategoria('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtroCategoria === 'todos' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Todos
          </button>
          {categorias.map(c => (
            <button
              key={c.valor}
              onClick={() => setFiltroCategoria(c.valor)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtroCategoria === c.valor ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Card>

      <Card padding={false}>
        {filtrados.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Nenhum serviço encontrado</p>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Nome</Th>
                <Th>Categoria</Th>
                <Th className="text-right">Preço base</Th>
                <Th>Estado</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </TableHead>
            <TableBody>
              {filtrados.map(s => (
                <TableRow key={s.id}>
                  <Td>
                    <span className="font-medium text-gray-900">{s.nome}</span>
                    {s.descricao && <span className="block text-xs text-gray-400">{s.descricao}</span>}
                  </Td>
                  <Td><Badge cor={corCategoria[s.categoria]}>{categorias.find(c => c.valor === s.categoria)?.label}</Badge></Td>
                  <Td className="text-right">{s.preco_base ? formatarMoeda(s.preco_base) : '—'}</Td>
                  <Td><Badge cor={s.ativo ? 'green' : 'gray'}>{s.ativo ? 'Ativo' : 'Inativo'}</Badge></Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variante="ghost" tamanho="sm" onClick={() => { setEditando(s); setModalAberto(true) }}>Editar</Button>
                      <Button variante="perigo" tamanho="sm" onClick={() => excluir(s.id)}>Excluir</Button>
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
        titulo={editando ? 'Editar serviço' : 'Novo serviço'}
      >
        <ServicoForm inicial={editando} onGuardar={guardar} onCancelar={() => { setModalAberto(false); setEditando(undefined) }} />
      </Modal>
    </div>
  )
}
