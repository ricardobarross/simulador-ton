'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Cliente } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { formatarMoeda } from '@/lib/utils'
import { DadosChequeManual } from '@/lib/cheques'

interface OrdemResumo {
  id: string
  numero: string
  total: number
  cliente_nome: string
}

interface NovoChequeFormProps {
  onGuardar: (dados: DadosChequeManual) => Promise<void>
  onCancelar: () => void
}

/**
 * Cadastro manual de um cheque recebido fora do fluxo normal de pagamento de
 * O.S. — o caso típico é um cheque que cobre uma ou mais O.S. que já foram
 * marcadas como pagas por outro meio, e o Ricardo só quer o registro do
 * cheque vinculado a elas pra controle (não gera lançamento novo ao
 * compensar — ver aviso no fim do formulário).
 */
export function NovoChequeForm({ onGuardar, onCancelar }: NovoChequeFormProps) {
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nome'>[]>([])
  const [clienteId, setClienteId] = useState('')
  const [numeroCheque, setNumeroCheque] = useState('')
  const [banco, setBanco] = useState('')
  const [agencia, setAgencia] = useState('')
  const [numeroConta, setNumeroConta] = useState('')
  const [nomeTitular, setNomeTitular] = useState('')
  const [telefone, setTelefone] = useState('')
  const [valor, setValor] = useState('')
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().slice(0, 10))
  const [observacoes, setObservacoes] = useState('')

  const [ordensDisponiveis, setOrdensDisponiveis] = useState<OrdemResumo[]>([])
  const [ordensSelecionadas, setOrdensSelecionadas] = useState<OrdemResumo[]>([])

  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('clientes').select('id, nome').eq('ativo', true).is('deleted_at', null).order('nome').then(({ data }) => {
      setClientes(data ?? [])
    })
    supabase
      .from('ordens_servico')
      .select('id, numero, total, cliente:clientes(nome)')
      .is('deleted_at', null)
      .neq('status', 'cancelada')
      .order('numero', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        const linhas = (data ?? []) as { id: string; numero: string; total: number; cliente: { nome: string } | { nome: string }[] | null }[]
        setOrdensDisponiveis(linhas.map(o => {
          const cliente = Array.isArray(o.cliente) ? o.cliente[0] : o.cliente
          return { id: o.id, numero: o.numero, total: o.total, cliente_nome: cliente?.nome ?? '—' }
        }))
      })
  }, [])

  function adicionarOrdem(id: string) {
    const ordem = ordensDisponiveis.find(o => o.id === id)
    if (!ordem || ordensSelecionadas.some(o => o.id === id)) return
    setOrdensSelecionadas(prev => [...prev, ordem])
  }

  function removerOrdem(id: string) {
    setOrdensSelecionadas(prev => prev.filter(o => o.id !== id))
  }

  async function handleSubmit() {
    if (!numeroCheque.trim() || !banco.trim() || !nomeTitular.trim() || !valor) {
      setErro('Preenche número do cheque, banco, titular e valor.')
      return
    }
    setErro('')
    setCarregando(true)
    await onGuardar({
      numeroCheque: numeroCheque.trim(),
      banco: banco.trim(),
      agencia: agencia.trim(),
      numeroConta: numeroConta.trim(),
      nomeTitular: nomeTitular.trim(),
      telefone: telefone.trim(),
      valor: parseFloat(valor),
      dataRecebimento,
      clienteId: clienteId || null,
      observacoes: observacoes.trim() || null,
      ordensServicoIds: ordensSelecionadas.map(o => o.id),
    })
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Cliente (opcional)</label>
        <SearchableSelect
          value={clienteId}
          onChange={setClienteId}
          placeholder="Vincular a um cliente..."
          options={clientes.map(c => ({ value: c.id, label: c.nome }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Número do cheque *" value={numeroCheque} onChange={e => setNumeroCheque(e.target.value)} erro={erro} />
        <Input label="Valor *" type="number" step="0.01" prefixo="R$" value={valor} onChange={e => setValor(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Banco *" value={banco} onChange={e => setBanco(e.target.value)} />
        <Input label="Agência" value={agencia} onChange={e => setAgencia(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Número da conta" value={numeroConta} onChange={e => setNumeroConta(e.target.value)} />
        <Input label="Data de recebimento" type="date" value={dataRecebimento} onChange={e => setDataRecebimento(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Nome do titular *" value={nomeTitular} onChange={e => setNomeTitular(e.target.value)} />
        <Input label="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Vincular a O.S. já pagas (opcional)</label>
        <SearchableSelect
          value=""
          onChange={adicionarOrdem}
          limparAposEscolher
          placeholder="Buscar O.S. por número..."
          options={ordensDisponiveis
            .filter(o => !ordensSelecionadas.some(sel => sel.id === o.id))
            .map(o => ({ value: o.id, label: `${o.numero} — ${o.cliente_nome} — ${formatarMoeda(o.total)}` }))}
        />
        {ordensSelecionadas.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {ordensSelecionadas.map(o => (
              <span key={o.id} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                {o.numero}
                <button type="button" onClick={() => removerOrdem(o.id)} className="text-blue-400 hover:text-blue-700">×</button>
              </span>
            ))}
          </div>
        )}
        {ordensSelecionadas.length > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            Essas O.S. já estão marcadas como pagas — este cheque fica só como registro/comprovante vinculado a elas.
            Ao compensar, não vai gerar um lançamento novo no caixa/banco (o dinheiro já foi contado).
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Observações</label>
        <textarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>Cancelar</Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>Cadastrar cheque</Button>
      </div>
    </div>
  )
}
