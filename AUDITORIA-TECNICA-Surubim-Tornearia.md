# Auditoria Técnica — Sistema Surubim Tornearia

**Data:** 27/08/2026
**Autor:** Auditoria de código gerada por IA (Claude), a pedido do proprietário do sistema, para revisão por outro engenheiro/IA.
**Repositório:** `github.com/ricardobarross/simulador-ton` (branch `main`)
**Deploy:** Vercel, deploy manual (`vercel --prod`) — sem CI/CD automático
**Banco:** Supabase (Postgres), projeto `bkevzpuefeyamiborkft`

Este documento descreve o estado real do código, não um plano ou proposta. O objetivo é dar a qualquer engenheiro (humano ou IA) contexto suficiente para propor mudanças de arquitetura ou implementação sem precisar ler o repositório inteiro do zero.

---

## 1. Visão geral

Sistema de gestão (ERP simplificado) para uma oficina de usinagem/tornearia de pequeno porte, uso interno de uma única empresa (não multi-tenant). Cobre: cadastro de clientes/fornecedores/serviços, orçamentos, ordens de serviço, financeiro (caixa, banco, fiado, cheques, faturamento consolidado), relatórios gerenciais e um assistente conversacional (IA) que executa as mesmas operações via linguagem natural.

**Stack:**
- Next.js 16.1.6 (App Router), React 19.2.3, TypeScript 5 (`strict: true`)
- Tailwind CSS 4
- Supabase (`@supabase/supabase-js` 2.98) — Postgres + Auth + RLS + Storage (anexos)
- Groq API (LLM) para o assistente "Secretária IA", chamado via uma API route própria (`app/api/secretaria/route.ts`), chave guardada na tabela `configuracoes`
- Sem testes automatizados (não há pasta `__tests__`, nem Jest/Vitest/Playwright configurado)
- Sem CI (não há `.github/workflows`) — validação é manual (`npx tsc --noEmit`) antes de cada push, feita pela pessoa/IA que desenvolve
- Deploy manual via CLI da Vercel, rodado pelo próprio dono do sistema no PowerShell local

**Não é multi-tenant.** Todas as tabelas do domínio (clientes, ordens, lançamentos etc.) são globais — não há `empresa_id`/`tenant_id` em lugar nenhum. RLS distingue apenas dois papéis de usuário dentro da mesma empresa: `proprietario` e `funcionario`.

---

## 2. Autenticação e papéis

- Auth nativo do Supabase (email/senha). Tela única `/login` alterna entre "entrar" e "criar conta" — não há convite por admin nem recuperação de senha implementada na UI.
- Trigger `criar_perfil_no_signup` (em `auth.users` → `public.perfis`) cria automaticamente uma linha em `perfis` no signup. **Regra crítica:** o primeiro usuário a se cadastrar no sistema vira `proprietario` automaticamente (`case when (select count(*) from public.perfis) = 0 then 'proprietario' else 'funcionario' end`); todo mundo depois disso entra como `funcionario` por padrão. Não existe fluxo de "promover" um funcionário a proprietário pela UI — isso é feito manualmentte na tela de Configurações por outro proprietário, ou direto no banco.
- `papel_atual()` — function SQL (`STABLE SECURITY DEFINER`) usada dentro das policies de RLS: `select papel from public.perfis where id = auth.uid()`.
- No frontend, `lib/auth-context.tsx` expõe `useAuth()` com `{ user, perfil, carregando, ehProprietario, sair }`. `ehProprietario` é um `boolean` derivado client-side (`perfil?.papel === 'proprietario'`) usado para esconder/mostrar UI — **é só uma conveniência de interface, a segurança de verdade está nas RLS policies do banco**, checadas de novo abaixo.
- **Inconsistência encontrada:** a Sidebar (`components/layout/Sidebar.tsx`) mostra todos os 13 itens de navegação para qualquer usuário logado, incluindo "Configurações" — mesmo que grande parte do conteúdo daquela página (gestão de usuários, chaves de API, dados PIX) só renderize de fato para `ehProprietario`. Não é uma falha de segurança (RLS protege os dados), mas é uma inconsistência de UX: funcionário vê o menu mas a página fica "vazia" para ele.

---

## 3. Modelo de dados (schema Postgres real, lido direto do banco)

### 3.1 Tabelas

