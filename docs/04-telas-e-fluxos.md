# 04 · Telas, Navegação e Fluxos

## Navegação

Barra inferior com **5 abas**. Tudo o mais é alcançado a partir delas.

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│   Hoje   │  Rotina  │  Metas   │  Treinos │ Evolução │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

- **Tarefas** vivem dentro de **Hoje** (é onde são executadas) e têm um botão "+" flutuante.
- **Despertador** vive dentro de **Rotina** (acordar é o primeiro passo da rotina da manhã).
- **Perfil/Configurações** abre pelo avatar no topo de qualquer aba.

## Lista de telas (MVP)

### Entrada
| # | Tela | Ação primária |
|---|---|---|
| 1 | Boas-vindas (3 cards: rotina · confirmação de acordar · número honesto) | Começar |
| 2 | Criar conta / Entrar | Entrar |
| 3 | Setup inicial: nome, fuso (detectado), horário de acordar, meta de disciplina | Continuar |
| 4 | Instalar o app (guia por plataforma; explica por que o push precisa disso) | Instalar / Depois |

### Hoje (home)
| # | Tela | Conteúdo |
|---|---|---|
| 5 | **Hoje** | Saudação + data · anel de disciplina do dia · sequência atual · blocos na ordem do dia: **Acordar** (status ou botão "Levantei") → **Rotina da manhã** (checklist) → **Tarefas** (por prioridade) → **Treino de hoje** → **Ações das metas** → **Rotina da noite** → botão **Fechar o dia** |
| 6 | Nova tarefa / Editar tarefa (bottom sheet) | Título, dia, prioridade, categoria, notas |
| 7 | Categorias de tarefas | Criar, renomear, cor |
| 8 | **Fechar o dia** | Resumo: % do dia, o que ficou de fora, sequência atualizada. Animação sóbria do anel. |

### Rotina
| # | Tela | Conteúdo |
|---|---|---|
| 9 | Rotinas | Cards Manhã, Noite e personalizadas · atalho para Despertador |
| 10 | Editar rotina | Nome, tipo, horário, dias da semana, lista ordenável de itens |
| 11 | Despertador | Lista de alarmes com toggle · próximo toque · notificações neste aparelho · atalho para o histórico |
| 12 | Editar alarme (bottom sheet) | Horário, nome, dias, som com prévia (3 sons sintetizados), segurar 3 s obrigatório, sonecas (quantidade e duração), excluir |
| 13 | **Alarme tocando** (tela cheia, rota `/alarme`) | Horário grande, som em loop com volume crescente, Wake Lock, silenciar, **segurar 3 s para "Levantei"**, soneca com contagem regressiva; estados: tocando · soneca · perdido · confirmado · ocioso |
| 14 | Histórico de acordar | 30 dias: levantou × perdidos × atraso médio; lista por dia com planejado → levantou, sonecas e status |

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
| 19 | Treinos | Planos com dias da semana · treino de hoje em destaque |
| 20 | Editar plano | Nome, dias, lista ordenável de exercícios (séries, reps, carga, descanso) |
| 21 | **Sessão de treino** | Exercícios com check, cronômetro de descanso, botão Concluir / Pular |
| 22 | Histórico de treinos | Calendário do mês com dias treinados |

### Evolução
| # | Tela | Conteúdo |
|---|---|---|
| 23 | **Evolução** | Sequência atual e recorde · disciplina média 7/30 dias · mapa de calor do mês · barras por área (rotina, tarefas, treino, metas, acordar) |
| 24 | Detalhe do dia (a partir do mapa) | Fotografia daquele dia: o que foi planejado e cumprido |

### Perfil
| # | Tela | Conteúdo |
|---|---|---|
| 25 | Configurações | Nome, fuso, meta de disciplina, notificações, sons, dispositivos conectados, versão do app, sair |
| 26 | Lixeira | Itens excluídos nos últimos 30 dias, restaurar |

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
- **Offline**: Hoje abre com o último estado em cache; checks feitos offline são enviados ao reconectar (fila local).
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
