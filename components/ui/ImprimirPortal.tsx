'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const ID_PORTAL = 'area-impressao'

function obterNoDoPortal(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  let no = document.getElementById(ID_PORTAL)
  if (!no) {
    no = document.createElement('div')
    no.id = ID_PORTAL
    document.body.appendChild(no)
  }
  return no
}

/**
 * Mostra o conteúdo normalmente onde foi colocado (ex.: dentro de um modal,
 * pra pré-visualização na tela) e, ao mesmo tempo, envia uma cópia idêntica
 * direto pro final do <body> — fora da árvore do modal, do menu lateral e de
 * tudo mais da página.
 *
 * Por quê: a impressão só mostra `.imprimir-area`, escondendo o resto com
 * `visibility: hidden` (não remove do layout). Se o extrato/fatura fica
 * aninhado dentro do modal, ele herda a altura de tudo que vem antes dele no
 * documento (menu, cards da página, cabeçalho do modal) — mesmo invisível,
 * esse espaço continua reservado, e o conteúdo acaba começando no meio de
 * uma página ou sendo cortado. Com o portal, `#area-impressao` fica fora
 * dessa árvore inteira: nada antes dele reserva espaço, então a impressão
 * começa certinho no topo da página 1 e pagina normalmente até o fim.
 */
export function ImprimirPortal({ children }: { children: React.ReactNode }) {
  const [no, setNo] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setNo(obterNoDoPortal())
  }, [])

  return (
    <>
      {children}
      {no && createPortal(children, no)}
    </>
  )
}
