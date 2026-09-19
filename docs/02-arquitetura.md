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
auth · users · routines · alarms · goals · workouts · tasks · progress · trash · schedule · studies · grades
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

## 8. Infra e deploy

```
docker-compose.yml
├── api        FastAPI (uvicorn)
├── db         PostgreSQL 16 (volume persistente)
└── caddy      HTTPS automático (Let's Encrypt), serve o build do frontend e faz proxy de /api
```

- HTTPS é **obrigatório** para service worker, push e Wake Lock; por isso o Caddy entra já no MVP.
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
