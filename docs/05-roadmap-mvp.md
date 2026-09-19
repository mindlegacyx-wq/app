# 05 · Roadmap e Prioridades do MVP

Princípio: **uma funcionalidade por vez, de ponta a ponta** (banco → API → tela → teste), na ordem que fecha o core loop mais cedo e deixa o risco técnico maior para quando a base estiver firme.

## Ordem de desenvolvimento

| Fase | Entrega | Por que nessa posição |
|---|---|---|
| **0** | **Fundação**: monorepo, Docker Compose (api + db + caddy), FastAPI com auth (cadastro, login, refresh, sessões), `users` + `user_settings`, migrações, PWA shell instalável, design system base (tokens, Button, Card, Sheet, Ring, Checklist, Hold), navegação de 5 abas, telas 1 a 4, casca da tela 5 (Hoje) e 25, CI | Tudo depende disso. Sai com login funcionando e app instalável no celular. |
| **1** | **Rotinas + checklist diário** (telas 9, 10 e blocos de rotina em Hoje) + registro manual de "Levantei" em Hoje | É o coração de "rotina diária". O botão "Levantei" manual já cria a tabela `wake_logs` (módulo alarms) e antecipa o dado do despertador sem o risco técnico do push. |
| **2** | **Tarefas** (telas 6, 7 e bloco em Hoje) | Segundo item do dia. Simples, valor imediato. |
| **3** | **Evolução v1**: cálculo do score, sequência, **Fechar o dia** (tela 8), anel em Hoje, job da meia-noite | Fecha o core loop cedo. A partir daqui o produto já "transforma": dá o número honesto todo dia. Vem antes de metas e treinos de propósito, para que eles nasçam já contando no score. |
| **4** | **Metas + ações** (telas 15 a 18, bloco em Hoje) | Entra no score via ações com data. |
| **5** | **Treinos** (telas 19 a 22, bloco em Hoje) | Sessão com check por exercício e cronômetro de descanso. |
| **6** | **Despertador inteligente** (telas 11 a 14): alarmes, Web Push + VAPID, scheduler, tela de alarme com som e Wake Lock, hold de 3 s, sonecas | É o módulo de maior risco técnico (HTTPS, permissões, iOS). Vem por último para ser testado no dispositivo real com todo o resto estável. |
| **7** | **Evolução v2** (telas 23, 24): médias 7/30 dias, mapa de calor, barras por área, recorde de sequência, detalhe do dia | Precisa de dados de todos os módulos. |
| **8** | **Polimento**: lixeira (tela 26), offline com fila local, estados vazios revisados, `prefers-reduced-motion`, revisão de performance | Deixa pronto para o segundo usuário. |

Cada fase termina com: migração aplicada, testes passando, tela usável no celular, commit.

## MoSCoW

**Must (MVP)**
Tudo nas fases 0 a 7.

**Should (logo após o MVP, com aprovação)**
Modelos prontos de rotina no setup ("Manhã produtiva", "Noite de descanso"); ligar uma tarefa a uma meta; verificação de e-mail; recuperação de senha.

**Could (depois)**
Tema claro; widgets; relatórios semanais por e-mail; exportar dados.

**Won't (fora do MVP)**
Social e comunidade; coach por IA; integrações (Calendar, Health, Strava); pagamentos e planos; painel administrativo; app nativo.

## Pontos que precisam de decisão do fundador

1. **Tema escuro por padrão** com tema claro no pós-MVP: ok?
2. **Peso igual** para todos os itens no cálculo da disciplina (uma tarefa vale o mesmo que um treino) no MVP: ok? A estrutura já permite ponderar depois.
3. **Dia sem nada planejado é neutro** (não quebra nem soma sequência): ok?
4. **Setup cria automaticamente** alarme + rotinas Manhã e Noite vazias: ok?
5. **"Levantei" manual desde a fase 1**, antes do alarme com push: ok?
6. **Nome do produto**: preciso de um nome (ou provisório) para manifest, título e repositório de ícones.

## Definição de pronto de cada funcionalidade

- Modelo + migração Alembic versionada.
- Endpoints em `/api/v1` com schemas Pydantic e testes (incluindo isolamento entre usuários).
- Tela no PWA usando o design system, com estado vazio, carregando e erro.
- Funciona no celular instalado (Android Chrome e iOS Safari).
- Sem funcionalidade extra além da aprovada.
