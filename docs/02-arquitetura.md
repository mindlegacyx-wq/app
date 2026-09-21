# 02 · Arquitetura

## Resumo das decisões

| Camada | Escolha | Alternativa descartada e motivo |
|---|---|---|
| Estilo | Monólito modular | Microsserviços: custo operacional alto sem ganho para 1 a 10 mil usuários |
| Backend | Python 3.11+ · FastAPI · SQLAlchemy 2 (async) · Alembic | Django: traz admin e ORM síncrono que não usaremos nesse formato API-first |
| Banco | PostgreSQL 16 | SQLite em produção: não escala para milhares de usuários simultâneos |
| Auth | E-mail + senha (Argon2) · JWT curto + refresh token rotativo | Sessão em servidor: dificulta escalar horizontalmente |
| Frontend | PWA · React 18 · TypeScript · Vite · Tailwind | HTMX/Jinja: alarme, timers e checklists exigem interatividade de app |
| Jobs | APScheduler no processo (MVP) → worker + Redis (escala) | Celery desde o início: complexidade prematura |
| Infra | Docker Compose · Caddy (HTTPS automático) | Kubernetes: prematuro |

---

## 1. Estilo arquitetural: monólito modular

Um único deploy do backend, dividido em **módulos com fronteira clara**:

```
auth · users · routines · alarms · goals · workouts · tasks · progress · player · league · achievements · trash · schedule · studies · grades
```

`trash` (Fase 8) é um orquestrador sem regra própria: cada módulo dono declara o que pode ir para a lixeira (`TrashKind` em `app/core/softdelete.py`) e a lixeira só lista, restaura e apaga em definitivo com essas descrições.

`schedule` (Fase 9) é a **agenda semanal**: matérias e blocos fixos por dia da semana (aula, treino, estudo, outro) com início e fim. É referência de horário, **não entra no percentual** — aula não é algo que se "marca como feito". Ele oferece a outros módulos: as janelas livres do dia (para a Fase 10 encaixar sessões de estudo) e o horário do treino (tela Hoje). Um bloco de treino ligado a um plano **acrescenta o dia ao plano** via `workouts.service.ensure_days` — o plano continua sendo a única fonte de "em que dias eu treino"; a agenda só diz a hora.

`studies` (Fase 10) são as **provas e trabalhos** com sessões de estudo automáticas. A prova tem data, `lead_days` ("começar a cobrar X dias antes") e `minutes_per_day`; em cada dia da janela `[data − lead_days, véspera]` ela pede **uma sessão**, que entra no percentual como qualquer item planejado (componente `study` em `progress`). A sessão planejada nasce da definição, como um item de rotina: a linha em `study_sessions` só existe quando o usuário começa, conclui ou pula. A janela só começa no dia do cadastro (prova criada 2 dias antes com `lead_days = 7` cobra 2 sessões). O horário é uma **sugestão** calculada a cada leitura: a sessão é encaixada no maior buraco da agenda do dia (`schedule.free_windows`), preferindo o que ainda está pela frente quando o dia é hoje. Pular conta como planejada e não feita (regra do treino). Prova `done` para de cobrar.

`grades` (Fase 11) são as **notas** por matéria e período. A régua é do usuário (`user_settings`): média mínima (padrão 6), períodos por ano (2/3/4; padrão 3 = trimestres) e escala (10 ou 100). Várias notas no mesmo período viram média ponderada pelos pesos; a média do ano é a **média simples** dos períodos. O módulo calcula "quanto preciso tirar": a média necessária em cada período restante para fechar o ano na mínima, com o status (`no_grades` · `on_track` · `at_risk` · `failing` = só com recuperação · `approved` · `closed_failed`). Uma nota pode apontar para uma prova (`exam_id`), que é como a tela da prova lança e mostra a nota. `Decimal` no banco, número no JSON (`app/core/schemas.Num`).

