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
- **Fase 17 — Objetivo do treino e começar treino** (feita): tela de aquecimento com o botão
  "Começar treino" (a sessão só começa quando a pessoa manda), objetivo por plano e por exercício
  (força 4-6 · hipertrofia 8-12 · resistência 15-20 · potência 3-5, com séries e descanso
  próprios), carga inicial no plano para o primeiro treino já vir preenchido, campo de peso
  dizendo "kg/lado" com a conta na tela, ícones redesenhados (equipamento em dois tons, grupo
  muscular como mapa do corpo) e mais animação nas telas de treino.

  As faixas seguem as diretrizes de treino de força (ACSM, edição 2026): carga alta com poucas
  repetições para força, faixa intermediária para hipertrofia, muitas repetições com descanso
  curto para resistência/definição — e ir à falha não é requisito.

- **Fase 18 — Tarefas fixas e treino em qualquer dia** (feita): tarefa que se repete nos dias
  da semana escolhidos (a regra fica separada da tarefa de cada dia, o histórico não muda e ela
  não vira atrasada), lista para editar/pausar/excluir, e "Treinar agora" em qualquer plano —
  fora do dia marcado a sessão entra como treino extra. Teste novo comparando as migrações com
  os modelos, depois de uma coluna sem default quebrar a criação da tarefa fixa.

- **Fase 19 — Despertador que acorda de verdade** (feita): áudio do usuário como som do alarme
  (guardado no banco, em cache no aparelho, com o som sintetizado como reserva), notificação
  insistente a cada minuto até confirmar, modo cabeceira (tela aberta, sem depender de push) e
  um guia de como deixar alto com o app fechado. Link do YouTube não entra: extrair áudio de lá
  é contra os termos do serviço.

- **Fase 20 — Formato de PC** (feita): o mesmo app se reorganiza a partir de 1024 px — menu
  lateral no lugar da barra de abas, conteúdo mais largo, tela Hoje em duas colunas e
  formulários como janela. Decidido por largura de janela, não por aparelho.

- **Fase 21 — Notas por área e soma de pontos** (feita): a escola que fecha por área agora
  agrupa as matérias e tira a média das que já têm nota; a que soma pontos tem "prova vale 6,
  trabalho vale 4"; e cada matéria escolhe entre lançar só a nota final do trimestre ou as
  avaliações que a compõem.

- **Fase 22 — O quadro de áreas** (feita): a tela de notas virou uma só. Nenhuma área vem
  pronta — o usuário cria as dele e leva as matérias para dentro arrastando (ou tocando, que
  abre a lista de áreas). Tocar na matéria lança prova, trabalho e o que mais tiver ali mesmo,
  e a média da área já conta o que existe: com 4 de 5 pontos de uma prova, ela aparece com
  "parcial" em vez de vermelho. Animações de reposição ligadas de verdade (o app carregava um
  pacote do motion que não incluía arrastar nem `layout`).

- **Fase 23 — Quadro de áreas prático** (feita): arrastar a matéria de longe até a área deu
  lugar a três gestos simples — alça ⠿ para ordenar (áreas e matérias, igual aos treinos),
  "+ Adicionar matéria" com seleção múltipla e busca, e tocar na matéria solta para escolher a
  área. A ordem fica guardada e vale também em Estudos. Tudo responde no toque (atualização
  otimista), e o visual ganhou trilho de cor por área, barra da média e animações com mola.

- **Fase 24 — Teto da escala e atividades à vista** (feita): na soma de pontos, atividades que
  passam do limite (duas de 10 numa escola até 10) viram média proporcional em vez de somar 20;
  e o quadro mostra cada atividade embaixo da matéria com a nota ao lado.

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