| Tabela | Propósito | RLS | Observações |
|---|---|---|---|
| `perfis` | Usuários do sistema e seu papel | sim | `select` liberado a todo `authenticated`; `update` só o próprio ou o dono (nome exato da policy: `perfis_update_proprio_ou_dono`) |
| `clientes` | Clientes da oficina | sim | soft delete (`deleted_at`); trigger impede exclusão se houver fiado em aberto |
| `servicos` | Catálogo de serviços (tornear/fresar/solda/bancada/outro) | sim | sem soft delete — `delete()` físico |
| `fornecedores` | Cadastro de fornecedores | sim | sem soft delete |
| `transportadoras` | Cadastro de transportadoras | sim | sem soft delete; não parece referenciada por nenhuma outra tabela (não há FK de orçamento/OS para transportadora) — parece cadastro solto, sem uso funcional ainda |
| `contas_fixas` | Contas recorrentes mensais (aluguel etc.) | sim | `dia_vencimento` (1-31), sem data real; sem soft delete |
| `contas_variaveis` | Contas pontuais vinculadas a fornecedor | sim | sem soft delete |
| `orcamentos` | Orçamentos (podem virar O.S.) | sim | `itens` e `anexos` em `jsonb`; numeração automática `ORC-0001...` via sequence |
| `ordens_servico` | Ordens de serviço | sim (policies em `public`, não `authenticated` — ver §3.3) | `itens`/`anexos`/`pagamentos` em `jsonb`; soft delete; trigger bloqueia exclusão se tiver lançamento ativo ou fiado em aberto vinculado |
| `lancamentos` | Lançamentos financeiros (entrada/saída) | sim | soft delete; coluna `destino` (`caixa`/`banco`) derivada automaticamente por trigger a partir de `forma_pagamento` |
| `fechamento_caixa` | Snapshot diário do fechamento de caixa | sim | uma linha por `data`; guarda também breakdown (`total_dinheiro`, `total_pix`, `total_cartao`, `total_outros`, `total_abates_fiado`, `total_fiado_novo`) |
| `fiados` | Vendas a prazo ("fiado", "no caderno") | sim (policies em `public`) | soft delete; `status` é **`text` livre**, não enum (`'aberto'`/`'parcial'`/`'quitado'` mantidos só por convenção de código, não por constraint no banco) |
| `fiado_pagamentos` | Baixas parciais/totais de um fiado | sim (policies em `public`) | sem soft delete (não faz sentido apagar um pagamento já feito — há trigger que impede exclusão do lançamento vinculado) |
| `faturas` | Fatura consolidada (agrupa vários fiados de um cliente numa cobrança só) | sim | numeração automática `FAT-2026-001` via sequence anual; soft delete |
| `fatura_itens` | Itens de uma fatura (um fiado por item) | sim | só tem policy de `select` — inserção deve ser feita só via RPC `criar_fatura_consolidada_atomica` (não há policy de insert direta) |
| `cheques` | Cheques recebidos (novo módulo) | sim, **restrita a `papel_atual() = 'proprietario'`** em todas as 4 policies | ver §7.3 |
| `retalhos` | Sobras de matéria-prima reaproveitáveis | sim | soft delete; único módulo "secundário" que usa o padrão `executarOperacao` + toast consistentemente |
| `configuracoes` | Chave-valor genérico (chaves de API, PIX) | sim, **confirmado restrita a `papel_atual() = 'proprietario'`** nas 4 policies (select/insert/update/delete) — funcionário não lê nem escreve nada aqui via client anônimo (ver §9, ponto de atenção sobre PIX em faturas) |
| `simulacoes`, `historico_simulacoes`, `taxas_ton` | Tabelas relacionadas ao simulador de taxas Ton | sim | **não usadas** — a página `/simulador` atual é 100% client-side com taxas hardcoded no arquivo `.tsx`, não lê nem escreve nessas tabelas. São resquício de uma versão anterior do simulador. |

### 3.2 Enums

```
categoria_servico    : tornear, fresar, solda, bancada, outro
destino_financeiro    : caixa, banco
formato_retalho       : tarugo, chapa, tubo, barra_sextavada, outro
papel_usuario         : proprietario, funcionario
status_cheque         : aguardando, compensado, devolvido
status_conta          : pendente, pago, cancelado
status_fatura         : pendente, paga, cancelada
status_lancamento     : pendente, pago, cancelado
status_orcamento      : rascunho, enviado, aprovado, recusado, expirado
status_ordem          : aberta, em_andamento, aguardando, concluida, cancelada
status_retalho        : disponivel, utilizado
tipo_lancamento       : entrada, saida
```

Nota: `fiados.status` **não** usa enum (é `text`), diferente de todos os outros campos de status do schema — inconsistência de modelagem.

### 3.3 RLS — padrão observado e inconsistência de roles

A maioria das tabelas usa policies com `roles: {authenticated}`. Um subconjunto usa `roles: {public}`: `ordens_servico`, `fiados`, `fiado_pagamentos`, `cheques` (essa última também restringe por `papel_atual()`). Não há evidência de que isso seja intencional — parece ter sido criado em momentos diferentes do desenvolvimento (RLS foi adicionada em etapas, conforme histórico de tarefas). Na prática, como o app só é acessado autenticado, não é uma brecha de segurança óbvia, mas é uma inconsistência que vale padronizar.