**Estudos com IA** (Fase 12) vivem dentro de `studies` (`ai_service.py`) sobre um cliente único em `app/core/ai.py`, compatível com a API de chat da OpenAI — Groq, Gemini, Mistral, OpenAI ou Ollama, trocando só `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` e `AI_VISION_MODEL` no `.env`. Sem chave, a API responde `configured: false` e a tela mostra "IA não configurada" (materiais em texto continuam funcionando). Decisões: **as fotos nunca são guardadas** — vão inline para o modelo de visão (redimensionadas a 1600 px, JPEG) e voltam como texto que o usuário confere e salva como *material*; a **geração roda em segundo plano** (`BackgroundTasks` com sessão própria, um tipo por vez) e a tela consulta o estado a cada 3 s; cada prova tem no máximo um artefato por tipo (teoria e resoluções em Markdown; mapa mental e quiz em JSON validado), regenerar substitui; `input_hash` marca o artefato como desatualizado quando os materiais mudam. Os prompts pedem português do Brasil, sem LaTeX (fórmulas em texto simples, legíveis no celular) e teoria **focada no que os exercícios exigem**. Para escalar, a mesma função `run_generation` vai para um worker (fila) sem mudar a API.

Regras:

- Cada módulo tem seus próprios `models.py`, `schemas.py`, `service.py`, `router.py`.
- Um módulo **nunca** consulta a tabela de outro diretamente; chama o `service` do outro. Exemplo: `progress` pede a `routines` "quantos itens estavam planejados para o usuário X no dia Y", não faz `SELECT` em `routine_items`.
- Isso permite extrair qualquer módulo para um serviço separado no futuro sem reescrever o resto.

## 2. Backend: FastAPI

Por quê:

- **Async nativo**: muitas conexões simultâneas com pouco recurso (push, sincronização do PWA).
- **Pydantic v2**: contratos tipados e validação na borda; o OpenAPI gerado automaticamente serve o PWA hoje e um app nativo amanhã, sem retrabalho.
- **Leve e explícito**: sem mágica escondida; fácil de testar (pytest + httpx).

Stack do backend:

| Peça | Biblioteca |
|---|---|
| Framework | FastAPI + Uvicorn |
| ORM / migrações | SQLAlchemy 2.0 async (asyncpg) + Alembic |
| Validação / config | Pydantic v2 + pydantic-settings |
| Senhas / tokens | argon2-cffi + PyJWT |
| Push | pywebpush (VAPID) |
| Agendamento | APScheduler |
| Qualidade | ruff, mypy, pytest, pytest-asyncio |

## 3. Banco de dados: PostgreSQL

- **Postgres em todos os ambientes** (dev via Docker Compose). Mesmo motor evita surpresas de tipos e fusos. SQLite só em testes unitários rápidos.
- **UUID v7 como chave primária**: não expõe contagem de registros, ordena por tempo, facilita sharding futuro.
- **`user_id` em toda tabela de domínio** + índice composto `(user_id, date)` nas tabelas de registro diário.
- **Soft delete** (`deleted_at`) nas entidades que o usuário cria (rotinas, metas, treinos, tarefas). Exclusão definitiva por job após 30 dias.
- **Fuso horário**: todo `timestamp` em UTC; `users.timezone` (IANA, ex.: `America/Sao_Paulo`); o campo `date` das tabelas de registro é o dia **no fuso do usuário**, calculado no backend. É isso que mantém sequências e alarmes corretos quando o usuário viaja.

Detalhes em [03-banco-de-dados.md](03-banco-de-dados.md).

## 4. Autenticação e isolamento multiusuário

- Cadastro com e-mail + senha (Argon2id). Estrutura pronta para OAuth (Google/Apple) depois.
- **Access token JWT de 15 min** (memória do app) + **refresh token rotativo de 30 dias** em cookie `httpOnly`/`Secure`/`SameSite=Strict`. Refresh tokens ficam na tabela `sessions`, então dá para listar e revogar dispositivos.
- Uma dependency `current_user` é injetada em **toda** rota privada; os services recebem `user_id` como primeiro argumento e todo `SELECT`/`UPDATE` filtra por ele. Nenhuma rota devolve dados sem esse filtro. Teste automatizado garante que usuário A não lê dados de B.
- Rate limit básico por IP nas rotas de login e cadastro desde o MVP.

