# 01 · Visão de Produto

> Documento vivo. Toda mudança de escopo passa por aqui antes de virar código.

## O problema

Apps de tarefas organizam *o que fazer*; não constroem disciplina. A pessoa instala, usa três dias e abandona porque:

- não existe estrutura de dia (acordar → manhã → execução → noite), só uma lista solta;
- não existe prova nem consequência: ninguém sabe se ela levantou às 6h ou às 9h;
- o progresso é invisível: metas grandes sem passos pequenos e sem feedback diário.

## Proposta de valor

**O sistema operacional da disciplina pessoal.** Um único lugar que monta o seu dia (rotina, tarefas, treino, ações das metas), cobra execução (despertador com confirmação de que levantou) e devolve um número honesto todo dia: o **percentual de disciplina** e a **sequência de dias cumpridos**.

## Persona primária

- 22 a 40 anos, quer melhorar disciplina, saúde e produtividade.
- Já tentou Notion, Todoist ou Habitica: achou complexo demais ou infantil.
- Usa o celular como ferramenta principal. Abre o app de manhã e à noite, 2 a 5 minutos por vez.
- Valoriza estética premium: se parece amador, desinstala.

Fase 1: um único usuário (o fundador). O produto é desenhado para milhares desde o início, mas validado com um.

## Princípios de produto

1. **O dia é a unidade central.** Tudo se organiza em torno da tela "Hoje".
2. **Menos telas, mais execução.** Cada tela tem uma ação primária óbvia.
3. **Número honesto.** O percentual é calculado, nunca inflado. Sem medalhas infantis; a recompensa é o próprio histórico.
4. **Atrito zero para marcar feito; atrito proposital para pular.** Confirmar que acordou exige segurar um botão por 3 segundos.
5. **Multiusuário desde o dia 1.** Dados isolados por usuário, fuso horário por usuário, nenhuma regra "só funciona para mim".

## Core loop (o ciclo que o produto precisa fechar)

```
Noite anterior   → rotina da noite → fecha o dia (score) → alarme de amanhã ativo
Manhã            → alarme toca → confirma que levantou → rotina da manhã
Dia              → tarefas · treino do dia · ações das metas
Noite            → rotina da noite → fecha o dia → score + sequência
```

Se o usuário completar esse ciclo por 7 dias seguidos, o produto cumpriu a promessa.

## Métricas

| Tipo | Métrica | Por quê |
|---|---|---|
| North star | Dias com disciplina ≥ meta (padrão 80%) por usuário/semana | Mede a transformação, não o uso |
| Ativação | Concluiu o setup inicial **e** fechou o primeiro dia | Prova que entendeu o loop |
| Retenção | Sequência de 7 dias; D7 e D30 | Hábito formado |
| Saúde | % de dias com "acordei" confirmado | O diferencial está funcionando |

## Escopo do MVP

Os seis módulos definidos: **Rotina diária, Despertador inteligente, Metas, Treinos, Tarefas, Sistema de evolução.**

Fora do MVP (não construir sem aprovação explícita): social/comunidade, coach por IA, integrações (Google Calendar, Apple Health, Strava), pagamentos e planos, painel administrativo, app nativo.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| PWA não toca alarme com app fechado como um alarme nativo | Push no horário + tela de alarme em tela cheia com som em loop quando o app está aberto na cabeceira (Wake Lock). Onboarding recomenda manter o alarme nativo como backup e usar o app para **confirmar** que levantou. |
| iOS só recebe push se o app estiver instalado na tela inicial | Onboarding guia a instalação; o app detecta e avisa quando não está instalado. |
| Score parecer punitivo e gerar abandono | Meta de disciplina configurável, linguagem neutra, foco em tendência semanal e não em um dia ruim. |
| Escopo crescer e o MVP não sair | Roadmap por fases, uma funcionalidade por vez, aprovação explícita para qualquer extra. |
| Fuso horário quebrar sequências e alarmes | Todo instante salvo em UTC; o "dia" é sempre calculado no fuso do usuário. |