**Todas as tabelas têm RLS habilitado** (`rls_habilitado = true` confirmado via `pg_class.relrowsecurity`) — não há tabela desprotegida.

### 3.4 Triggers de proteção (regras de integridade que vivem só no banco)

Estas regras **não existem em nenhum lugar do código TypeScript** — só existem como trigger no Postgres, o que significa que valem também para acesso direto via SQL Editor do Supabase, não só via app:

- `atualizar_status_fiado` — recalcula `fiados.status` (`aberto`/`parcial`/`quitado`) toda vez que `fiado_pagamentos` muda, comparando soma pago vs. `valor_total`. **O status do fiado nunca é definido diretamente pelo código — é sempre derivado.**
- `impedir_exclusao_cliente_com_divida` — bloqueia soft-delete de cliente com fiado em aberto.
- `impedir_exclusao_fiado_com_pagamentos` — bloqueia soft-delete de fiado que já tem pagamento registrado.
- `impedir_exclusao_lancamento_vinculado` — bloqueia soft-delete de lançamento que é contrapartida de um pagamento de fiado.
- `impedir_exclusao_os_com_financeiro_ativo` — bloqueia soft-delete de O.S. com lançamento ativo ou fiado em aberto vinculado.
- `definir_destino_lancamento` — deriva `lancamentos.destino` a partir de `forma_pagamento`: `'Dinheiro' → 'caixa'`, qualquer outra coisa → `'banco'` (inclui Pix, Débito, Crédito, Transferência e Cheque compensado).

### 3.5 Functions/RPCs (lógica transacional que vive no banco)

Todas seguem o mesmo padrão: `SECURITY DEFINER`, lock de linha (`for update`), validação de regra de negócio dentro da própria function, e bloco `begin...exception when others...end` para garantir que a operação é tudo-ou-nada.

| Function | O que faz |
|---|---|
| `lancar_ordem_servico_financeiro_atomico` | (legado, ainda em uso pelo fluxo de conversão Orçamento→O.S.) cria fiado(s)/lançamento(s) a partir de uma lista de pagamentos, ligados a uma O.S. |
| `registrar_pagamento_ordem_servico_atomico` | Novo RPC (introduzido nesta última rodada de mudanças): registra o pagamento de uma O.S. já criada, criando fiado/lançamento/cheque conforme a forma escolhida. Só pode ser chamado **uma vez por O.S.** (bloqueia se já existir lançamento/fiado/cheque vinculado). Valida que a soma das partes bate com o total. |
| `confirmar_cheque_atomico` | Confirma um cheque como `compensado` (cria lançamento de entrada) ou `devolvido` (cria fiado novo pro cliente, exige motivo). Só proprietário (`papel_atual()`). Só cheques em status `aguardando`. |
| `registrar_pagamento_fiado_atomico` | Registra pagamento (total/parcial) de um fiado — cria `fiado_pagamentos` + `lancamentos` numa transação. |
| `criar_fatura_consolidada_atomica` | Agrupa vários fiados em aberto de um cliente numa fatura só. |
| `dar_baixa_fatura_atomica` | Marca fatura como paga + baixa os fiados associados + cria lançamento. |
| `calcular_dre_mensal`, `curva_abc_servicos`, `ranking_devedores`, `ranking_clientes_mes` | Relatórios — toda a agregação financeira roda no Postgres, o client só formata o resultado. |
| `resumo_fechamento_dia` | Detalhamento do dia (dinheiro/Pix/cartão/outros, abates de fiado antigo vs. fiado novo) usado tanto na tela de Fechamento de Caixa quanto (potencialmente) no assistente IA. |
| `papel_atual` | Helper usado dentro de policies de RLS. |

**Padrão geral do sistema:** toda operação financeira "composta" (mexe em mais de uuma tabela ao mesmo tempo — ex. pagar um fiado gera baixa + lançamento) foi implementada como RPC atômica no Postgres, não como múltiplas chamadas sequenciais do client. Isso foi uma decisão deliberada de arquitetura tomada ao longo do projeto (havia bugs de estado inconsistente antes dessa mudança, registrados no histórico de tarefas do projeto).

---

## 4. Estrutura de pastas (frontend)