## 5. Frontend: PWA em React + TypeScript

| Peça | Biblioteca | Função |
|---|---|---|
| Base | Vite + React 18 + TypeScript | Build rápido, tipagem de ponta a ponta (tipos gerados do OpenAPI) |
| Estilo | Tailwind CSS + tokens próprios | Tema premium consistente, escuro por padrão |
| Dados | TanStack Query | Cache, revalidação, otimismo ao marcar itens |
| Estado local | Zustand | Estado de UI leve (alarme tocando, modais) |
| Animação | Framer Motion | Micro-interações (check, anel de progresso, transição de telas) |
| PWA | vite-plugin-pwa (Workbox, `injectManifest`) | Instalável, cache de assets, service worker próprio com o handler de push |
| Roteamento | React Router | Rotas por módulo |

Por que React e não Flutter agora: Flutter exige toolchain nativa e publicação em loja, e o alarme nativo não pode ser testado neste ambiente. React entrega o MVP em semanas e, se o app nativo vier, **React Native/Expo reaproveita a API, os tipos e boa parte da lógica**.

## 6. Como o despertador funciona num PWA (limites honestos)

1. Usuário cria o alarme → salvo no servidor (`alarms`). O setup já cria o "Acordar".
2. O scheduler do backend roda **a cada minuto** e busca alarmes devidos **no fuso de cada usuário**; cria o `wake_log` pendente (um por dia) e reenvia sonecas vencidas. Advisory lock do Postgres: só uma réplica dispara.
3. Envia **Web Push** (VAPID, `pywebpush`) → o service worker (`src/sw.ts`) mostra uma notificação persistente; o toque abre a tela de alarme. A confirmação nunca acontece pela notificação: o atrito de segurar 3 s é proposital.
4. Se o app estiver **aberto** (celular na cabeceira), um relógio local pede o disparo ao servidor na hora (`POST /wake/ring`, mesma regra do job) e a tela de alarme entra em tela cheia: som sintetizado em loop (Web Audio, 3 sons, volume crescente), tela acesa (Wake Lock API), vibração.
5. Confirmação: **segurar o botão por 3 segundos**. Isso grava `wake_logs.confirmed_at`, que é o "horário que levantou". Sem confirmação em 60 min → `missed` (confirmável depois como `manual`).
6. Soneca permitida N vezes (configurável); cada soneca é registrada e o servidor guarda `next_ring_at` para reenviar o push.

Limite real: com o app fechado, é uma **notificação**, não um alarme que vence o modo silencioso. No iOS, push só funciona com o app instalado na tela inicial. Por isso o onboarding recomenda manter o alarme nativo do celular como backup e usar o app para confirmar que levantou. Quando houver app nativo, esse módulo ganha alarme de verdade sem mudar a API.

## 7. Jobs em background

- **MVP**: APScheduler dentro do processo da API. Jobs: finalização do dia (a cada 5 min, finaliza os dias que passaram das 03:00 no fuso de cada usuário; idempotente; um advisory lock do Postgres garante que só uma réplica executa), disparo de alarmes (a cada minuto), limpeza da lixeira (diária, 04:30 UTC: apaga em definitivo o que passou de 30 dias e não tem histórico ligado).
- **Escala**: worker dedicado (arq ou Celery) + Redis. A interface dos services não muda; só o disparador.

## 7.1. Jogo: XP, níveis e patentes (Fase 13)

`player` traduz disciplina em progressão. A regra central é que **o XP é derivado do dia, não um
saldo à parte**: `xp_for_day(breakdown, pct, hit_target, streak)` usa a mesma foto que gera o
percentual (itens concluídos × peso da área + bônus de meta, de dia 100% e de sequência, com teto).
Consequências: marcar e desmarcar não acumula, a fila offline não conta duas vezes, e recalcular um
dia recalcula o XP junto. `daily_scores.xp` guarda o valor dos dias fechados; os dias abertos (hoje
e, antes das 03:00, ontem) são calculados na hora — é o que faz a barra subir no mesmo segundo.
Nível e patente saem de uma curva progressiva (`level_for`), sem estado no banco. `GET /player`
devolve nível, patente, XP total, progresso no nível e XP do dia; `GET /progress/day` passou a
incluir o `xp` do dia.

