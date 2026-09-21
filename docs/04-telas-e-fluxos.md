# 04 · Telas, Navegação e Fluxos

## Navegação

Barra inferior com **6 abas** (5 no MVP; **Estudos** entrou na Fase 10). Tudo o mais é alcançado a partir delas.

```
┌────────┬────────┬─────────┬────────┬─────────┬──────────┐
│  Hoje  │ Rotina │ Estudos │ Metas  │ Treinos │ Evolução │
└────────┴────────┴─────────┴────────┴─────────┴──────────┘
```

- **Tarefas** vivem dentro de **Hoje** (é onde são executadas) e têm um botão "+" flutuante.
- **Despertador** e **Agenda da semana** vivem dentro de **Rotina** (acordar é o primeiro passo da rotina da manhã; a agenda é a estrutura fixa da semana).
- **Perfil/Configurações** abre pelo avatar no topo de qualquer aba.

## Lista de telas (MVP)

### Entrada
| # | Tela | Ação primária |
|---|---|---|
| 1 | Boas-vindas (3 cards: rotina · confirmação de acordar · número honesto) | Começar |
| 2 | Criar conta / Entrar (em servidor fechado, Criar conta pede o **código de convite**) | Entrar |
| 3 | Setup inicial: nome, fuso (detectado), horário de acordar, meta de disciplina | Continuar |
| 4 | Instalar o app (guia por plataforma; explica por que o push precisa disso) | Instalar / Depois |

### HUD (todas as abas)
| # | Tela | Conteúdo |
|---|---|---|
| 56 | **Quadro de áreas, versão prática** (Fase 23): faixa "Sem área" com as matérias soltas (tocar abre a lista de áreas) · cartão por área com trilho colorido, média do trimestre, barra de progresso com o risquinho da média mínima, e as matérias dentro, cada uma com alça ⠿ para ordenar · alça no cabeçalho para ordenar as áreas · "+ Adicionar matéria" abre a lista com busca, seções "Nesta área / Sem área / Em outras áreas" e seleção múltipla · "+ Nova área" no fim, vira campo ao tocar. Tudo muda na hora, sem esperar o servidor. |
| 55 | **Quadro de áreas** (Fase 22): uma tela só. Trimestre em cima, faixa "Sem área" com as matérias soltas (arrasta para dentro de uma área ou toca e escolhe na lista), cartão por área com a média do trimestre e as matérias dentro, e o campo "Nova área" no fim. Nome da área edita no toque, × exclui (as notas ficam). Enquanto falta fechar pontos, a média sai em branco com "parcial". |
| 54 | **Notas por área**: cada área com a média do ano e por trimestre, "3 de 4 lançadas" quando ainda falta matéria, e as matérias dentro ao tocar. |
| 53 | **Como lançar, por matéria**: "Nota final" (uma por trimestre) ou "Por avaliações" (prova, trabalho…). Na soma de pontos cada avaliação mostra "5 de 6" e o trimestre, "soma 8,5 de 10". |
| 52 | **Formato de PC** (a partir de 1024 px): menu lateral com as seis abas, conteúdo mais largo, Hoje em duas colunas e formulários em janela centralizada. Abaixo disso, tudo como era no celular. |
| 51 | **Modo cabeceira** (`/despertador/cabeceira`): relógio grande, tela acesa, escurece sozinho. O alarme toca aí mesmo, com o áudio escolhido, sem depender de notificação. |
| 50 | **Áudio próprio do alarme**: subir o arquivo (até 5 MB, até 5 guardados), ouvir a prévia, escolher por alarme; "Insistir até eu desligar" repete a notificação a cada minuto. |
| 49 | **Treinar em qualquer dia**: "Treinar agora" em cada plano e "Começar treino" dentro do plano. Fora do dia marcado, a sessão entra como **treino extra** do dia. |
| 48 | **Tarefa fixa**: em Nova tarefa, "Repetir" + os dias da semana. Ela aparece sozinha todo dia marcado, com o ícone de repetição, e a lista "Tarefas fixas" (no rodapé do bloco Tarefas) edita, pausa ou exclui a regra. |
| 47 | **Objetivo do treino** (no plano e em cada exercício): força 4-6 · hipertrofia 8-12 · resistência 15-20 · potência 3-5, cada um com séries e descanso próprios. Escolher preenche os campos; tudo continua editável. |
| 46 | **Aquecimento** (`/treinos/:id/sessao`, antes de começar): o treino do dia com os exercícios e o botão **Começar treino**. O cronômetro só corre depois disso. |
| 45 | **Evolução do exercício** (`/treinos/exercicio/:id`): gráfico da maior carga por treino e o registro de cada dia com o volume. |
| 44 | **Treino em andamento** (`/treinos/:id/sessao`): tempo total correndo, séries com peso e repetições, "última vez" e convite a subir carga, descanso automático com som e vibração, volume do dia. |
| 43 | **Conquistas** (`/conquistas`): vitrine de 25 selos por família, com data nos conquistados e barra de progresso nos que faltam. Aviso no rodapé quando um selo cai (três ou mais de uma vez viram um aviso só). Cartão resumo na Evolução. |
| 42 | **Liga** (`/liga`): divisão, posição, os sete competidores com XP, zonas de subida e queda, regras. Cartão resumo no Hoje e na Evolução; ao virar a semana, tela de resultado (uma vez). |
| 41 | **Barra de XP** fixa no topo: emblema do nível, patente colorida, progresso do nível. Ao concluir algo, o contador vira "+N XP" e a barra pulsa; ao subir de nível, abre a comemoração (anéis, faíscas, som curto e vibração). |

