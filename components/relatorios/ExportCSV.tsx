'use client'

import { Button } from '@/components/ui/Button'

export function paraCSV(linhas: Record<string, string | number>[]): string {
  if (linhas.length === 0) return ''
  const colunas = Object.keys(linhas[0])
  const escapar = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const cabecalho = colunas.join(';')
  const corpo = linhas.map(l => colunas.map(c => escapar(l[c])).join(';')).join('\n')
  return `${cabecalho}\n${corpo}`
}

export function baixarCSV(nomeArquivo: string, linhas: Record<string, string | number>[]) {
  const csv = paraCSV(linhas)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

interface ExportCSVProps {
  nomeArquivo: string
  linhas: Record<string, string | number>[]
  label?: string
}

export function ExportCSV({ nomeArquivo, linhas, label = 'Exportar CSV' }: ExportCSVProps) {
  return (
    <Button variante="secundario" tamanho="sm" onClick={() => baixarCSV(nomeArquivo, linhas)} disabled={linhas.length === 0}>
      {label}
    </Button>
  )
}