## 7.2. Liga semanal com robôs (Fase 14)

`league` põe sete competidores na mesma tabela: você e seis robôs. Decisão central: **os robôs
não existem no banco**. Cada um é sorteado por uma semente determinística `(usuário, semana,
divisão, posição)` e o XP dele num instante é função do relógio — cada robô tem um alvo por dia
e um ritmo (`early` · `steady` · `night` · `burst`), então o placar sobe ao longo do dia sem job
nenhum e a mesma semana recalculada dá sempre o mesmo resultado. Eles são robôs assumidos: nome
de máquina e etiqueta "robô" na tela.

Só o **resultado das semanas encerradas** vai para o banco (`league_weeks`): divisão, posição,
XP, desfecho e a divisão seguinte. A divisão atual é a que saiu do último encerramento (Bronze
para quem nunca jogou), e as semanas atrasadas são encerradas na leitura (autocura, como o
fechamento de dias). Cinco divisões (Bronze → Diamante); os 2 primeiros sobem, os 2 últimos
caem, sem queda no Bronze nem subida no Diamante. Empate com robô é do usuário.
`GET /league` devolve a tabela ao vivo + o resultado da última semana; `POST /league/seen`
marca a comemoração como vista.

## 7.3. Conquistas (Fase 15)

`achievements` é um catálogo em código (25 selos em cinco famílias: sequência, dias, nível, liga
e hábitos). Cada selo é uma **regra sobre números que já existem** — nada é contado à parte, então
nenhum selo pode divergir do histórico: apagar um dia mexe no progresso junto. Os números saem de
`progress.lifetime_stats` (uma consulta agregada sobre `daily_scores`, incluindo os itens
concluídos por área), `league.lifetime_stats` e `player.state`. No banco fica só
`achievement_unlocks` (chave, quando caiu, se o aviso foi visto). `GET /achievements` devolve a
lista com progresso e grava os selos novos; `POST /achievements/seen` apaga os avisos pendentes.

## 7.4. Treinos com carga de verdade (Fase 16)

Antes o exercício tinha `load` como texto livre ("60kg") e a sessão só marcava feito/não feito —
não dava para ver evolução. Agora:

- **Biblioteca** (`library.py`, 73 exercícios em código, como o catálogo de conquistas): cada um
  traz grupo muscular, ícone, descanso sugerido, degrau de carga e o **modo de digitar o peso**.
- **`load_mode`**: `total` (máquina, halter), `per_side` (barra: você digita o que tem de cada
  lado e o app soma `bar_weight`) ou `bodyweight`. `workout_sets.weight` guarda sempre o **peso
  real total em kg**, para a evolução comparar maçã com maçã mesmo se o modo mudar depois.
- **`workout_sets`** (migração 0015) é o registro real: uma linha por série, com peso, reps,
  feito e quando. Ao iniciar a sessão, as séries planejadas nascem **já preenchidas com o da
  última vez** (`ensure_sets`, idempotente — nunca sobrescreve o que o usuário digitou).
- **Progressão** (`exercise_progress`): carga anterior, recorde e sugestão de hoje. A sugestão
  só sobe quando **todas** as séries da última vez bateram o topo da faixa de repetições —
  subir carga sem ter fechado o número seria como marcar item que não fez.
- Série marcada mantém a visão do dia coerente: exercício com todas as séries feitas conta como
  concluído (`_sync_exercise_flag`), então Hoje e a tela do treino nunca divergem.
- **`body_weights`**: um registro por dia, com variação de 30 dias e gráfico próprio.
- `duration_seconds` na sessão guarda o cronômetro do treino.

## 7.5. Objetivo do treino (Fase 17)