### Hoje (home)
| # | Tela | Conteúdo |
|---|---|---|
| 5 | **Hoje** | Saudação + data · anel de disciplina do dia · sequência atual · blocos na ordem do dia: **Acordar** (status ou botão "Levantei") → **Rotina da manhã** (checklist) → **Agenda de hoje** (linha do tempo: agora / próximo / encerrado; só aparece para quem tem agenda) → **Tarefas** (por prioridade) → **Estudos** (sessões que as provas cobram hoje, com sugestão de horário; some quando não há nenhuma) → **Treino de hoje** (com o horário vindo da agenda) → **Ações das metas** → **Rotina da noite** → botão **Fechar o dia** |
| 6 | Nova tarefa / Editar tarefa (bottom sheet) | Título, dia, prioridade, categoria, notas |
| 7 | Categorias de tarefas | Criar, renomear, cor |
| 8 | **Fechar o dia** | Resumo: % do dia, o que ficou de fora, sequência atualizada. Animação sóbria do anel. |

### Rotina
| # | Tela | Conteúdo |
|---|---|---|
| 9 | Rotinas | Cards Manhã, Noite e personalizadas · atalho para a Agenda da semana · atalho para Despertador |
| 10 | Editar rotina | Nome, tipo, horário, dias da semana, lista ordenável de itens |
| 11 | Despertador | Lista de alarmes com toggle · próximo toque · notificações neste aparelho · atalho para o histórico |
| 12 | Editar alarme (bottom sheet) | Horário, nome, dias, som com prévia (3 sons sintetizados), segurar 3 s obrigatório, sonecas (quantidade e duração), excluir |
| 13 | **Alarme tocando** (tela cheia, rota `/alarme`) | Horário grande, som em loop com volume crescente, Wake Lock, silenciar, **segurar 3 s para "Levantei"**, soneca com contagem regressiva; estados: tocando · soneca · perdido · confirmado · ocioso |
| 14 | Histórico de acordar | 30 dias: levantou × perdidos × atraso médio; lista por dia com planejado → levantou, sonecas e status |
| 29 | **Agenda** (`/agenda`, Fase 9) | Abas seg–dom (ponto nos dias com blocos, hoje destacado) · lista do dia com faixa na cor da matéria, início/fim, tipo, local, duração · total do dia · "Copiar este dia para…" (pula horários ocupados) |
| 30 | Novo/Editar bloco (bottom sheet) | Tipo (Aula/Treino/Estudo/Outro) · matéria com criação inline · plano de treino (opcional) · título (segue a matéria/treino) · dias da semana (criação em vários) · início/fim com atalhos 45/50/60/90 min · local · pausar · excluir. Conflito de horário volta como erro nomeando o bloco. |
| 31 | Matérias (`/agenda/materias`) | Nome, cor, professor(a), ativa; carga semanal calculada pela agenda |