```
app/
  (auth)/login/page.tsx                 → /login
  (dashboard)/layout.tsx                → layout com Sidebar + Navbar + ChatSecretaria, envolto em AuthProvider
  (dashboard)/page.tsx                  → / (dashboard principal)
  (dashboard)/clientes/page.tsx         → /clientes
  (dashboard)/clientes/[id]/page.tsx    → /clientes/:id (extrato/detalhe do cliente)
  (dashboard)/servicos/page.tsx         → /servicos
  (dashboard)/orcamentos/page.tsx       → /orcamentos
  (dashboard)/orcamentos/[id]/page.tsx  → /orcamentos/:id
  (dashboard)/ordens/page.tsx           → /ordens
  (dashboard)/ordens/[id]/page.tsx      → /ordens/:id
  (dashboard)/financeiro/page.tsx       → /financeiro (a página mais complexa do sistema)
  (dashboard)/relatorios/page.tsx       → /relatorios
  (dashboard)/fornecedores/page.tsx     → /fornecedores
  (dashboard)/transportadoras/page.tsx  → /transportadoras
  (dashboard)/contas/page.tsx           → /contas
  (dashboard)/retalhos/page.tsx         → /retalhos
  (dashboard)/simulador/page.tsx        → /simulador
  (dashboard)/configuracoes/page.tsx    → /configuracoes
  api/secretaria/route.ts               → POST /api/secretaria (proxy pro Groq + system prompt)
  layout.tsx                            → layout HTML raiz (fontes, ToastProvider)

components/
  cadastros/CadastroContato.tsx         → componente genérico reutilizado por Fornecedores e Transportadoras
  clientes/                             → ClienteCard, ClienteForm, ClientesList, ExtratoCliente
  financeiro/                           → 15 componentes (lançamentos, fiado, cheques, faturas, fechamento de caixa)
  layout/                               → Sidebar, MobileMenu, Navbar
  orcamentos/                           → OrcamentoCard, OrcamentoForm, OrcamentoPDF
  ordens/                               → OrdemCard, OrdemForm, OrdemStatus
  relatorios/                           → CurvaABC, DRE, RankingDevedores
  secretaria/ChatSecretaria.tsx         → widget flutuante do assistente IA
  ui/                                   → design system interno (Button, Card, Input, Modal, Badge, Table, SearchableSelect, LoadingSpinner, ImprimirPortal, UploadAnexos) — não usa nenhuma lib de componentes externa (nem shadcn, nem Radix)

lib/
  api-helpers.ts        → executarOperacao() — wrapper padrão de chamada Supabase com tratamento de erro
  auth-context.tsx      → AuthProvider / useAuth()
  cheques.ts            → confirmarCheque()
  cobranca.ts           → regras de vencimento/atraso de fiado
  configuracoes.ts      → carregarDadosPix()
  extrato.ts            → carregarExtratoCliente()
  faturas.ts            → criarFaturaConsolidada, darBaixaFatura, cancelarFatura, carregarFatura
  financeiro.ts         → lancarOrdemNoFinanceiro, registrarPagamentoOrdem, sincronizarLancamentoOrdem, calcularSituacoesPagamento, resumoFormaPagamento
  secretaria-tools.ts   → schema das ferramentas do assistente IA + executor client-side
  supabase.ts           → createClient() (client anon, roda no browser, respeita RLS)
  supabase-admin.ts     → createAdminClient() (service role, só usado na API route do servidor) + autenticarPedido()
  toast-context.tsx     → ToastProvider / useToast()
  utils.ts              → formatarMoeda, formatarData, cn, etc.
  whatsapp.ts           → geração de mensagens de WhatsApp (texto) + link wa.me

types.ts                → única fonte de verdade dos tipos TS do domínio (360 linhas)
types/index.ts           → arquivo órfão, esvaziado propositalmente, mantido só porque o filesystem montado não deixa apagar fisicamente — não é importado em lugar nenhum
```

---

## 5. Inventário completo, página por página

### 5.1 `/login`
Formulário único com dois modos (login/criar conta), sem "esqueci senha". Usa `supabase.auth.signInWithPassword`/`signUp` direto (sem passar por `lib/api-helpers`). Se o signup não retornar sessão (confirmação de email pendente), volta pro modo login com aviso — não redireciona sozinho.

### 5.2 `/` (Dashboard)
4 cards de indicador (clientes ativos, orçamentos pendentes, O.S. abertas, resultado do mês) — cada card é um `Link` que já leva filtrado pra outra tela (ex.: `/ordens?status=aberta`). 4 queries Supabase em paralelo com `count: 'exact'`; soma de receita/despesa do mês feita no client a partir de `lancamentos` já filtrados por data. Não usa nenhuma RPC de relatório aqui (isso só acontece em `/relatorios`).

### 5.3 `/clientes`
Listagem simples com busca (nome ou telefone), modal de criar/editar (`ClienteForm`), soft delete com `confirm()` nativo (bloqueado pelo trigger se o cliente tiver fiado em aberto). Usa `executarOperacao` consistentemente.

