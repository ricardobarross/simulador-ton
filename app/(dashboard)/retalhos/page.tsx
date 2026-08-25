'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHead, TableBody, Th, Td, TableRow } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { executarOperacao } from '@/lib/api-helpers'
import { useToast } from '@/lib/toast-context'
import { Retalho, FormatoRetalho, StatusRetalho } from '@/types'
import { formatarData } from '@/lib/utils'

const formatos: { valor: FormatoRetalho; label: string }[] = [
  { valor: 'tarugo',            label: 'Tarugo'           },
  { valor: 'chapa',              label: 'Chapa'            },
  { valor: 'tubo',                label: 'Tubo'             },
  { valor: 'barra_sextavada',    label: 'Barra sextavada'  },
  { valor: 'outro',               label: 'Outro'            },
]
const labelFormato: Record<FormatoRetalho, string> = Object.fromEntries(formatos.map(f => [f.valor, f.label])) as Record<FormatoRetalho, string>

function RetalhoForm({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial?: Partial<Retalho>
  onGuardar: (dados: Partial<Retalho>) => Promise<void>
  onCancelar: () => void
}) {
  const [material, setMaterial] = useState(inicial?.material ?? '')
  const [formato, setFormato] = useState<FormatoRetalho>(inicial?.formato ?? 'tarugo')
  const [dimensoes, setDimensoes] = useState(inicial?.dimensoes ?? '')
  const [localizacao, setLocalizacao] = useState(inicial?.localizacao ?? '')
  const [status, setStatus] = useState<StatusRetalho>(inicial?.status ?? 'disponivel')
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '')
  const [carregando, setCarregando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})

  async function handleSubmit() {
    const e: Record<string, string> = {}
    if (!material.trim()) e.material = 'Material é obrigatório'
    if (!dimensoes.trim()) e.dimensoes = 'Dimensões são obrigatórias (ex.: Ø 50mm x 300mm)'
    setErros(e)
    if (Object.keys(e).length > 0) return

    setCarregando(true)
    await onGuardar({
      material: material.trim(),
      formato,
      dimensoes: dimensoes.trim(),
      localizacao: localizacao.trim() || null,
      status,
      observacoes: observacoes.trim() || null,
    })
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <Input label="Material *" placeholder="Ex.: Aço 1045, Inox 304, Nylon, Bronze TM23" value={material} onChange={e => setMaterial(e.target.value)} erro={erros.material} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Formato</label>
          <select
            value={formato}
            onChange={e => setFormato(e.target.value as FormatoRetalho)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {formatos.map(f => <option key={f.valor} value={f.valor}>{f.label}</option>)}
          </select>
        </div>
        <Input label="Dimensões *" placeholder="Ex.: Ø 50mm x 300mm" value={dimensoes} onChange={e => setDimensoes(e.target.value)} erro={erros.dimensoes} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Localização" placeholder="Ex.: Prateleira B2" value={localizacao ?? ''} onChange={e => setLocalizacao(e.target.value)} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Estado</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as StatusRetalho)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="disponivel">Disponível</option>
            <option value="utilizado">Utilizado</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Observações</label>
        <textarea
          value={observacoes ?? ''}
          onChange={e => setObservacoes(e.target.value)}
          rows={2}
          placeholder="Origem da sobra, condições, restrições de uso..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>
          {inicial?.id ? 'Guardar alterações' : 'Cadastrar retalho'}
        </Button>
      </div>
    </div>
  )
}

