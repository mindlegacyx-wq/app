# Disciplina (nome provisório)

Aplicativo de disciplina pessoal: rotina diária, despertador com confirmação, metas, treinos, tarefas, agenda semanal e percentual de disciplina. PWA mobile-first com backend em Python.

**Status:** v1.1 — MVP completo (Fases 0 a 8) + trilha do estudante (Fases 9 a 12): agenda semanal com matérias, provas e trabalhos com sessões de estudo automáticas, notas com "quanto preciso tirar" e estudos com IA a partir de fotos dos exercícios. Próximo passo: publicar com HTTPS e abrir para os primeiros usuários.

## Documentação

| Doc | Conteúdo |
|---|---|
| [01 · Produto](docs/01-produto.md) | Problema, proposta de valor, persona, core loop, métricas, riscos |
| [02 · Arquitetura](docs/02-arquitetura.md) | Stack, decisões técnicas, despertador no PWA, infra, escala, estrutura de pastas |
| [03 · Banco de dados](docs/03-banco-de-dados.md) | Tabelas, índices e regras de cálculo do score e da sequência |
| [04 · Telas e fluxos](docs/04-telas-e-fluxos.md) | Telas, navegação, fluxo de primeiro uso, fluxo diário, diretrizes de design |
| [05 · Roadmap](docs/05-roadmap-mvp.md) | Ordem de desenvolvimento, MoSCoW, decisões do fundador, definição de pronto |

## Stack

- **Backend:** Python 3.11+ · FastAPI · SQLAlchemy 2 (async) · Alembic · PostgreSQL 16
- **Frontend:** PWA · React 19 · TypeScript · Vite · Tailwind 4 · TanStack Query · Motion
- **Infra:** Docker Compose · Caddy (HTTPS automático) · GitHub Actions

## Desenvolvimento local

Pré-requisitos: Python 3.11+, Node 22+, PostgreSQL 16 rodando em `127.0.0.1:5432`.

```bash
# 1. Banco (uma vez)
psql -U postgres -c "CREATE ROLE disciplina WITH LOGIN PASSWORD 'disciplina' CREATEDB;"
psql -U postgres -c "CREATE DATABASE disciplina OWNER disciplina;"
psql -U postgres -c "CREATE DATABASE disciplina_test OWNER disciplina;"

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env          # gere um JWT_SECRET e mantenha COOKIE_SECURE=false em dev
python -m app.core.push       # opcional: gera VAPID_PUBLIC_KEY/PRIVATE_KEY para o push do alarme; cole no .env
alembic upgrade head
./scripts/dev.sh              # API em http://127.0.0.1:8000 (docs em /api/docs)

# 3. Frontend (outro terminal)
cd frontend
npm install
npm run dev                   # PWA em http://localhost:5173 (proxy de /api para a API)
```

Testes e qualidade:

```bash
cd backend && pytest && ruff check app tests && mypy app
cd frontend && npx tsc -b && npm run lint && npm run build
```

## Produção (VPS com Docker)

```bash
cp .env.example .env          # DOMAIN, POSTGRES_PASSWORD, JWT_SECRET
docker compose run --rm api python -m app.core.push   # gera as chaves VAPID; cole no .env (uma vez, nunca troque)
docker compose up -d --build  # db + api (migra sozinho) + build do PWA + Caddy com HTTPS
```

O domínio precisa apontar para a VPS antes do primeiro `up`, para o Caddy emitir o certificado. HTTPS é obrigatório: service worker, push e Wake Lock não funcionam sem ele.

### IA para estudos (opcional)

Fotos dos exercícios viram texto (transcrição editável) e, a partir dele, teoria focada, resoluções passo a passo, mapa mental e quiz. Funciona com qualquer provedor compatível com a API da OpenAI — preencha no `.env`:

```bash
AI_BASE_URL=https://api.groq.com/openai/v1          # ou Gemini / Mistral / OpenAI / Ollama
AI_API_KEY=...                                      # sem chave, o app mostra "IA não configurada"
AI_MODEL=llama-3.3-70b-versatile                    # texto (teoria, resoluções, mapa, quiz)
AI_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct   # leitura das fotos
```

Para começar de graça: Groq (console.groq.com) ou Google AI Studio (Gemini, `AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, `AI_MODEL=AI_VISION_MODEL=gemini-2.5-flash`). As fotos não são guardadas no servidor — só o texto transcrito.

### Despertador: o que esperar

- **App aberto** (celular na cabeceira): a tela de alarme abre sozinha na hora, toca em loop e mantém a tela acesa.
- **App fechado**: chega uma notificação (Web Push). No Android Chrome funciona com o app instalado ou não; no iPhone só com o app instalado na tela inicial (iOS 16.4+). É notificação, não alarme que vence o modo silencioso — mantenha o alarme nativo como reserva.
- Ative as notificações em **Rotina → Despertador** (ou Configurações) em cada aparelho.

## Estrutura

```
backend/   FastAPI — app/core (config, db, security, deps, errors, scheduler, push, softdelete), app/modules/<módulo>/{models,schemas,service,router}.py
frontend/  PWA — src/app (rotas, shell), src/features/<módulo>, src/components/ui (design system), src/lib (api, auth, push, fila offline, formatação), src/sw.ts (service worker)
infra/     Caddyfile
docs/      planejamento do produto
```

## Convenções

- API em `/api/v1`, erros sempre `{ "error": { "code", "message", "details" } }`, mensagens em português.
- Toda rota privada filtra por usuário na camada de serviço; há teste garantindo isolamento entre contas.
- Instantes em UTC; o "dia" é calculado no fuso do usuário.
- Uma funcionalidade por vez, de ponta a ponta, sem extras fora do roadmap aprovado.