### 5.4 `/clientes/[id]`
Extrato completo do cliente: fiados em aberto com FIFO de pagamentos, itens reais de O.S. vinculada (não descrição genérica), seção "Fiados pagos" com filtro de período (`pagosDe`/`pagosAte`, default hoje, com opção "ver histórico completo"), impressão de PDF via `ImprimirPortal` (React Portal pra `document.body`, ver §8.4), geração de mensagem de WhatsApp equivalente ao extrato impresso. Usa `lib/extrato.ts` (`carregarExtratoCliente`) como fonte única de dados, compartilhada entre a tela e a mensagem de WhatsApp — importante: **qualquer mudança na regra de "o que conta como fiado pago" precisa ser feita nesse arquivo, não duplicada em dois lugares**.

### 5.5 `/servicos`
CRUD de catálogo de serviços por categoria (tornear/fresar/solda/bancada/outro), com `preco_base` opcional. Delete físico direto (sem soft delete, diferente da maioria dos outros cadastros). Filtro por categoria via chips, sem busca textual.

### 5.6 `/orcamentos`
Listagem em grid de cards. CRUD completo + PDF + WhatsApp + a funcionalidade mais complexa da tela: **converter orçamento aprovado em O.S.**, com formulário de forma de pagamento na hora da conversão (`FormaPagamentoSplit`), lançamento automático no financeiro via `lancarOrdemNoFinanceiro`, e um fluxo explícito de "não marca como aprovado se o lançamento financeiro falhar" (evita estado inconsistente). **Este é um fluxo de pagamento diferente do fluxo novo de O.S. direta** — ver §7.2, ponto de atenção importante.

### 5.7 `/orcamentos/[id]`
Tela read-only de impressão/compartilhamento direto de um orçamento por link. Sem lógica de negócio.

### 5.8 `/ordens`
Listagem em grid de O.S. com filtros (status, cliente, serviço/categoria, período) + filtro especial "Fiado pendente". Desde a última rodada de mudanças (ver §7.2): criar uma O.S. **não** pede forma de pagamento — ela nasce "aguardando pagamento". Um badge de "situação de pagamento" (`aguardando` / `pago` / `fiado_pendente` / `cheque_aguardando`) é calculado no client a partir de queries a `lancamentos`/`fiados`/`cheques` vinculados (função `calcularSituacoesPagamento` em `lib/financeiro.ts`) — **não é uma coluna no banco**, é derivado toda vez que a lista carrega. Botão "Registar pagamento" abre `PagamentoOrdemForm`, que chama `registrar_pagamento_ordem_servico_atomico`.

### 5.9 `/ordens/[id]`
Detalhe de uma O.S. — mesma lógica de badge de situação de pagamento e botão "Registar pagamento" que a listagem, mais mensagem pronta de "serviço pronto" pra WhatsApp.

### 5.10 `/financeiro`
**A página mais complexa do sistema**, com 5 abas: Lançamentos, Fiados, Faturas, Fechamento de caixa, Cheques (esta última só visível se `ehProprietario`). Detalhes de cada aba:
- **Lançamentos**: CRUD de lançamentos manuais (entrada/saída), com `ResumoFinanceiro` (cards de entradas/saídas/saldo do dia + card "Saldo banco" acumulado, só proprietário).
- **Fiados**: listagem com régua de cobrança (`ReguaCobranca`, ver §7.4), registro de pagamento (`PagamentoFiadoForm`), relatório em PDF.
- **Faturas**: geração de fatura consolidada (agrupa vários fiados de um cliente), baixa, cancelamento, PDF, WhatsApp.
- **Fechamento de caixa**: `FluxoCaixa` — "Esperado" calculado só com `destino='caixa'` (corrigido recentemente, ver §7.1), comparação com valor contado fisicamente, detalhamento por forma de pagamento.
- **Cheques**: `ChequesList` + `DevolverChequeForm` — compensar/devolver cheques recebidos.

Esta página não usa `executarOperacao` de forma 100% consistente em todas as ações (algumas chamadas a RPC são feitas via `executarOperacao`, outras via `lib/financeiro.ts`/`lib/faturas.ts`/`lib/cheques.ts` que já encapsulam isso).

### 5.11 `/relatorios`
3 relatórios: DRE mensal simplificado, Curva ABC de rentabilidade por categoria de serviço, ranking de devedores (top 10 fiado em aberto). Toda a agregação roda em RPC no Postgres (`calcular_dre_mensal`, `curva_abc_servicos`, `ranking_devedores`) — o client só converte `numeric` (que vem como string via RPC) pra `number` e renderiza. Seletor de mês único (`<input type="month">`) recarrega os 3 relatórios juntos.

### 5.12 `/fornecedores` e `/transportadoras`
Ambas são a mesma implementação (`components/cadastros/CadastroContato.tsx`) parametrizada por nome de tabela. CRUD simples, delete físico, sem soft delete. **`transportadoras` não parece ser referenciada por nenhuma outra tabela do domínio** — não há campo de transportadora em orçamento/O.S./fatura. Parece cadastro criado preventivamente, sem uso funcional ainda.

