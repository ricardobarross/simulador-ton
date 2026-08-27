'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Perfil, Configuracao, PapelUsuario } from '@/types'

export default function ConfiguracoesPage() {
  const { perfil, ehProprietario } = useAuth()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [salvandoConta, setSalvandoConta] = useState(false)

  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [configs, setConfigs] = useState<Configuracao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvandoConfig, setSalvandoConfig] = useState<string | null>(null)

  useEffect(() => {
    setNome(perfil?.nome ?? '')
    setTelefone(perfil?.telefone ?? '')
  }, [perfil])

  async function carregar() {
    setCarregando(true)
    const supabase = createClient()
    if (ehProprietario) {
      const [usuariosRes, configsRes] = await Promise.all([
        supabase.from('perfis').select('*').order('created_at'),
        supabase.from('configuracoes').select('*').order('chave'),
      ])
      setUsuarios((usuariosRes.data ?? []) as Perfil[])
      setConfigs((configsRes.data ?? []) as Configuracao[])
    }
    setCarregando(false)
  }

  useEffect(() => { if (perfil) carregar() }, [perfil, ehProprietario])

  async function guardarConta() {
    if (!perfil) return
    setSalvandoConta(true)
    const supabase = createClient()
    await supabase.from('perfis').update({ nome, telefone: telefone || null }).eq('id', perfil.id)
    setSalvandoConta(false)
  }

  async function alterarPapel(usuario: Perfil, papel: PapelUsuario) {
    const supabase = createClient()
    await supabase.from('perfis').update({ papel }).eq('id', usuario.id)
    await carregar()
  }

  async function alterarAtivo(usuario: Perfil, ativo: boolean) {
    const supabase = createClient()
    await supabase.from('perfis').update({ ativo }).eq('id', usuario.id)
    await carregar()
  }

  async function guardarConfig(chave: string, valor: string) {
    setSalvandoConfig(chave)
    const supabase = createClient()
    await supabase.from('configuracoes').update({ valor: valor || null, updated_at: new Date().toISOString() }).eq('chave', chave)
    setSalvandoConfig(null)
  }

  if (!perfil) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Minha conta</CardTitle>
          <Badge cor={ehProprietario ? 'blue' : 'gray'}>{ehProprietario ? 'Proprietário' : 'Funcionário'}</Badge>
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nome" value={nome} onChange={e => setNome(e.target.value)} />
          <Input label="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
        </div>
        <div className="flex justify-end mt-4">
          <Button variante="primario" carregando={salvandoConta} onClick={guardarConta}>Guardar</Button>
        </div>
      </Card>

      {ehProprietario && (
        <>
          {carregando ? <LoadingSpinner /> : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Usuários e níveis de acesso</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {usuarios.map(u => (
                    <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.nome}{u.id === perfil.id && <span className="text-xs text-gray-400"> (você)</span>}</p>
                        <p className="text-xs text-gray-400">{u.telefone ?? 'sem telefone'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={u.papel}
                          onChange={e => alterarPapel(u, e.target.value as PapelUsuario)}
                          disabled={u.id === perfil.id}
                          className="text-xs rounded-lg border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                        >
                          <option value="funcionario">Funcionário</option>
                          <option value="proprietario">Proprietário</option>
                        </select>
                        <Badge cor={u.ativo ? 'green' : 'gray'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge>
                        {u.id !== perfil.id && (
                          <Button variante="ghost" tamanho="sm" onClick={() => alterarAtivo(u, !u.ativo)}>
                            {u.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Novos funcionários criam a própria conta na tela de login (&quot;Criar conta&quot;) e entram automaticamente como Funcionário.
                </p>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dados da empresa</CardTitle>
                </CardHeader>
                <p className="text-xs text-gray-500 mb-4">
                  Aparecem no cabeçalho de faturas, orçamentos e ordens de serviço impressas.
                </p>
                <div className="space-y-3">
                  {configs.filter(c => c.chave.startsWith('empresa_')).map(c => (
                    <ConfigField
                      key={c.chave}
                      config={c}
                      salvando={salvandoConfig === c.chave}
                      onGuardar={(valor) => guardarConfig(c.chave, valor)}
                    />
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dados para pagamento (PIX)</CardTitle>
                </CardHeader>
                <p className="text-xs text-gray-500 mb-4">
                  Aparecem no extrato do cliente e no fechamento de conta, para facilitar a transferência.
                </p>
                <div className="space-y-3">
                  {configs.filter(c => c.chave.startsWith('pix_') || c.chave === 'dados_bancarios').map(c => (
                    <ConfigField
                      key={c.chave}
                      config={c}
                      salvando={salvandoConfig === c.chave}
                      onGuardar={(valor) => guardarConfig(c.chave, valor)}
                    />
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Integrações (chaves de API)</CardTitle>
                </CardHeader>
                <p className="text-xs text-gray-500 mb-4">
                  A chave da Groq é obrigatória para a secretária IA (botão de chat no canto da tela) funcionar. As chaves de WhatsApp são opcionais — só necessárias se um dia quiser envio automático de mensagens; hoje o sistema gera a mensagem e abre o WhatsApp manualmente.
                </p>
                <div className="space-y-3">
                  {configs.filter(c => !c.chave.startsWith('pix_') && !c.chave.startsWith('empresa_') && c.chave !== 'dados_bancarios').map(c => (
                    <ConfigField
                      key={c.chave}
                      config={c}
                      salvando={salvandoConfig === c.chave}
                      onGuardar={(valor) => guardarConfig(c.chave, valor)}
                    />
                  ))}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}

function ConfigField({
  config, salvando, onGuardar,
}: { config: Configuracao; salvando: boolean; onGuardar: (valor: string) => void }) {
  const [valor, setValor] = useState(config.valor ?? '')
  const alterado = valor !== (config.valor ?? '')
  const ehSegredo = /key|chave|token|secret/i.test(config.chave)

  return (
    <div className="flex items-end gap-2">
      <Input
        label={config.descricao ?? config.chave}
        type={ehSegredo ? 'password' : 'text'}
        value={valor}
        onChange={e => setValor(e.target.value)}
        placeholder="Não configurado"
        className="flex-1"
      />
      <Button variante="secundario" tamanho="sm" carregando={salvando} disabled={!alterado} onClick={() => onGuardar(valor)}>
        Guardar
      </Button>
    </div>
  )
}