export default function RetalhosPage() {
  const { perfil } = useAuth()
  const { mostrarErro, mostrarSucesso } = useToast()
  const [retalhos, setRetalhos] = useState<Retalho[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusRetalho | 'todos'>('disponivel')
  const [filtroFormato, setFiltroFormato] = useState<FormatoRetalho | 'todos'>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Retalho | undefined>()

  async function carregar() {
    setCarregando(true)
    const supabase = createClient()
    const resultado = await executarOperacao(() =>
      supabase.from('retalhos').select('*').is('deleted_at', null).order('created_at', { ascending: false })
    )
    if (!resultado.ok) {
      mostrarErro(`Não foi possível carregar os retalhos: ${resultado.erro}`)
      setCarregando(false)
      return
    }
    setRetalhos((resultado.data ?? []) as Retalho[])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(dados: Partial<Retalho>) {
    const supabase = createClient()
    const resultado = editando
      ? await executarOperacao(() => supabase.from('retalhos').update(dados).eq('id', editando.id).select().single())
      : await executarOperacao(() => supabase.from('retalhos').insert({ ...dados, created_by: perfil?.id ?? null }).select().single())

    if (!resultado.ok) {
      mostrarErro(`Não foi possível guardar o retalho: ${resultado.erro}`)
      return // modal continua aberto — nada foi salvo
    }
    mostrarSucesso(editando ? 'Retalho atualizado.' : 'Retalho cadastrado.')
    setModalAberto(false)
    setEditando(undefined)
    await carregar()
  }

  async function marcarUtilizado(r: Retalho) {
    const supabase = createClient()
    const resultado = await executarOperacao(() => supabase.from('retalhos').update({ status: 'utilizado' }).eq('id', r.id).select().single())
    if (!resultado.ok) {
      mostrarErro(`Não foi possível atualizar: ${resultado.erro}`)
      return
    }
    mostrarSucesso('Retalho marcado como utilizado.')
    await carregar()
  }

  async function excluir(r: Retalho) {
    if (!confirm(`Excluir o registro deste retalho de ${r.material}?`)) return
    const supabase = createClient()
    // Soft delete, mesmo padrão do resto do sistema: o banco recusa DELETE físico.
    const resultado = await executarOperacao(() => supabase.from('retalhos').update({ deleted_at: new Date().toISOString() }).eq('id', r.id).select().single())
    if (!resultado.ok) {
      mostrarErro(`Não foi possível excluir: ${resultado.erro}`)
      return
    }
    mostrarSucesso('Retalho excluído.')
    await carregar()
  }

  const filtrados = retalhos
    .filter(r => filtroStatus === 'todos' || r.status === filtroStatus)
    .filter(r => filtroFormato === 'todos' || r.formato === filtroFormato)
    .filter(r =>
      r.material.toLowerCase().includes(busca.toLowerCase()) ||
      r.dimensoes.toLowerCase().includes(busca.toLowerCase()) ||
      (r.localizacao ?? '').toLowerCase().includes(busca.toLowerCase())
    )

  if (carregando) return <LoadingSpinner texto="A carregar retalhos..." />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Retalhos e sobras de matéria-prima</CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">Consulte antes de comprar um tarugo, chapa ou tubo inteiro novo</p>
          </div>
          <Button variante="primario" onClick={() => { setEditando(undefined); setModalAberto(true) }}>
            + Novo retalho
          </Button>
        </CardHeader>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Input placeholder="Buscar por material, dimensões ou localização..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />
          <div className="flex gap-2 flex-wrap">
            {(['disponivel', 'utilizado', 'todos'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFiltroStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filtroStatus === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s === 'disponivel' ? 'Disponíveis' : s === 'utilizado' ? 'Utilizados' : 'Todos'}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFiltroFormato('todos')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtroFormato === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Todos formatos
            </button>
            {formatos.map(f => (
              <button
                key={f.valor}
                onClick={() => setFiltroFormato(f.valor)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtroFormato === f.valor ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card padding={false}>
        {filtrados.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Nenhum retalho encontrado</p>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Material</Th>
                <Th>Formato</Th>
                <Th>Dimensões</Th>
                <Th>Localização</Th>
                <Th>Estado</Th>
                <Th>Cadastrado em</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </TableHead>
            <TableBody>
              {filtrados.map(r => (
                <TableRow key={r.id}>
                  <Td>
                    <span className="font-medium text-gray-900">{r.material}</span>
                    {r.observacoes && <span className="block text-xs text-gray-400">{r.observacoes}</span>}
                  </Td>
                  <Td>{labelFormato[r.formato]}</Td>
                  <Td className="font-mono text-xs">{r.dimensoes}</Td>
                  <Td>{r.localizacao ?? '—'}</Td>
                  <Td><Badge cor={r.status === 'disponivel' ? 'green' : 'gray'}>{r.status === 'disponivel' ? 'Disponível' : 'Utilizado'}</Badge></Td>
                  <Td className="text-xs text-gray-400">{formatarData(r.created_at)}</Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === 'disponivel' && (
                        <Button variante="secundario" tamanho="sm" onClick={() => marcarUtilizado(r)}>Marcar utilizado</Button>
                      )}
                      <Button variante="ghost" tamanho="sm" onClick={() => { setEditando(r); setModalAberto(true) }}>Editar</Button>
                      <Button variante="perigo" tamanho="sm" onClick={() => excluir(r)}>Excluir</Button>
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
        titulo={editando ? 'Editar retalho' : 'Novo retalho'}
      >
        <RetalhoForm inicial={editando} onGuardar={guardar} onCancelar={() => { setModalAberto(false); setEditando(undefined) }} />
      </Modal>
    </div>
  )
}