### 5.13 `/contas`
Contas a pagar, duas abas: fixas (recorrentes, por dia do mês) e variáveis (pontuais, vinculadas a fornecedor e data de vencimento real). Delete físico, sem `executarOperacao` (chamadas diretas ao Supabase sem tratamento de erro padronizado — diferente do padrão mais maduro visto em Retalhos/Clientes).

### 5.14 `/retalhos`
Controle de sobras de matéria-prima reaproveitável (tarugo/chapa/tubo/barra sextavada). Soft delete, usa `executarOperacao` + toast consistentemente. Ação rápida "Marcar utilizado" além do form completo.

### 5.15 `/simulador`
Calculadora standalone das taxas da maquininha Ton (débito/crédito por bandeira e parcela, Pix). **100% client-side, sem nenhuma chamada ao Supabase** — as taxas estão hardcoded no próprio arquivo `.tsx`, apesar de existirem tabelas no banco (`taxas_ton`, `simulacoes`, `historico_simulacoes`) que sugerem uma versão anterior persistia isso no banco. Há um comentário no código avisando que as taxas precisam ser atualizadas manualmente sempre que a Ton mudar o plano.

### 5.16 `/configuracoes`
Duas seções: dados da própria conta (nome/telefone, qualquer usuário) e administração (só proprietário: gestão de usuários/papéis, dados PIX/bancários pra exibir nas faturas, chaves de API — Groq pro assistente IA). Proprietário não pode alterar o próprio papel nem se autodesativar (guardas de UI).

---

## 6. O assistente "Secretária IA"

- Widget de chat flutuante (`ChatSecretaria.tsx`), presente em todas as páginas do dashboard (montado no layout).
- Backend: `app/api/secretaria/route.ts` — recebe o histórico de mensagens, monta um system prompt com o nome/papel do usuário logado e a data atual, chama a Groq API (`llama-3.3-70b-versatile` por padrão, configurável via `configuracoes`) com `tool_choice: 'auto'` e um array de ferramentas (function calling).
- As ferramentas (`lib/secretaria-tools.ts`) são executadas **no client**, não no servidor — o `executarFerramenta()` roda no browser do usuário logado e usa o `supabase` client normal (respeitando RLS do usuário real). O servidor só faz o proxy pra Groq; nunca toca no banco diretamente pra executar ações.
- Ferramentas disponíveis: `buscar_clientes`, `criar_cliente`, `listar_servicos`, `criar_orcamento`, `criar_ordem_servico` (sem forma de pagamento — mudou recentemente), `registrar_pagamento_os` (nova), `registrar_lancamento`, `registrar_fiado`, `buscar_fiados_cliente`, `receber_pagamento_fiado`, `buscar_ordens_servico`, `marcar_ordem_pronta`, `fechar_caixa`.
- Loop agente: até 6 iterações (`for (let volta = 0; volta < 6; volta++)`) — chama a IA, executa tool calls, devolve resultado, repete até a IA responder só texto (sem tool call) ou estourar o limite.
- **Não há streaming** — a resposta chega inteira de uma vez (`await resposta.json()`), sem SSE/chunked response.
- **Pagamento em cheque não é suportado pelo assistente** — a ferramenta `registrar_pagamento_os` explicitamente recusa e orienta o usuário a usar a tela, porque os dados do cheque (número, banco, conta, titular) são difíceis de capturar de forma confiável por texto livre.
- Dependência externa única: chave da Groq guardada em `configuracoes` (chave `groq_api_key`) — se não configurada, a API retorna erro pedindo pro proprietário configurar.

---

## 7. Fluxos de negócio críticos (o "porquê" por trás do código)

### 7.1 Caixa físico vs. Banco
Decisão recente: distinguir dinheiro físico na gaveta (`destino='caixa'`) de tudo que é Pix/cartão/transferência/cheque compensado (`destino='banco'`). Essa distinção é **derivada automaticamente por trigger** a partir de `forma_pagamento`, nunca escolhida manualmente. O "Esperado" do Fechamento de Caixa e o card "Saldo banco" (visível só ao proprietário) usam essa coluna pra nunca misturar os dois. Antes dessa mudança, o "Esperado" somava todas as formas de pagamento juntas, o que nunca batia com o dinheiro contado fisicamente — bug corrigido, mas **vale conferir se algum relatório antigo (`fechamento_caixa` histórico anterior à migração) ainda reflete o cálculo antigo**, já que a correção não foi retroativa.

