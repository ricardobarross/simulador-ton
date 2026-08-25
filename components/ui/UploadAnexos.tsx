'use client'

import { useRef, useState } from 'react'
import { Anexo } from '@/types'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase'

const BUCKET = 'desenhos-e-pecas'
const TAMANHO_MAX = 10 * 1024 * 1024 // 10MB — mesmo limite configurado no bucket

interface UploadAnexosProps {
  anexos: Anexo[]
  onChange: (anexos: Anexo[]) => void
  /** Pasta dentro do bucket para organizar os arquivos, ex.: "orcamentos/<id>". */
  pasta: string
}

export function UploadAnexos({ anexos, onChange, pasta }: UploadAnexosProps) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setErro('')
    setEnviando(true)
    const supabase = createClient()
    const novos: Anexo[] = []
    const erros: string[] = []

    for (const file of Array.from(files)) {
      if (file.size > TAMANHO_MAX) {
        erros.push(`"${file.name}" excede 10MB e foi ignorado.`)
        continue
      }
      const extensao = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const caminho = `${pasta}/${crypto.randomUUID()}.${extensao}`
      const { error } = await supabase.storage.from(BUCKET).upload(caminho, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (error) {
        erros.push(`Não foi possível enviar "${file.name}": ${error.message}`)
        continue
      }
      const { data: publico } = supabase.storage.from(BUCKET).getPublicUrl(caminho)
      novos.push({
        url: publico.publicUrl,
        nome: file.name,
        tipo: file.type || 'application/octet-stream',
        tamanho: file.size,
        criado_em: new Date().toISOString(),
      })
    }

    if (novos.length > 0) onChange([...anexos, ...novos])
    if (erros.length > 0) setErro(erros.join(' '))
    setEnviando(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function remover(url: string) {
    onChange(anexos.filter(a => a.url !== url))
    // Isto só remove a referência aqui — o arquivo continua no Storage
    // (evita apagar algo que porventura esteja referenciado em outro lugar).
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Fotos e desenhos técnicos</label>
        <Button variante="secundario" tamanho="sm" carregando={enviando} onClick={() => inputRef.current?.click()}>
          + Anexar arquivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {anexos.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum anexo ainda. Adicione fotos da peça danificada ou do desenho com medidas.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {anexos.map(a => (
            <div key={a.url} className="relative group border border-gray-200 rounded-lg overflow-hidden">
              {a.tipo.startsWith('image/') ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.nome} className="w-full h-24 object-cover" />
                </a>
              ) : (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-24 bg-gray-50 gap-1 text-gray-500 px-1">
                  <svg className="w-7 h-7 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-[10px] truncate w-full text-center">{a.nome}</span>
                </a>
              )}
              <button
                onClick={() => remover(a.url)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remover anexo"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
