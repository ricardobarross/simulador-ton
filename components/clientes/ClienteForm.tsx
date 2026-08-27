'use client'

import { useState } from 'react'
import { Cliente } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface ClienteFormProps {
  inicial?: Partial<Cliente>
  onGuardar: (dados: Partial<Cliente>) => Promise<void>
  onCancelar: () => void
}

export function ClienteForm({ inicial, onGuardar, onCancelar }: ClienteFormProps) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [telefone, setTelefone] = useState(inicial?.telefone ?? '')
  const [cpfCnpj, setCpfCnpj] = useState(inicial?.cpf_cnpj ?? '')
  const [endereco, setEndereco] = useState(inicial?.endereco ?? '')
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit() {
    if (!nome.trim()) {
      setErro('Nome é obrigatório')
      return
    }
    setErro('')
    setCarregando(true)
    await onGuardar({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      cpf_cnpj: cpfCnpj.trim() || null,
      endereco: endereco.trim() || null,
      ativo,
    })
    setCarregando(false)
  }

  return (
    <div className="space-y-4">
      <Input
        label="Nome *"
        value={nome}
        onChange={e => setNome(e.target.value)}
        erro={erro}
        placeholder="Nome do cliente"
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Telefone"
          value={telefone ?? ''}
          onChange={e => setTelefone(e.target.value)}
          placeholder="(00) 00000-0000"
        />
        <Input
          label="CPF / CNPJ"
          value={cpfCnpj ?? ''}
          onChange={e => setCpfCnpj(e.target.value)}
          placeholder="000.000.000-00"
        />
      </div>

      <Input
        label="Endereço"
        value={endereco ?? ''}
        onChange={e => setEndereco(e.target.value)}
        placeholder="Rua, número, bairro, cidade — UF"
      />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ativo"
          checked={ativo}
          onChange={e => setAtivo(e.target.checked)}
          className="rounded border-gray-300 text-blue-600"
        />
        <label htmlFor="ativo" className="text-sm text-gray-700">Cliente ativo</label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variante="secundario" onClick={onCancelar} disabled={carregando}>
          Cancelar
        </Button>
        <Button variante="primario" carregando={carregando} onClick={handleSubmit}>
          {inicial?.id ? 'Guardar alterações' : 'Criar cliente'}
        </Button>
      </div>
    </div>
  )
}