### 7.2 Dois fluxos de pagamento de O.S. coexistindo
Existem **dois caminhos diferentes** para uma O.S. nascer no sistema, com comportamento financeiro diferente:
1. **Orçamento → conversão em O.S.** (`/orcamentos`, função `converterOrcamento` dentro da página): pede forma de pagamento **na hora da conversão** e lança automaticamente no financeiro via `lancarOrdemNoFinanceiro` (RPC `lancar_ordem_servico_financeiro_atomico`).
2. **O.S. direta** (`/ordens`, `OrdemForm`): **não** pede forma de pagamento na criação — nasce "aguardando pagamento", e o pagamento só é registrado depois via `registrarPagamentoOrdem` (RPC `registrar_pagamento_ordem_servico_atomico`), numa ação separada e explícita.

Isso é intencional (reflete dois processos reais da oficina — orçamento formal aprovado com pagamento combinado vs. serviço já autorizado verbalmente e pago só na retirada), mas é uma peça importante que qualquer IA/engenheiro revisando o sistema precisa entender antes de propor "unificar" os dois fluxos sem checar com o dono do negócio se isso quebra o processo real.

### 7.3 Cheques
Módulo novo (`cheques`), com RLS restrita a `proprietario` em todas as operações (funcionário não vê nem cria — a única forma de "criar" um cheque é através da forma de pagamento "Cheque" no formulário de pagamento de O.S., que só aparece pro proprietário via prop `mostrarCheque`). Um cheque nasce em `aguardando` (não conta como caixa nem banco — é só uma promessa de recebimento futuro). Ao confirmar:
- `compensado` → gera um `lancamento` de entrada (`destino='banco'`, forma `'Cheque'`).
- `devolvido` → gera um `fiado` novo pro cliente que passou o cheque (exige motivo da devolução).

**Ponto de atenção:** a RPC `registrar_pagamento_ordem_servico_atomico` insere na tabela `cheques` sem checar `papel_atual()` — a restrição de "só proprietário cria cheque" hoje é só de UI (o `select` da forma de pagamento só mostra "Cheque" se `ehProprietario`), não de RLS/RPC. Um funcionário que manipulasse a chamada diretamente (via DevTools, por exemplo) poderia inserir um cheque. Não é um risco alto num sistema interno de poucos usuários confiáveis, mas é uma lacuna real que vale endurecer se a superfície de ataque crescer.

### 7.4 Régua de cobrança de fiado
`lib/cobranca.ts` define o que conta como "vencido": `vencimentoEfetivo()` (usa `data_vencimento` se existir, senão a `data` do fiado), `estaVencido()`, `diasEmAtraso()`. Usado tanto na tela de Fiados (badge de alerta) quanto no `OrdemForm` (alerta visual se o cliente selecionado tem fiado vencido, antes de autorizar mais serviço a ele).

### 7.5 Impressão de PDF (extrato, orçamento, O.S., fatura, relatório de fiado)
Todos os componentes de impressão (`ExtratoCliente`, `OrcamentoPDF`, `FaturaPDF`, `FiadoRelatorioPDF`) são envolvidos por `ImprimirPortal` (`components/ui/ImprimirPortal.tsx`) — um React Portal que renderiza o conteúdo duas vezes (uma no fluxo normal da página, outra num nó anexado direto a `document.body`), combinado com CSS que esconde (`display:none`, não `visibility:hidden`) todos os irmãos do body na hora de imprimir. Isso não é geração de PDF real (não há lib tipo `pdfkit`/Puppeteer) — é **impressão do navegador** (`window.print()`) capturada como PDF pelo próprio diálogo de impressão do usuário. Foi a solução final depois de 3 iterações com bugs de posicionamento CSS quando o conteúdo estava dentro de um Modal.

---

## 8. Padrões técnicos observados

- **`executarOperacao<T>()`** (`lib/api-helpers.ts`): wrapper padrão que envolve toda chamada Supabase (`select`/`insert`/`update`/`rpc`), retorna um union discriminado `{ok:true,data,erro:null} | {ok:false,data:null,erro:string}`, e traduz códigos de erro Postgres comuns (`23505`, `23503`, `23502`, `42501`, `28000`) pra mensagens em português. **Não é usado de forma 100% consistente** — páginas mais antigas ou mais simples (`/contas`, `/fornecedores`, `/transportadoras`) chamam o Supabase direto sem esse wrapper, o que significa que erros lá não geram toast nem mensagem amigável.
- **Soft delete** é o padrão em quase tudo (`deleted_at`), mas não universal — `servicos`, `fornecedores`, `transportadoras`, `contas_fixas`, `contas_variaveis` fazem `delete()` físico.
- **RPC atômica pra tudo que mexe em mais de uma tabela financeira** (ver §3.5) — padrão consolidado, não deve ser abandonado numa refatoração sem motivo forte.
- **Cálculo de "situação derivada" no client, não persistido**: tanto a situação de pagamento de O.S. (§5.8) quanto o status de fiado (recalculado por trigger, não pelo client) seguem a filosofia "não confie em um campo de status guardado se você pode derivar a verdade a partir dos dados-fonte" — bom pra consistência, mas gera N+1 queries no client (múltiplas chamadas `.from()` só pra montar um mapa de situação por ordem, ao carregar a lista de O.S.).
- **Sem paginação em nenhuma listagem** — todas as telas carregam a tabela inteira (`select('*')` sem `.range()`/`.limit()` além de casos pontuais como ranking top 10). Funciona bem no volume atual (oficina pequena), mas não escala indefinidamente.
- **Sem cache/revalidação** (não usa React Query, SWR, nem `unstable_cache`/`revalidatePath` do Next) — toda tela recarrega os dados do zero a cada `useEffect`, sem cache entre navegações.
- **Todas as páginas são Client Components** (`'use client'` no topo) — não há Server Components buscando dados no servidor; tudo roda no browser via `createClient()` anônimo.
- **Sem validação de schema runtime** (não usa Zod/Yup) — validação é manual, campo a campo, dentro de cada formulário.