O número de repetições não é um só: quem busca força faz poucas com carga alta, quem busca
definição faz muitas com descanso curto. Em vez de deixar o usuário adivinhar, o app tem quatro
objetivos em código (`library.py`, ao lado da biblioteca), cada um com faixa de repetições,
séries e descanso — força 4-6/180s, hipertrofia 8-12/90s, resistência 15-20/45s, potência
3-5/150s, na linha das diretrizes de treino de força (ACSM 2026).

- `workouts.goal` e `workout_exercises.goal` (migração 0016). Escolher o objetivo **preenche**
  séries, repetições e descanso; tudo continua editável depois — o objetivo é um atalho, não uma
  regra.
- Exercício novo herda o objetivo do plano quando não recebe um (`data.goal or w.goal`), então
  montar um "Treino A · força" já sai coerente.
- `workout_exercises.start_weight` (kg reais) é a carga de partida: sem histórico,
  `exercise_progress` sugere esse valor e o primeiro treino já abre com o peso preenchido. A
  partir do segundo, quem manda é o que foi levantado.
- A sessão **não começa sozinha**: a tela mostra o treino do dia e um botão "Começar treino"; o
  cronômetro e o registro só nascem daí (antes, abrir a tela já criava a sessão).

## 7.6. Tarefas fixas (Fase 18)

Uma tarefa que se repete ("beber 3 L de água, de segunda a sexta") é uma **regra**
(`task_recurrences`), e a tarefa de cada dia continua sendo uma linha comum em `tasks`,
criada sob demanda quando o dia é consultado (`ensure_recurring`, idempotente).

Por que não deixar a tarefa fixa ser um tipo especial de tarefa: o percentual do dia, a
lixeira, a ordenação por prioridade, o offline e o fechamento do dia já funcionam sobre
`tasks`. Materializar mantém tudo isso de graça e deixa o histórico honesto — mudar a regra
hoje não reescreve o que aconteceu na semana passada.

Três regras seguram o histórico:

- só gera a partir de `start_date` (o dia em que a regra nasceu) e só em **dia aberto ou
  futuro** — dia fechado não ganha tarefa nova;
- editar a regra altera só as tarefas **pendentes de hoje em diante**;
- tarefa fixa **não entra em "atrasadas"**: ela já contou (ou não) no dia dela.

## 7.7. Despertador que acorda (Fase 19)

O que o navegador **não** faz, e por isso nenhuma gambiarra vai resolver: notificação de site
não aceita som personalizado — a propriedade foi proposta em 2014, nunca chegou a navegador
nenhum e saiu do padrão em 2018. Com o app fechado, quem toca é o som de notificação do
aparelho. Também não dá para usar link do YouTube: extrair o áudio é contra os termos deles.

O que dá, e é o que o app faz:

- **Áudio do usuário** (`alarm_sounds`): o arquivo toca na tela do alarme — que abre ao tocar
  na notificação — e no modo cabeceira. Fica no Cache Storage depois do primeiro uso, então
  toca offline. Se o arquivo falhar ou o navegador bloquear o autoplay, o som sintetizado
  entra na hora: alarme mudo não existe.
- **Insistência**: o job por minuto reenvia a notificação enquanto o alarme segue pendente,
  até o limite do "perdido". Um toque só não tira ninguém da cama.
- **Modo cabeceira** (`/despertador/cabeceira`): a tela fica aberta com Wake Lock e o relógio
  do próprio app dispara o alarme. É o caminho que não depende de push nenhum — o mais
  confiável que um app web tem.
- **Guia dentro do app**: como deixar a notificação alta no Android (canal + ignorar o Não
  perturbe) e no iPhone.

## 7.8. Um app, dois formatos (Fase 20)

O mesmo endereço e o mesmo código servem celular e PC; quem decide o formato é a **largura da
janela**, não o aparelho. O corte é 1024 px (`lg:` do Tailwind):

- **abaixo**: HUD no topo, conteúdo numa coluna, barra de abas embaixo, formulário subindo de
  baixo (bottom sheet);
