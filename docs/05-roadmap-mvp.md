# 05 · Roadmap e Prioridades do MVP

Princípio: **uma funcionalidade por vez, de ponta a ponta** (banco → API → tela → teste), na ordem que fecha o core loop mais cedo e deixa o risco técnico maior para quando a base estiver firme.

## Ordem de desenvolvimento

| Fase | Entrega | Por que nessa posição |
|---|---|---|
| **0** ✅ 18/09 | **Fundação**: monorepo, Docker Compose (api + db + caddy), FastAPI com auth (cadastro, login, refresh, sessões), `users` + `user_settings`, migrações, PWA shell instalável, design system base (tokens, Button, Card, Sheet, Ring, Checklist, Hold), navegação de 5 abas, telas 1 a 4, casca da tela 5 (Hoje) e 25, CI | Tudo depende disso. Sai com login funcionando e app instalável no celular. |
| **1** ✅ 19/09 | **Rotinas + checklist diário** (telas 9, 10 e blocos de rotina em Hoje) + registro manual de "Levantei" em Hoje | É o coração de "rotina diária". O botão "Levantei" manual já cria a tabela `wake_logs` (módulo alarms) e antecipa o dado do despertador sem o risco técnico do push. |
| **2** ✅ 19/09 | **Tarefas** (telas 6, 7 e bloco em Hoje) | Segundo item do dia. Simples, valor imediato. |
| **3** ✅ 19/09 | **Evolução v1**: cálculo do score, sequência, **Fechar o dia** (tela 8), anel em Hoje, job da meia-noite | Fecha o core loop cedo. A partir daqui o produto já "transforma": dá o número honesto todo dia. Vem antes de metas e treinos de propósito, para que eles nasçam já contando no score. |
| **4** ✅ 19/09 | **Metas + ações** (telas 15 a 18, bloco em Hoje) | Entra no score via ações com data. |
| **5** ✅ 19/09 | **Treinos** (telas 19 a 22, bloco em Hoje) | Sessão com check por exercício e cronômetro de descanso. |
| **6** ✅ 19/09 | **Despertador inteligente** (telas 11 a 14): alarmes, Web Push + VAPID, job por minuto, tela de alarme com som sintetizado e Wake Lock, hold de 3 s, sonecas, histórico de acordar | É o módulo de maior risco técnico (HTTPS, permissões, iOS). Vem por último para ser testado no dispositivo real com todo o resto estável. |
| **7** ✅ 19/09 | **Evolução v2** (telas 23, 24): sequência e recorde, médias 7/30 dias, mapa de calor por mês, barras por área, detalhe do dia | Precisa de dados de todos os módulos. Leitura sobre `daily_scores` (`/progress/history`, `/progress/summary`), sem tabela nova. |
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

## Pendências de decisão levantadas durante o desenvolvimento

- ~~**Janela do "Levantei"**~~ — resolvida na Fase 6: o "Levantei" manual do dia D libera a partir das 03:00 de D (o mesmo corte que fecha o dia anterior). Antes disso você ainda está na noite de ontem. O alarme, quando toca, sempre pode ser confirmado; alarme perdido pode ser confirmado depois (vira `manual`).
- **Teste em aparelho real**: o push foi validado até a criptografia/assinatura VAPID e o service worker; a entrega de ponta a ponta (Android Chrome instalado, iOS 16.4+ instalado na tela inicial) precisa do domínio HTTPS. Checklist: ativar em Rotina → Despertador, criar alarme para 2 min à frente, fechar o app.

## Decisões do fundador (aprovadas em 18/09/2026)

1. **Tema escuro por padrão**; tema claro no pós-MVP.
2. **Peso igual** para todos os itens no cálculo da disciplina no MVP; a estrutura permite ponderar depois.
3. **Dia sem nada planejado conta como 0% e quebra a sequência.** Sem plano, sem disciplina.
4. **Setup cria automaticamente** alarme + rotinas Manhã e Noite vazias. Na Fase 0 o setup guarda `wake_time` em `user_settings`; a Fase 1 cria as rotinas e a Fase 6 cria o alarme "Acordar" a partir desse valor. A partir da Fase 6 o alarme é a fonte de verdade do horário de acordar; `wake_time` só vale para quem não tem alarme.
5. **"Levantei" manual desde a Fase 1**, antes do alarme com push.
6. **Nome provisório: "Disciplina"** (constante única no código; troca depois sem refatorar).

## Definição de pronto de cada funcionalidade

- Modelo + migração Alembic versionada.
- Endpoints em `/api/v1` com schemas Pydantic e testes (incluindo isolamento entre usuários).
- Tela no PWA usando o design system, com estado vazio, carregando e erro.
- Funciona no celular instalado (Android Chrome e iOS Safari).
- Sem funcionalidade extra além da aprovada.
