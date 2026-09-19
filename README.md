# app (nome provisório)

Aplicativo de disciplina pessoal: rotina diária, despertador com confirmação, metas, treinos, tarefas e percentual de disciplina. PWA mobile-first com backend em Python.

**Status:** planejamento concluído, aguardando aprovação para iniciar a Fase 0.

## Documentação

| Doc | Conteúdo |
|---|---|
| [01 · Produto](docs/01-produto.md) | Problema, proposta de valor, persona, core loop, métricas, riscos |
| [02 · Arquitetura](docs/02-arquitetura.md) | Stack, decisões técnicas, despertador no PWA, infra, escala, estrutura de pastas |
| [03 · Banco de dados](docs/03-banco-de-dados.md) | Tabelas, índices e regras de cálculo do score e da sequência |
| [04 · Telas e fluxos](docs/04-telas-e-fluxos.md) | 26 telas, navegação, fluxo de primeiro uso, fluxo diário, diretrizes de design |
| [05 · Roadmap](docs/05-roadmap-mvp.md) | Ordem de desenvolvimento, MoSCoW, decisões pendentes, definição de pronto |

## Stack

- **Backend:** Python 3.11+ · FastAPI · SQLAlchemy 2 (async) · Alembic · PostgreSQL 16
- **Frontend:** PWA · React 18 · TypeScript · Vite · Tailwind · TanStack Query
- **Infra:** Docker Compose · Caddy (HTTPS) · GitHub Actions