- **acima**: menu lateral fixo de 240 px com as abas escritas, conteúdo mais largo
  (`max-w-4xl`), tela Hoje em duas colunas (`columns-2` com `break-inside-avoid`, que mantém a
  ordem de leitura e não parte um bloco ao meio), formulário como janela centralizada.

Layout é decidido por classe CSS — funciona antes de o JavaScript rodar e acompanha o
redimensionamento da janela na hora. O `useIsDesktop` (media query em JS) só existe para o que
CSS não resolve: escolher a animação do formulário (subir x aparecer). Nada de detectar
aparelho pelo user agent, que erra em tablet, em janela dividida e em PC com tela sensível ao
toque.

As telas internas (despertador, configurações, detalhe de treino) também ficam com o menu
lateral no PC; no celular continuam de página cheia com o botão voltar.

## 7.9. Notas por área e soma de pontos (Fase 21)

Duas escolas contam nota de jeitos diferentes, e o app precisa dos dois:

- **Como o trimestre fecha** (`user_settings.grade_mode`): `weighted` soma as avaliações
  ponderadas pelo peso; `sum` soma os pontos (prova 5,5 + trabalho 4,0 = 9,5), e cada
  avaliação pode dizer quanto valia (`grades.max_points`), o que dá o "8,5 de 10".
- **Área de conhecimento** (`grade_areas` + `subjects.area_id`): a nota da área num período é
  a média das notas das matérias **que já têm nota** naquele período, e a tela mostra "3 de 4
  lançadas". Dividir por todas as matérias da área daria um número menor e falso enquanto o
  trimestre não fechou.

Quem lança nota continua sendo a matéria — a área é agrupamento, não um lugar onde se digita.
Assim o histórico não muda quando o usuário mexe nas áreas, e desligar o agrupamento devolve a
tela antiga sem perder nada.

Cada matéria também escolhe **como lança** (`subjects.grade_entry_mode`): `final`, uma nota por
trimestre, ou `items`, as avaliações que a compõem — que é o que deixa ver o desempenho antes
de a escola fechar a nota.

Tudo continua calculado na leitura: nenhuma média é gravada.

## 7.10. O quadro de áreas (Fase 22)

A primeira versão separava "ver notas" de "organizar áreas" em duas telas, e vinha com as
quatro áreas do ENEM prontas. Na prática deu o contrário do esperado: quem não estuda por
aquelas quatro gastava tempo apagando, e quem queria só lançar uma prova tinha que passear
entre telas. A Fase 22 junta tudo numa tela só:

- **Nada vem pronto.** Cada escola divide as áreas do seu jeito; uma lista errada dá mais
  trabalho para apagar do que para criar. O usuário cria as áreas dele, e o servidor escolhe a
  cor rodando uma paleta fixa (`AREA_COLORS`) para que duas áreas seguidas nunca saiam iguais.
- **As matérias sem área ficam numa faixa no topo** e vão para dentro de uma área arrastando.
  O alvo é calculado comparando o ponto do dedo com o retângulo de cada área; como o motion
  entrega o ponto contando a rolagem da página, a rolagem é descontada antes da comparação.
  Segurar a matéria perto da borda rola a lista, então dá para alcançar uma área longe.
- **Arrastar não é o único caminho.** Tocar na matéria abre uma folha com a lista de áreas —
  é o que o dedo acerta em tela pequena, e é o caminho que sobra quando o aparelho está com
  "reduzir animações" ligado.
- **A nota parcial não é nota ruim.** Com 4 de 5 pontos lançados numa prova que ainda vai ter
  mais avaliações, a média aparece em branco (não em vermelho) com "parcial" do lado, e a
  matéria explica "5 de 10 lançados · 80% do que valeu". Vermelho só quando o trimestre fechou.

Decisão de biblioteca: o app passou a carregar o pacote `domMax` do motion em vez do
`domAnimation`. O `domAnimation` não traz arrastar nem animação de reposição — os `layout` que
já existiam no código simplesmente não rodavam. Custo: ~13 kB gzip no bundle, que o service
worker já guarda no primeiro acesso.