### Estudos (6ª aba, Fase 10)
| # | Tela | Conteúdo |
|---|---|---|
| 32 | **Estudos** (`/estudos`) | Sessões de hoje (estado + atalho para o cronômetro) · próximas provas/trabalhos com data, "em N dias", barra de sessões feitas/total, conteúdos · passadas e feitas sob demanda · card **Notas** ("2 matérias pedem atenção") · FAB |
| 33 | Nova/Editar prova (bottom sheet) | Prova/Trabalho · matéria · título (segue a matéria) · data · começar a cobrar (3/5/7/10/14 dias antes) · estudo por dia (20–90 min) com prévia "N sessões · total" · conteúdos (um por linha) · notas · marcar como feita/entregue · excluir |
| 34 | Detalhe da prova (`/estudos/:id`) | Cabeçalho com barra de progresso e plano · botão "Estudar agora" · conteúdos (checklist com adicionar/excluir) · seção **Estudar com IA** (tela 39) · lista das sessões da janela (feita · não feita · pendente) |
| 36 | **Notas** (`/estudos/notas`, Fase 11) | Régua no topo (média mínima · períodos · escala) · seletor de ano quando há mais de um · agrupado por área, o quadro da Fase 22 (faixa de matérias sem área, cartões de área, arrastar para dentro); sem agrupar, card por matéria com média do ano, um bloco por período (verde ≥ média, vermelho abaixo, tracejado sem nota) e a frase "Precisa de X no 3º trimestre para fechar com 6" com status colorido · toque abre a matéria (notas por período, lançar/editar/excluir) · "Configurar" abre a régua da escola (0–10 ou 0–100, média mínima, 2/3/4 períodos) |
| 37 | Lançar/Editar nota (bottom sheet) | Período · nota (aceita vírgula) · peso 1/2/3 · título · excluir com confirmação. Na tela da prova, "Lançar a nota" abre já ligada à prova e mostra a nota lançada. |
| 39 | **Estudar com IA** (seção da tela 34, Fase 12) | Materiais (fotos transcritas ou texto colado) · "Tirar fotos" abre a câmera/galeria → "Confira a transcrição" (texto editável + nome) → salvar · "Colar texto" · quatro cards (Teoria · Resoluções · Mapa mental · Quiz) com estado (gerar · na fila · gerando… · pronto · falhou · desatualizado) · "Gerar estudo com IA" / "Gerar tudo de novo" · aviso "IA não configurada" quando o servidor não tem chave |
| 40 | Material gerado (`/estudos/:id/ia/:kind`) | Teoria e resoluções em Markdown legível; mapa mental como árvore recolhível colorida por nível; quiz interativo (alternativa → certa/errada + explicação → resultado com % e "Refazer"); "Gerar de novo" quando falhou ou está desatualizado; rodapé com modelo e data |
| 35 | **Sessão de estudo** (`/estudos/:id/sessao/:date`) | Cronômetro de foco com anel até os minutos planejados (sino + vibração ao bater), começar/pausar/retomar (sobrevive a recarregar), concluir, pular hoje (com confirmação), conteúdos à mão; Wake Lock enquanto roda; dia fechado = só leitura |

### Metas
| # | Tela | Conteúdo |
|---|---|---|
| 15 | Metas | Cards com barra de progresso, prazo e área; filtro ativas/concluídas |
| 16 | Detalhe da meta | Progresso, dias restantes, lista de ações (check + data), botão concluir meta |
| 17 | Nova/Editar meta | Título, descrição, área, prazo |
| 18 | Nova/Editar ação | Título, data (opcional) |

### Treinos
| # | Tela | Conteúdo |
|---|---|---|
| 19 | Treinos | Planos com dias da semana · treino de hoje em destaque com o botão **Começar treino** |
| 20 | Editar plano | Nome, **objetivo**, dias, lista ordenável de exercícios com ícone (séries, reps, carga inicial, descanso) |
| 21 | **Sessão de treino** | Aquecimento com "Começar treino" → séries com peso (**kg/lado** quando é barra, com a conta na tela) e repetições, cronômetro de descanso, Concluir / Pular |
| 22 | Histórico de treinos | Calendário do mês com dias treinados |

### Evolução
| # | Tela | Conteúdo |
|---|---|---|
| 23 | **Evolução** | Sequência atual (e acumulada até ontem) e recorde · disciplina média 7/30 dias com dias na meta · mapa de calor do mês com navegação · barras por área (acordar, rotinas, tarefas, treino, metas) nos últimos 30 dias fechados |
| 24 | Detalhe do dia (a partir do mapa, rota `/evolucao/:data`) | Fotografia daquele dia: anel, estado (em andamento, fechado, finalizado), sequência naquele dia e, por área, cada item planejado com o que foi cumprido; se os itens já não existem, mostra o consolidado gravado |

