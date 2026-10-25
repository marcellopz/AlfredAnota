# CLAUDE.md — Alfred

Regras permanentes para qualquer agente de código trabalhando neste repositório. O planejamento detalhado (fases, schema, fluxos) está em [`docs/planejamento.md`](docs/planejamento.md). Em caso de conflito, este arquivo vale para **padrões**; o planejamento vale para **o que construir**.

## O projeto

Alfred é um assistente pessoal multiusuário com interface principal num bot do Telegram. O usuário escreve em linguagem natural ("gastei 40 reais com almoço", "me lembra amanhã às 9h de pagar a fatura") e o Alfred registra gastos e cria lembretes. Um site Next.js cuida de cadastro, conexão da conta do Telegram e, no futuro, do dashboard.

Princípios:

- **IA só onde é insubstituível.** O LLM (Ollama local) só interpreta texto. Somas, consultas, datas, agendamento e envio são código determinístico.
- **Lembretes confiáveis.** Um lembrete é uma linha no banco processada por job agendado (Edge Function + `pg_cron`), nunca uma decisão do LLM ou do processo do bot.
- **Multiusuário desde o início.** Nenhuma consulta pode vazar dados entre usuários.
- **Menor privilégio.** RLS e `grant` liberam só o que é usado hoje.

## Como trabalhar

- **Um incremento mínimo por vez.** Cada fase do planejamento é dividida em incrementos (0.1, 0.2...). Um incremento deve compilar, rodar e ser testável sozinho. Não adiante código de incrementos futuros, nem crie pastas, dependências ou abstrações "para depois".
- **Ao final de cada incremento:** pare e informe o que foi feito, os comandos exatos para testar e o que ficou pendente. Aguarde aprovação antes de seguir.
- **Antes de começar uma fase,** proponha a divisão dela em incrementos e espere a aprovação.
- **Se o repositório não bater com o que o planejamento descreve,** relate antes de alterar.
- **Ações destrutivas exigem confirmação explícita:** apagar dados, `supabase db reset` fora do banco local, `db push` para o remoto, force push, reescrever histórico.
- **Commit** ao final de cada incremento aprovado, com mensagem curta em português no imperativo (ex: `adiciona bot eco com long polling`).
- **Ao mudar um padrão deste arquivo,** atualize-o no mesmo commit.

## Ambiente

- Windows + PowerShell. Comandos sugeridos devem funcionar no PowerShell: um por linha, sem `&&`.
- Node 22, pnpm 8 (workspaces: `apps/*`, `packages/*`), Docker Desktop para o Supabase local.
- Em desenvolvimento, use sempre o Supabase **local** e o bot de **dev** do Telegram.
- Só pode haver uma instância do bot por token (duas em long polling dão erro 409).

## Estrutura

```
apps/bot/      bot grammY (long polling), executado com tsx
  src/config.ts      env vars validadas com Zod
  src/db/            único ponto de acesso ao banco
  src/handlers/      handlers do grammY
  src/llm/           LLMProvider + OllamaProvider
  src/intents/       schemas Zod e lógica de cada intent
apps/web/      Next.js (App Router) + @supabase/ssr
packages/db/       tipos gerados do Supabase (não editar à mão)
packages/shared/   código puro compartilhado (sem APIs de Node), usado pelo bot, pelo site e pela Edge Function
supabase/migrations/   migrations SQL
supabase/functions/    Edge Functions (Deno)
supabase/tests/        testes pgTAP
docs/planejamento.md   planejamento das fases
```

Os pacotes e pastas só são criados no incremento que precisa deles.

## Segurança

- **Um único `.env` na raiz** (ignorado pelo git) para todo o desenvolvimento. O `.env.example` da raiz traz os nomes, valores locais não secretos e um comentário explicando cada variável. Não crie `.env` dentro de `apps/*` nem de `supabase/`.
  - Bot: carrega o arquivo com `tsx --env-file=../../.env`.
  - Função de lembretes: `pnpm supabase functions serve --env-file .env`.
  - Site: o `next.config` lê o `.env` da raiz e repassa **somente** as variáveis `NEXT_PUBLIC_*`. Nunca carregue o arquivo inteiro no site.