## 8. Infra e deploy

```
docker-compose.yml
├── api        FastAPI (uvicorn)
├── db         PostgreSQL 16 (volume persistente)
└── caddy      HTTPS automático (Let's Encrypt), serve o build do frontend e faz proxy de /api
```

- HTTPS é **obrigatório** para service worker, push e Wake Lock; por isso o Caddy entra já no MVP.
- **Deploy em um container só** (`Dockerfile` na raiz): o mesmo backend, com `STATIC_DIR` apontando para o build do PWA, serve os estáticos (`/assets` imutável por 1 ano; `index.html`/`sw.js`/manifest sem cache; fallback SPA fora de `/api`). É o caminho para plataformas que entregam HTTPS e só rodam um container por serviço (Render, Fly, Koyeb). `render.yaml` publica no plano gratuito do Render com Postgres externo (Aiven Free); `DATABASE_URL` aceita o formato libpq dos provedores (`postgres://…?sslmode=require` → asyncpg com `ssl=require`, ver `app/core/dburl.py`) e o pool é pequeno por padrão (bancos gratuitos limitam conexões). Guia: `PUBLICAR-DE-GRACA.md`.
- **Cadastro fechado** (`SIGNUP_INVITE_CODE`): com o código definido, `POST /auth/register` exige `invite_code` (403 `invalid_invite_code` se faltar/errar; comparação em tempo constante) e a tela de criar conta mostra o campo quando `GET /auth/signup-policy` devolve `invite_required: true`. Vazio = cadastro aberto (SaaS). Login nunca pede código.
- Configuração via variáveis de ambiente (`.env`), lida com pydantic-settings. Nunca há segredo no código.
- Logs estruturados em JSON com `request_id`. Sentry opcional depois.
- CI no GitHub Actions: ruff + mypy + pytest no backend; typecheck + build no frontend.
- Versão do app visível em Configurações e no header `X-App-Version` de toda resposta.

## 9. Preparado para escala: o que vem no MVP e o que fica pronto para ligar

| Tema | No MVP | Quando escalar |
|---|---|---|
| API stateless | Sim | Réplicas atrás de load balancer |
| Isolamento por usuário | Sim, na camada de serviço | Row Level Security no Postgres como segunda barreira |
| Cache | Não | Redis para score, estatísticas e sessões |
| Jobs | APScheduler | Worker + fila |
| Estáticos | Caddy | CDN (Cloudflare) |
| Rate limit | Por IP | Por usuário e plano |
| Planos e cobrança | Não | Tabela `subscriptions` + Stripe/Mercado Pago |
| Observabilidade | Logs JSON | Sentry + métricas |

## 10. Estrutura de pastas

```
app/
├── backend/
│   ├── app/
│   │   ├── core/              # config, db, security, deps, scheduler, errors
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── routines/
│   │   │   ├── alarms/
│   │   │   ├── goals/
│   │   │   ├── workouts/
│   │   │   ├── tasks/
│   │   │   └── progress/      # score, sequência, estatísticas
│   │   │       ├── models.py
│   │   │       ├── schemas.py
│   │   │       ├── service.py
│   │   │       └── router.py
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/               # rotas, providers, layout, navegação
│   │   ├── features/          # mesmos módulos do backend
│   │   ├── components/ui/     # design system (Button, Card, Ring, Sheet...)
│   │   └── lib/               # cliente da API, tipos gerados, utils de data
│   └── public/                # manifest, ícones, sons dos alarmes
├── docs/
├── docker-compose.yml
└── README.md
```

## 11. Convenções

- API REST versionada em `/api/v1/...`; erros no formato `{ "error": { "code", "message", "details" } }`.
- "Dia" trafega como `date` (`YYYY-MM-DD`) no fuso do usuário; instantes como ISO 8601 em UTC.
- Nada de `alert`/`confirm` do navegador: diálogos próprios do design system (Enter confirma, Esc cancela).
- Exclusões vão para lixeira (soft delete) com restauração possível por 30 dias.
