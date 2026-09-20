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
| **8** ✅ 19/09 | **Polimento**: lixeira (tela 26) com restaurar e limpeza diária, offline com fila local persistida e cache do dia, estados vazios revisados, `prefers-reduced-motion` (MotionConfig + CSS), performance (só o subconjunto latino da fonte: precache do PWA de 1,1 MB para 0,87 MB) | Deixa pronto para o segundo usuário. |

Cada fase termina com: migração aplicada, testes passando, tela usável no celular, commit.

## Pós-MVP · trilha do estudante (aprovada em 19/09/2026)

| Fase | Entrega | Decisões |
|---|---|---|
| **9** ✅ 19/09 | **Agenda semanal** (telas 29 a 31): matérias, blocos por dia da semana com início/fim (aula, treino, estudo, outro), conflito de horário, copiar dia, linha do tempo em Hoje, horário do treino no bloco de treino | Aulas **não contam no percentual**. Vive dentro da aba Rotina (`/agenda`). Bloco de treino ligado a um plano acrescenta o dia ao plano. |
| **10** ✅ 19/09 | **Provas e trabalhos** (telas 32 a 35): data, "começar a cobrar X dias antes", minutos por dia → uma sessão de estudo por dia, sugerida no maior buraco da agenda, **contando no percentual** (área `study`), cronômetro de foco, conteúdos por prova | Nova aba **Estudos** (6ª). Janela começa no dia do cadastro. Pular conta como não feita. |
| **11** ✅ 19/09 | **Notas** (telas 36, 37): régua da escola (média mínima padrão 6, 2/3/4 períodos, escala 10 ou 100), notas com peso por período, média do ano, "quanto preciso tirar" com status, nota ligada à prova | Média simples entre períodos; ponderada dentro do período. |
| **12** ✅ 19/09 | **Estudos com IA a partir de fotos** (telas 39, 40): fotos → transcrição editável (só o texto é guardado) → teoria focada nos exercícios, resoluções passo a passo, mapa mental e quiz, gerados em segundo plano; estado "desatualizado" quando o material muda | Provedor compatível com OpenAI por `.env` (Groq/Gemini/Mistral gratuitos ou pago); sem chave, "IA não configurada". |

## Pós-MVP · trilha do jogo (aprovada em 20/09/2026)

Decisões do fundador: visual escuro premium com camada de jogo (não arcade), XP por item com bônus
no fechamento do dia, liga semanal com bots identificados como robôs, começando pelo motor de XP.

- **Fase 13 — XP, níveis e animações** (feita): XP derivado do dia, curva de níveis com patentes,
  HUD fixo com barra de XP, comemoração de nível, check com mola/estouro, cartão de nível na Evolução.
- **Fase 14 — Liga semanal com robôs** (feita): cinco divisões, seis robôs determinísticos com
  ritmo próprio, virada na segunda com 2 subindo e 2 caindo, tela da liga, cartão no Hoje e na
  Evolução, comemoração do resultado. Robôs sempre marcados como robôs.
- **Fase 15 — Conquistas e polimento** (feita): 25 selos derivados do histórico, vitrine própria,
  aviso de desbloqueio (com resumo quando vários caem juntos), transição de entrada entre telas e
  percentual do dia contando até o valor.

## Pós-MVP · trilha da academia (aprovada em 20/09/2026)

Decisões do fundador: carga registrada série a série e já preenchida com a do último treino; o
peso digitado conforme o exercício (barra por lado, máquina total); cronômetro de descanso
automático mais o tempo total; peso corporal registrado quando quiser, com gráfico.

- **Fase 16 — Treinos com carga de verdade** (feita): biblioteca de 73 exercícios com ícones,
  séries com peso e reps, carga anterior e sugestão de progressão, descanso automático, tempo
  total, peso corporal e gráficos de evolução.

## MoSCoW

**Must (MVP)**
Tudo nas fases 0 a 8 — **concluído em 19/09/2026**.

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
