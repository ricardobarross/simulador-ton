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
import { ContaFixa, ContaVariavel, StatusConta, Fornecedor } from '@/types'
import { formatarMoeda, formatarData, statusLancamento } from '@/lib/utils'
import { executarOperacao } from '@/lib/api-helpers'
import { useToast } from '@/lib/toast-context'
import { pagarConta } from '@/lib/contas'
import { PagarContaForm } from '@/components/cadastros/PagarContaForm'

// ─── Contas fixas ─────────────────────────────────────────────
function ContaFixaForm({
  inicial, onGuardar, onCancelar,
}: { inicial?: Partial<ContaFixa>; onGuardar: (d: Partial<ContaFixa>) => Promise<void>; onCancelar: () => void }) {
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [valor, setValor] = useState(inicial?.valor?.toString() ?? '')
  const [diaVencimento, setDiaVencimento] = useState(inicial?.dia_vencimento?.toString() ?? '10')
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '')
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit() {
    if (!descricao.trim() || !valor) { setErro('Descrição e valor são obrigatórios'); return }
    setErro('')
    setCarregando(true)
    await onGuardar({
      descricao: descricao.trim(),
      valor: parseFloat(valor),
      dia_vencimento: parseInt(diaVencimento) || 1,
      categoria: categoria.trim() || null,
      ativo,
    })
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <Input label="Descrição *" value={descricao} onChange={e => setDescricao(e.target.value)} erro={erro} placeholder="Ex: Aluguel, energia, internet..." />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Valor *" type="number" step="0.01" prefixo="R$" value={valor} onChange={e => setValor(e.target.value)} />
        <Input label="Dia do vencimento" type="number" min="1" max="31" value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)} />
      </div>
      <Input label="Categoria" value={categoria ?? ''} onChange={e => setCategoria(e.target.value)} placeholder="Ex: Estrutura, utilidades..." />
      <div className="flex items-center gap-2">
        <input type="checkbox" id="ativo" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
        <label htmlFor="ativo" className="text-sm text-gray-700">Ativa</label>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>{inicial?.id ? 'Guardar' : 'Criar'}</Button>
      </div>
    </div>
  )
}