- **Variável nova:** adicione-a ao `.env.example`, com comentário, e à validação Zod do app (`src/config.ts` no bot) no mesmo incremento. Variável para o site precisa do prefixo `NEXT_PUBLIC_` e só pode conter valor público.
- **`service_role`** só no bot e nos secrets das Edge Functions. Nunca lida pelo site, nunca em código cliente, nunca com prefixo `NEXT_PUBLIC_`.
- **Bot:**
  - todo acesso ao banco passa por `src/db/`; nenhum handler importa o cliente Supabase;
  - toda função de `src/db/` que toca dado de usuário recebe `userId` obrigatório e filtra por ele, mesmo com `service_role`;
  - processa só `chat.type === 'private'`; chats sem canal ativo vinculado recebem apenas a instrução de conexão pelo site;
  - todo `callback_query` recarrega o registro filtrando por `userId` antes de agir.
- **Banco:**
  - RLS habilitada em todas as tabelas de `public`; sem policy significa negado;
  - policies só para o que o site usa agora;
  - colunas sensíveis (ex: `profiles.daily_msg_limit`, `channels.external_id`) nunca são graváveis por `authenticated`;
  - funções `security definer` têm `set search_path = ''`, nomes qualificados com schema, e `revoke execute ... from public, anon, authenticated` seguido de `grant` só para quem precisa;
  - segredos usados pelo banco (ex: segredo do cron) ficam no Supabase Vault, nunca em migration.
- **LGPD:** não guardar o texto de mensagens de chats não vinculados.

## Dados

- Dinheiro sempre em **centavos inteiros** (`amount_cents bigint` / `number` inteiro no TS). Nunca float para valores persistidos.
- Datas em `timestamptz`, armazenadas em UTC. "Hoje", "mês", "agora" e recorrências são calculados no fuso do usuário (`profiles.timezone`, padrão `America/Sao_Paulo`) com Luxon.
- O LLM devolve data e hora **local sem offset** (`YYYY-MM-DDTHH:mm`); a conversão para UTC é feita no código.
- **Migrations:**
  - uma migration nova para cada mudança (`pnpm supabase migration new <nome>`);
  - nunca editar uma migration já aplicada/commitada;
  - depois de cada migration, rodar `pnpm db:types` e commitar os tipos junto.
- Gravações que podem ser reprocessadas (updates do Telegram) são idempotentes por índice único.

## Código

- TypeScript `strict` em todos os pacotes, estendendo `tsconfig.base.json`. Sem `any`; se for inevitável, comente o motivo.
- Entrada externa (env vars, saída do LLM, payload do Telegram, formulários) é validada com Zod antes do uso.
- **Saída do LLM:**
  - validada com Zod, com uma nova tentativa;
  - se falhar de novo, o usuário recebe "não entendi" e o erro vai para `message_log`;
  - toda chamada ao Ollama tem timeout.
- Valores, categorias e aliases são decididos por código determinístico; o LLM só sugere.
- Erros nunca derrubam o bot: `bot.catch` com log, e encerramento gracioso em `SIGINT`/`SIGTERM`.
- Textos para o usuário em português do Brasil, formatados com `Intl` (`pt-BR`, `BRL`, fuso do usuário).
- Nomes de código (variáveis, funções, arquivos) em inglês. Comentários só para restrições que o código não mostra.
- Siga o estilo do código ao redor; prefira funções pequenas e puras para tudo que for testável (parser de valores, normalização, datas, recorrência).

## Testes e verificação

- Vitest para unidades; pgTAP (`pnpm supabase test db`) para RLS e funções SQL.
- Toda regra de isolamento entre usuários ganha um teste com dois usuários.
- Lógica pura nova (parser, normalização, datas, recorrência) entra com teste no mesmo incremento.
- Antes de declarar um incremento pronto: `pnpm typecheck` e os testes existentes passam.

## Comandos

Os comandos são adicionados à medida que os incrementos os criam. Mantenha esta lista atualizada.

- `pnpm install`: instala as dependências do workspace
- `pnpm typecheck`: checagem de tipos em todos os pacotes
- `pnpm db:start` / `pnpm db:stop`: sobe/para o Supabase local (Docker Desktop aberto)
- `pnpm db:reset`: recria o banco **local** aplicando as migrations
- `pnpm db:types`: regenera `packages/db/src/database.types.ts` a partir do banco local
- `pnpm dev:web`: sobe o site Next.js em `http://localhost:3000`
- `pnpm dev:bot`: sobe o bot em long polling com recarga automática (lê o `.env` da raiz)

## Fora do escopo por enquanto

Dashboard, agenda e resumo matinal, consultas em linguagem natural, voz, WhatsApp, convites, painel admin e cobrança, exportação e exclusão de conta. Não implemente nada disso sem pedido explícito.