---

## 9. Pontos de atenção / possíveis débitos técnicos (pra outro engenheiro avaliar)

1. **Dois fluxos de pagamento de O.S. diferentes** (via orçamento vs. direto) — não é bug, mas exige entendimento antes de qualquer refatoração unificadora (§7.2).
2. **RLS mista `public`/`authenticated`** em algumas tabelas (§3.3) — vale padronizar.
3. **RPC de cheque não valida `papel_atual()`** na criação (só na confirmação) — restrição hoje é só de UI (§7.3).
4. **`fiados.status` é `text` livre**, não enum — permite inconsistência de valor sem constraint no banco.
5. **`executarOperacao` não é usado em todo lugar** — `/contas`, `/fornecedores`, `/transportadoras` não têm tratamento de erro padronizado nem toast.
6. **Soft delete não é universal** — mistura de padrões entre módulos.
7. **`transportadoras`** parece cadastro sem uso funcional real ainda (nenhuma FK aponta pra ela).
8. **`simulacoes`/`historico_simulacoes`/`taxas_ton`** são tabelas mortas — o simulador atual não as usa.
9. **`types/index.ts`** é um arquivo órfão inofensivo (já documentado no próprio arquivo, não afeta build) — mencionado aqui só pra não gerar confusão numa auditoria automatizada de arquivos.
10. **Sem testes automatizados nem CI** — toda validação é `tsc --noEmit` manual + teste visual antes de cada deploy manual via CLI da Vercel.
11. **Sidebar mostra "Configurações" pra todos**, mas o conteúdo é majoritariamente proprietário-only — inconsistência de UX, não de segurança.
12. **Nenhuma paginação** nas listagens — ok no volume atual, atenção se a base crescer muito.
13. **Deploy 100% manual** (`vercel --prod` rodado à mão) — sem pipeline, sem ambiente de staging separado, sem rollback automatizado além do painel da Vercel.
14. **Sem rate limiting nem validação de tamanho de payload** na API route da Secretária IA — qualquer usuário autenticado pode chamar `/api/secretaria` livremente (a chave da Groq fica no servidor, então não vaza, mas custo de uso não tem trava).
15. **`configuracoes` é 100% bloqueada por RLS pra funcionário** (confirmado — nem `select` passa). Isso inclui os dados de PIX/bancários usados em `FaturaPDF`. Se um funcionário gerar/imprimir uma fatura, `carregarDadosPix()` (que usa o client anônimo, sujeito a RLS) provavelmente retorna vazio pra ele — a fatura sairia sem os dados de pagamento. Vale confirmar esse comportamento na prática e decidir se faz sentido (ex.: expor só os campos de PIX via uma view/RPC `SECURITY DEFINER` liberada a todo `authenticated`, sem abrir a tabela inteira de configs).

---

## 10. O que NÃO existe hoje (possíveis oportunidades, não recomendações)

- Multi-tenant / suporte a mais de uma empresa no mesmo sistema.
- Notificações push/automáticas (tudo é "gerar mensagem e abrir WhatsApp manualmente" — não há integração com WhatsApp Business API).
- Anexos de nota fiscal/comprovante fiscal (o módulo de anexos existe só pra fotos/desenhos técnicos em Orçamento/O.S.).
- Controle de estoque de matéria-prima nova (só existe controle de sobras/retalhos, não de compra/estoque de material virgem).
- Relatório de margem por O.S. individual (a Curva ABC é por categoria de serviço agregada no mês, não por O.S.).
- App mobile nativo (é uma web app responsiva, sem PWA configurado — não há `manifest.json`/service worker).
- Histórico de auditoria (quem mudou o quê e quando) além dos campos `created_by`/`created_at` — não há tabela de log de alterações.

---

*Fim do documento. Gerado por leitura direta do código-fonte (repositório local) e do schema real do banco Supabase em produção — não é uma descrição de intenção, é o estado factual do sistema em 27/08/2026.*