### Perfil
| # | Tela | Conteúdo |
|---|---|---|
| 25 | Configurações | Nome, fuso, meta de disciplina, notificações, sons, dispositivos conectados, versão do app, sair |
| 26 | Lixeira (Configurações → Dados) | Itens excluídos nos últimos 30 dias, agrupados por tipo (rotinas, itens, tarefas, categorias, metas, ações, treinos, exercícios, alarmes), com data de expiração e Restaurar |

Total: **26 telas**, sendo 8 principais e 18 de edição/detalhe.

## Fluxo de primeiro uso

```
Abrir link → Boas-vindas → Criar conta → Setup (nome, fuso, hora de acordar, meta)
→ app cria automaticamente: alarme no horário informado, rotina "Manhã" e "Noite" vazias
→ Guia de instalação (PWA) → Hoje (estado vazio orienta: "adicione o 1º item da manhã")
```

Ativação acontece quando o usuário **fecha o primeiro dia**.

## Fluxo diário

```
06:00  Push do alarme ──► Alarme tocando ──► segura 3 s ──► "Levantei 06:04" gravado
       └► Hoje abre com Rotina da manhã em foco ──► checks

Dia    Hoje: tarefas por prioridade · Treino de hoje ──► Sessão ──► Concluir
       Ações das metas com data de hoje aparecem no bloco de metas

Noite  Rotina da noite ──► Fechar o dia ──► anel fecha em 87% · sequência 12 → 13
       Alarme de amanhã já ativo (mostrado no rodapé do resumo)

00:00  Se não fechou: job fecha automaticamente com o que foi marcado
```

## Estados importantes

- **Vazio**: toda lista vazia ensina o próximo passo com uma frase e um botão. Nunca tela branca.
- **Offline**: Hoje abre com o último estado em cache (cache de consultas persistido no aparelho por 24 h, limpo ao sair da conta). Checks de rotina, tarefa, ação de meta e exercício feitos sem rede ficam numa fila local persistida e são reenviados em ordem ao reconectar; uma faixa no topo mostra "Sem conexão · N ações pendentes". Criar/editar não entra na fila.
- **Dia com nada planejado**: Hoje avisa "Nada planejado para hoje. Sem plano, a sequência quebra." e oferece adicionar tarefa ou item de rotina.
- **Registro retroativo**: checks e "Levantei" valem para hoje e ontem; dias anteriores ficam só leitura.
- **Alarme perdido** (não confirmou em 60 min): status `missed`, aparece em Hoje como "Você não confirmou que acordou", pode confirmar manualmente (fica marcado como `manual`).
- **Janela do "Levantei" manual**: o botão de hoje só libera a partir das 03:00 (o mesmo corte que fecha o dia anterior). Antes disso, Hoje explica: "Ainda é madrugada… ou quando o alarme tocar". O alarme, quando toca, sempre pode ser confirmado.
- **Como a tela de alarme abre**: (1) relógio local do app aberto, que pede o disparo ao servidor na hora; (2) o servidor diz que há alarme tocando ao abrir/voltar para o app; (3) clique na notificação Web Push. Quem sai da tela de propósito não é puxado de volta até o próximo toque (soneca).

## Diretrizes de design (premium, minimalista)

| Aspecto | Decisão |
|---|---|
| Tema | Escuro por padrão (fundo `#0B0D10`, superfícies `#14171C`), tema claro disponível |
| Cor de destaque | Uma só: verde-lima elétrico (`#C6F135`) para progresso e ações primárias. Vermelho apenas para perigo. |
| Tipografia | Inter (texto) + números grandes em peso 600 para horários, percentuais e sequência |
| Grid | 8 pt; margens laterais 20 px; cards com borda sutil (`1px`, 8% de branco), sem sombras pesadas |
| Componentes-chave | Anel de progresso, checklist com check animado, bottom sheet para edição, botão de segurar (hold) para confirmar |
| Movimento | Curto (150 a 250 ms), com propósito: check, anel, transição de tela. Nada decorativo. |
| Diálogos | Sempre próprios (nunca `alert`/`confirm`); Enter confirma, Esc cancela |
| Linguagem | Direta, segunda pessoa, sem exclamações em excesso. "Você cumpriu 87% do dia." |
| Acessibilidade | Contraste AA, áreas de toque ≥ 44 px, suporte a `prefers-reduced-motion` |