// ─── Contas variáveis ───────────────────────────────────────
function ContaVariavelForm({
  inicial, fornecedores, onGuardar, onCancelar,
}: {
  inicial?: Partial<ContaVariavel>
  fornecedores: Fornecedor[]
  onGuardar: (d: Partial<ContaVariavel>) => Promise<void>
  onCancelar: () => void
}) {
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [valor, setValor] = useState(inicial?.valor?.toString() ?? '')
  const [dataVencimento, setDataVencimento] = useState(inicial?.data_vencimento ?? new Date().toISOString().slice(0, 10))
  const [fornecedorId, setFornecedorId] = useState(inicial?.fornecedor_id ?? '')
  const [status, setStatus] = useState<StatusConta>(inicial?.status ?? 'pendente')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit() {
    if (!descricao.trim() || !valor) { setErro('Descrição e valor são obrigatórios'); return }
    setErro('')
    setCarregando(true)
    await onGuardar({
      descricao: descricao.trim(),
      valor: parseFloat(valor),
      data_vencimento: dataVencimento,
      fornecedor_id: fornecedorId || null,
      status,
    })
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <Input label="Descrição *" value={descricao} onChange={e => setDescricao(e.target.value)} erro={erro} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Valor *" type="number" step="0.01" prefixo="R$" value={valor} onChange={e => setValor(e.target.value)} />
        <Input label="Vencimento" type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Fornecedor</label>
        <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">—</option>
          {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Estado</label>
        <select value={status} onChange={e => setStatus(e.target.value as StatusConta)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>{inicial?.id ? 'Guardar' : 'Criar'}</Button>
      </div>
    </div>
  )
}

export default function ContasPage() {
  const { mostrarErro, mostrarSucesso } = useToast()
  const [aba, setAba] = useState<'fixas' | 'variaveis'>('fixas')
  const [fixas, setFixas] = useState<ContaFixa[]>([])
  const [variaveis, setVariaveis] = useState<ContaVariavel[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editandoFixa, setEditandoFixa] = useState<ContaFixa | undefined>()
  const [editandoVariavel, setEditandoVariavel] = useState<ContaVariavel | undefined>()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusConta | 'todos'>('todos')
  const [fixasPagasEsteMes, setFixasPagasEsteMes] = useState<Set<string>>(new Set())
  const [pagando, setPagando] = useState<{ tipo: 'fixa' | 'variavel'; id: string; descricao: string; valor: number; dataSugerida: string } | null>(null)

  async function carregar() {
    setCarregando(true)
    const supabase = createClient()
    const hoje = new Date()
    const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    const [fixasRes, variaveisRes, fornecedoresRes, lancsFixasRes] = await Promise.all([
      executarOperacao(() => supabase.from('contas_fixas').select('*').order('dia_vencimento')),
      executarOperacao(() => supabase.from('contas_variaveis').select('*, fornecedor:fornecedores(*)').order('data_vencimento')),
      executarOperacao(() => supabase.from('fornecedores').select('*').eq('ativo', true).order('nome')),
      executarOperacao(() => supabase.from('lancamentos').select('conta_fixa_id').eq('status', 'pago').is('deleted_at', null).not('conta_fixa_id', 'is', null).gte('data', inicioMes)),
    ])
    if (!fixasRes.ok) mostrarErro(`Não foi possível carregar as contas fixas: ${fixasRes.erro}`)
    if (!variaveisRes.ok) mostrarErro(`Não foi possível carregar as contas variáveis: ${variaveisRes.erro}`)
    setFixas(fixasRes.ok ? (fixasRes.data as ContaFixa[]) : [])
    setVariaveis(variaveisRes.ok ? (variaveisRes.data as ContaVariavel[]) : [])
    setFornecedores(fornecedoresRes.ok ? (fornecedoresRes.data as Fornecedor[]) : [])
    setFixasPagasEsteMes(new Set(lancsFixasRes.ok ? (lancsFixasRes.data as { conta_fixa_id: string }[]).map(l => l.conta_fixa_id) : []))
    setCarregando(false)
  }

  async function confirmarPagamento(dados: { valor: number; formaPagamento: string; data: string; observacoes: string | null }) {
    if (!pagando) return
    const supabase = createClient()
    const resultado = await pagarConta(supabase, {
      tipo: pagando.tipo,
      contaId: pagando.id,
      valor: dados.valor,
      formaPagamento: dados.formaPagamento,
      data: dados.data,
      observacoes: dados.observacoes,
    })
    if (!resultado.ok) {
      mostrarErro(`Não foi possível registar o pagamento: ${resultado.erro}`)
      return // modal continua aberto — nada foi salvo
    }
    mostrarSucesso('Pagamento registado — já entrou em Lançamentos.')
    setPagando(null)
    await carregar()
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardarFixa(dados: Partial<ContaFixa>) {
    const supabase = createClient()
    const resultado = editandoFixa
      ? await executarOperacao(() => supabase.from('contas_fixas').update(dados).eq('id', editandoFixa.id).select().single())
      : await executarOperacao(() => supabase.from('contas_fixas').insert(dados).select().single())
    if (!resultado.ok) {
      mostrarErro(`Não foi possível guardar a conta fixa: ${resultado.erro}`)
      return // modal continua aberto — nada foi salvo
    }
    mostrarSucesso(editandoFixa ? 'Conta fixa atualizada.' : 'Conta fixa criada.')
    setModalAberto(false); setEditandoFixa(undefined)
    await carregar()
  }

  async function guardarVariavel(dados: Partial<ContaVariavel>) {
    const supabase = createClient()
    const resultado = editandoVariavel
      ? await executarOperacao(() => supabase.from('contas_variaveis').update(dados).eq('id', editandoVariavel.id).select().single())
      : await executarOperacao(() => supabase.from('contas_variaveis').insert(dados).select().single())
    if (!resultado.ok) {
      mostrarErro(`Não foi possível guardar a conta: ${resultado.erro}`)
      return // modal continua aberto — nada foi salvo
    }
    mostrarSucesso(editandoVariavel ? 'Conta atualizada.' : 'Conta criada.')
    setModalAberto(false); setEditandoVariavel(undefined)
    await carregar()
  }

  async function excluirFixa(id: string) {
    if (!confirm('Excluir esta conta fixa?')) return
    const supabase = createClient()
    const resultado = await executarOperacao(() => supabase.from('contas_fixas').delete().eq('id', id).select().single())
    if (!resultado.ok) {
      mostrarErro(`Não foi possível excluir: ${resultado.erro}`)
      return
    }
    mostrarSucesso('Conta fixa excluída.')
    await carregar()
  }

  async function excluirVariavel(id: string) {
    if (!confirm('Excluir esta conta?')) return
    const supabase = createClient()
    const resultado = await executarOperacao(() => supabase.from('contas_variaveis').delete().eq('id', id).select().single())
    if (!resultado.ok) {
      mostrarErro(`Não foi possível excluir: ${resultado.erro}`)
      return
    }
    mostrarSucesso('Conta excluída.')
    await carregar()
  }

  if (carregando) return <LoadingSpinner texto="A carregar contas..." />

  const fixasFiltradas = fixas.filter(c => c.descricao.toLowerCase().includes(busca.toLowerCase()))
  const variaveisFiltradas = variaveis
    .filter(c => filtroStatus === 'todos' || c.status === filtroStatus)
    .filter(c => c.descricao.toLowerCase().includes(busca.toLowerCase()) || (c.fornecedor?.nome ?? '').toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contas a pagar</CardTitle>
          <Button
            variante="primario"
            onClick={() => { setEditandoFixa(undefined); setEditandoVariavel(undefined); setModalAberto(true) }}
          >
            + Nova conta {aba === 'fixas' ? 'fixa' : 'variável'}
          </Button>
        </CardHeader>
        <div className="flex gap-2">
          <button onClick={() => setAba('fixas')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${aba === 'fixas' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Contas fixas
          </button>
          <button onClick={() => setAba('variaveis')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${aba === 'variaveis' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Contas variáveis
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Input placeholder="Buscar por descrição..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />
          {aba === 'variaveis' && (
            <div className="flex gap-2">
              {(['todos', 'pendente', 'pago', 'cancelado'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFiltroStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filtroStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {s === 'todos' ? 'Todos' : statusLancamento[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {aba === 'fixas' ? (
        <Card padding={false}>
          {fixasFiltradas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Nenhuma conta fixa cadastrada</p>
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <Th>Descrição</Th>
                  <Th>Categoria</Th>
                  <Th>Dia venc.</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </TableHead>
              <TableBody>
                {fixasFiltradas.map(c => (
                  <TableRow key={c.id}>
                    <Td className="font-medium text-gray-900">{c.descricao}</Td>
                    <Td>{c.categoria ?? '—'}</Td>
                    <Td>Dia {c.dia_vencimento}</Td>
                    <Td className="text-right">{formatarMoeda(c.valor)}</Td>
                    <Td>
                      {fixasPagasEsteMes.has(c.id) ? (
                        <Badge cor="green">Pago este mês</Badge>
                      ) : (
                        <Badge cor={c.ativo ? 'yellow' : 'gray'}>{c.ativo ? 'A pagar' : 'Inativa'}</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.ativo && !fixasPagasEsteMes.has(c.id) && (
                          <Button
                            variante="primario"
                            tamanho="sm"
                            onClick={() => setPagando({ tipo: 'fixa', id: c.id, descricao: c.descricao, valor: c.valor, dataSugerida: new Date().toISOString().slice(0, 10) })}
                          >
                            Pagar
                          </Button>
                        )}
                        <Button variante="ghost" tamanho="sm" onClick={() => { setEditandoFixa(c); setModalAberto(true) }}>Editar</Button>
                        <Button variante="perigo" tamanho="sm" onClick={() => excluirFixa(c.id)}>Excluir</Button>
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      ) : (
        <Card padding={false}>
          {variaveisFiltradas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Nenhuma conta variável encontrada</p>
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <Th>Descrição</Th>
                  <Th>Fornecedor</Th>
                  <Th>Vencimento</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </TableHead>
              <TableBody>
                {variaveisFiltradas.map(c => (
                  <TableRow key={c.id}>
                    <Td className="font-medium text-gray-900">{c.descricao}</Td>
                    <Td>{c.fornecedor?.nome ?? '—'}</Td>
                    <Td>{formatarData(c.data_vencimento)}</Td>
                    <Td className="text-right">{formatarMoeda(c.valor)}</Td>
                    <Td><Badge cor={statusLancamento[c.status].cor as 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red'}>{statusLancamento[c.status].label}</Badge></Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.status === 'pendente' && (
                          <Button
                            variante="primario"
                            tamanho="sm"
                            onClick={() => setPagando({ tipo: 'variavel', id: c.id, descricao: c.descricao, valor: c.valor, dataSugerida: c.data_vencimento })}
                          >
                            Pagar
                          </Button>
                        )}
                        <Button variante="ghost" tamanho="sm" onClick={() => { setEditandoVariavel(c); setModalAberto(true) }}>Editar</Button>
                        <Button variante="perigo" tamanho="sm" onClick={() => excluirVariavel(c.id)}>Excluir</Button>
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      <Modal
        aberto={modalAberto}
        onFechar={() => { setModalAberto(false); setEditandoFixa(undefined); setEditandoVariavel(undefined) }}
        titulo={aba === 'fixas' ? (editandoFixa ? 'Editar conta fixa' : 'Nova conta fixa') : (editandoVariavel ? 'Editar conta' : 'Nova conta variável')}
      >
        {aba === 'fixas' ? (
          <ContaFixaForm inicial={editandoFixa} onGuardar={guardarFixa} onCancelar={() => setModalAberto(false)} />
        ) : (
          <ContaVariavelForm inicial={editandoVariavel} fornecedores={fornecedores} onGuardar={guardarVariavel} onCancelar={() => setModalAberto(false)} />
        )}
      </Modal>

      <Modal
        aberto={!!pagando}
        onFechar={() => setPagando(null)}
        titulo="Registar pagamento"
      >
        {pagando && (
          <PagarContaForm
            descricao={pagando.descricao}
            valorReferencia={pagando.valor}
            dataSugerida={pagando.dataSugerida}
            onConfirmar={confirmarPagamento}
            onCancelar={() => setPagando(null)}
          />
        )}
      </Modal>
    </div>
  )
}
