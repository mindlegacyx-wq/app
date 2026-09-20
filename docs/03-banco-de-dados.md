# 03 · Banco de Dados

PostgreSQL 16. Convenções válidas para todas as tabelas:

- `id UUID` (v7) como chave primária.
- `created_at`, `updated_at` em `timestamptz` (UTC).
- `deleted_at timestamptz NULL` (soft delete) nas entidades criadas pelo usuário. A lixeira (Fase 8) lista o que foi excluído nos últimos 30 dias e permite restaurar; um job diário apaga em definitivo o que passou do prazo, **exceto** o que tem histórico ligado (treino com sessões, item de rotina com checks), que fica apenas oculto para o passado continuar íntegro.
- `user_id` em toda tabela de domínio, com FK para `users` e índice.
- `date` nas tabelas de registro = **dia no fuso do usuário**, tipo `date`.
- `days_of_week smallint[]` usa 0 = segunda … 6 = domingo.

## Diagrama (visão geral)

```
users ─┬─ user_settings (1:1)
       ├─ sessions
       ├─ push_subscriptions
       │
       ├─ routines ──── routine_items ──── routine_item_logs
       ├─ alarms ─────────────────────────── wake_logs
       ├─ goals ─────── goal_actions
       ├─ workouts ──── workout_exercises
       │      └────── workout_sessions ─── workout_session_exercises
       ├─ task_categories ── tasks ─── task_recurrences
       └─ daily_scores
```

---

## Núcleo (auth, users)

### `users`
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| email | citext UNIQUE | |
| password_hash | text | Argon2id |
| name | varchar(80) | |
| timezone | varchar(64) | IANA, padrão `America/Sao_Paulo` |
| is_active | bool | |
| email_verified_at | timestamptz NULL | verificação fica para pós-MVP, coluna já existe |
| created_at / updated_at | timestamptz | |

### `user_settings` (1:1 com users)
| Coluna | Tipo | Obs |
|---|---|---|
| user_id | uuid PK/FK | |
| discipline_target | smallint | padrão 80 (%) |
| week_starts_on | smallint | 0 = segunda |
| notifications_enabled | bool | |
| wake_time | time NULL | informado no setup; o setup cria o alarme "Acordar" a partir dele. Só vale como horário planejado de acordar para quem não tem nenhum alarme |
| onboarding_completed_at | timestamptz NULL | |

### `sessions` (refresh tokens)
| Coluna | Tipo |
|---|---|
| id | uuid PK |
| user_id | uuid FK |
| token_hash | text UNIQUE |
| user_agent | text |
| ip | inet |
| expires_at | timestamptz |
| revoked_at | timestamptz NULL |
| created_at | timestamptz |

### `push_subscriptions` (Fase 6)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| endpoint | text UNIQUE | mesmo endpoint em outra conta → a assinatura muda de dono |
| p256dh | text | |
| auth | text | |
| user_agent | text | |
| created_at / last_used_at | timestamptz | `last_used_at` atualiza a cada push enviado |

Assinaturas mortas (404/410 do serviço de push) são apagadas pelo job de alarmes.

---

## Módulo 1 · Rotinas

### `routines`
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| name | varchar(60) | "Manhã", "Noite", "Foco" |
| kind | enum(`morning`,`evening`,`custom`) | manhã e noite têm papel especial na tela Hoje |
| start_time | time NULL | horário sugerido de início |
| days_of_week | smallint[] | |
| is_active | bool | |
| sort_order | int | |
| created_at / updated_at / deleted_at | | |

### `routine_items`
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| routine_id | uuid FK | |
| title | varchar(80) | "Beber água", "Ler 10 páginas" |
| duration_minutes | smallint NULL | |
| sort_order | int | |
| is_active | bool | |
| created_at / updated_at / deleted_at | | |

### `routine_item_logs` (checklist diário)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| routine_item_id | uuid FK | |
| date | date | dia no fuso do usuário |
| completed_at | timestamptz | |
| UNIQUE (routine_item_id, date) | | um check por item por dia |
| INDEX (user_id, date) | | |

---

## Módulo 2 · Despertador

### `alarms` (Fase 6)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| label | varchar(40) | "Acordar" |
| time | time | no fuso do usuário, minuto cheio (segundos descartados) |
| days_of_week | smallint[] | |
| sound | varchar(40) | `classic` · `soft` · `pulse` — sintetizados no app (Web Audio), sem arquivo |
| sound_file_id | uuid FK NULL | áudio do usuário (`alarm_sounds`); quando presente, vence o som pronto (`ON DELETE SET NULL`) |
| insist | bool | padrão true: repete a notificação a cada minuto até confirmar |
| requires_confirmation | bool | padrão true: segurar 3 s para desligar; false: um toque |
| max_snoozes | smallint | padrão 1 (0 a 5) |
| snooze_minutes | smallint | padrão 5 (1 a 30) |
| is_active | bool | |
| created_at / updated_at / deleted_at | | |
| INDEX (user_id, time) | | |

Regras: o **acordar planejado** de um dia é o primeiro alarme ativo daquele dia da semana; quem não tem nenhum alarme cai no `user_settings.wake_time`. O setup cria o alarme "Acordar" no horário informado (decisão 4 do fundador).

### `alarm_sounds` (Fase 19)

O áudio que o usuário subiu para usar como alarme.

| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| name | varchar(60) | nome do arquivo, sem a extensão |
| content_type | varchar(40) | mp3, m4a, aac, ogg, wav ou webm |
| size_bytes | int | até 5 MB |
| data | bytea | o arquivo |
| created_at / updated_at | | |
| INDEX (user_id, created_at) | | |

Por que no banco e não em disco: no plano gratuito do Render o disco some a cada publicação. São poucos megabytes (até 5 arquivos por usuário) e assim o som acompanha o usuário em qualquer aparelho. O arquivo é servido em `GET /alarms/sounds/{id}/file` com cache imutável e guardado no Cache Storage do aparelho na primeira vez — despertador não pode depender de internet às 6 da manhã. Excluir o áudio devolve o alarme ao som pronto (nunca fica mudo).

### `wake_logs` (registro de que levantou)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| alarm_id | uuid FK NULL | alarme que tocou; NULL quando confirmou manualmente sem alarme (`ON DELETE SET NULL`) |
| date | date | |
| scheduled_at | timestamptz NULL | horário planejado |
| rang_at | timestamptz NULL | primeiro disparo |
| next_ring_at | timestamptz NULL | próximo toque depois de uma soneca; NULL sem toque pendente. **Acrescentada na Fase 6**: sem ela o servidor não sabe quando reenviar o push da soneca com o app fechado |
| confirmed_at | timestamptz NULL | **horário que levantou** |
| snooze_count | smallint | |
| last_push_at | timestamptz NULL | último envio deste toque; segura a insistência em uma notificação por minuto |
| status | enum(`pending`,`confirmed`,`missed`,`manual`) | |
| UNIQUE (user_id, date) | | um registro de acordar por dia |
| INDEX (status, next_ring_at) | | o job procura pendentes com toque previsto |

Ciclo: o disparo (job por minuto ou `POST /wake/ring` do app aberto) cria o registro `pending` com `rang_at`; enquanto ficar pendente e `insist` estiver ligado, o job reenvia a notificação a cada `ALARM_REPEAT_SECONDS` (60); soneca incrementa `snooze_count` e marca `next_ring_at`; confirmar a partir do alarme → `confirmed`; sem confirmação em `ALARM_MISSED_MINUTES` (60) após `rang_at` → `missed`; perdido confirmado depois → `manual`. O "Levantei" manual do dia D só é aceito a partir do corte de fechamento (03:00) de D.

---

## Módulo 3 · Metas

### `goals`
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| title | varchar(100) | |
| description | text NULL | |
| area | enum(`health`,`career`,`finance`,`study`,`personal`,`other`) | |
| deadline | date NULL | |
| status | enum(`active`,`completed`,`archived`) | |
| completed_at | timestamptz NULL | |
| created_at / updated_at / deleted_at | | |

### `goal_actions` (pequenas ações)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| goal_id | uuid FK | |
| user_id | uuid FK | redundante de propósito: acelera consultas por dia |
| title | varchar(120) | |
| due_date | date NULL | quando definida, entra no dia e no score |
| is_done | bool | |
| done_at | timestamptz NULL | |
| sort_order | int | |
| created_at / updated_at / deleted_at | | |
| INDEX (user_id, due_date) | | |

Regras:

- **Progresso da meta** = ações concluídas ÷ total de ações (calculado, não armazenado).
- Só ações de metas **ativas** entram no dia e no percentual. Ação com data conta no dia planejado; sem data, conta só no progresso da meta.
- **Atrasada** = ação pendente com `due_date` anterior ao dia. Aparece em Hoje num grupo próprio; não conta no planejado até ser movida.
- **Crédito da conclusão** = mesma regra das tarefas: dia planejado ainda aberto mantém a data; fechado, futuro ou sem data, passa para hoje.
- Concluir a meta guarda `completed_at`; ações pendentes ficam como estão e deixam de contar no dia.

---

## Módulo 4 · Treinos

### `workouts` (planos)
| Coluna | Tipo |
|---|---|
| id | uuid PK |
| user_id | uuid FK |
| name | varchar(60) |
| days_of_week | smallint[] |
| notes | text NULL |
| is_active | bool |
| created_at / updated_at / deleted_at | |

### `workout_exercises`
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| workout_id | uuid FK | |
| name | varchar(80) | |
| sets | smallint NULL | |
| reps | varchar(20) NULL | "12" ou "8-10" ou "30s" |
| load | varchar(20) NULL | "20kg", "corporal" |
| rest_seconds | smallint NULL | |
| sort_order | int | |
| created_at / updated_at / deleted_at | | |

### `workout_sessions` (registro de conclusão)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| workout_id | uuid FK | |
| date | date | |
| started_at / completed_at | timestamptz NULL | |
| status | enum(`in_progress`,`completed`,`skipped`) | |
| notes | text NULL | |
| UNIQUE (workout_id, date) | | |
| INDEX (user_id, date) | | |

### `workout_session_exercises`
| Coluna | Tipo |
|---|---|
| session_id | uuid FK |
| exercise_id | uuid FK |
| completed | bool |
| PK (session_id, exercise_id) | |

Regras:

- Um plano **ativo, com pelo menos um exercício e com o dia da semana marcado** está planejado no dia. Cada plano conta como **1** no percentual (não cada exercício).
- A sessão nasce ao iniciar o treino ou marcar o primeiro exercício; uma por plano por dia. **Concluído** = sessão `completed`.
- **Pular** registra a decisão (Hoje deixa de cobrar) mas continua contando como planejado e não feito; aparece como "(pulado)" no que ficou de fora.
- Marcar um exercício depois de pular/concluir reabre a sessão (`in_progress`).
- Sessões só em dia aberto (hoje, ou ontem antes do corte). `workout_session_exercises` guarda também `completed_at`.

---

## Módulo 5 · Tarefas

### `task_categories`
| Coluna | Tipo |
|---|---|
| id | uuid PK |
| user_id | uuid FK |
| name | varchar(40) |
| color | varchar(7) |
| sort_order | int |
| created_at / updated_at / deleted_at | |

### `tasks`
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| category_id | uuid FK NULL | |
| recurrence_id | uuid FK NULL | veio de uma tarefa fixa (`task_recurrences`) |
| title | varchar(140) | |
| notes | text NULL | |
| date | date | dia em que está planejada |
| priority | enum(`low`,`medium`,`high`) | |
| status | enum(`pending`,`done`,`cancelled`) | |
| completed_at | timestamptz NULL | |
| sort_order | int | |
| created_at / updated_at / deleted_at | | |
| INDEX (user_id, date, status) | | |
| UNIQUE (recurrence_id, date) | | uma tarefa por regra por dia |

Regras:

- **Atrasada** = pendente com `date` anterior ao dia consultado. Aparece em Hoje num grupo próprio e não conta no planejado do dia até ser movida.
- **Crédito da conclusão**: concluir uma tarefa planejada para hoje ou ontem mantém a data; planejada para dias anteriores ou futuros, a data passa a ser hoje (o dia em que o trabalho aconteceu).
- **Cancelada** sai do planejado sem apagar o registro; **excluída** vai para a lixeira (soft delete).
- **Tarefa fixa não vira atrasada**: ela contou (ou não) no dia dela e recomeça no dia seguinte. Água não bebida ontem não se acumula em hoje.

### `task_recurrences`

A **regra** da tarefa fixa ("beber 3 L de água, de segunda a sexta"), não a tarefa de um dia.

| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| category_id | uuid FK NULL | |
| title | varchar(140) | |
| notes | text NULL | |
| days_of_week | smallint[] | 0 = segunda … 6 = domingo |
| priority | enum(`low`,`medium`,`high`) | |
| start_date | date | o dia em que a regra foi criada |
| is_active | bool | pausada não gera tarefa |
| sort_order | int | |
| created_at / updated_at / deleted_at | | |

Regras:

- A tarefa de cada dia continua sendo uma linha em `tasks`, criada sob demanda (`ensure_recurring`) quando o dia é consultado. Assim o percentual do dia, a lixeira e a ordenação funcionam sem saber que a tarefa é fixa.
- **Nunca gera para trás**: só a partir de `start_date` e só em dia **aberto ou futuro**. Um dia que já fechou fica exatamente como foi vivido.
- Mudar a regra atualiza as tarefas **pendentes de hoje em diante**; as já concluídas e as dos dias anteriores ficam como estão.
- Pausar ou desmarcar um dia tira a tarefa pendente daquele dia; religar devolve **a mesma linha** (`UNIQUE (recurrence_id, date)`).

---

## Módulo 6 · Evolução

### `daily_scores` (fotografia de um dia fechado)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| date | date | |
| planned_count | smallint | itens que contavam naquele dia |
| completed_count | smallint | |
| discipline_pct | smallint | 0 a 100 |
| target_pct | smallint | meta vigente no dia (a meta do usuário pode mudar depois) |
| hit_target | bool | planejado > 0 e pct ≥ meta |
| streak_day | int | sequência contando este dia; 0 quando não bateu |
| breakdown | jsonb | `{wake:{planned,completed}, routines:{…}, tasks:{…}, workout:{…}, goals:{…}, missing:[{kind,title}]}` |
| closed_at | timestamptz | |
| closed_by | enum(`user`,`system`) | `user` = botão "Fechar o dia"; `system` = job |
| finalized_at | timestamptz NULL | preenchido pelo job; a partir daí o dia é imutável |
| UNIQUE (user_id, date) | | |

Ciclo de vida de um dia:

- **Aberto**: sem linha; o percentual é calculado ao vivo a partir dos serviços dos módulos.
- **Fechado pelo usuário**: linha com `closed_by = user`. Congela o número; pode ser reaberto (linha apagada) até o corte.
- **Finalizado**: o job das 03:00 (fuso do usuário) cria a linha de quem não fechou (`system`) ou preenche `finalized_at` de quem fechou. Imutável. O job também preenche dias que ficaram para trás (autocura), e qualquer leitura de `/progress/day` faz o mesmo.

Regras de cálculo:

- **Planejado no dia** = itens de rotinas ativas cujo `days_of_week` inclui o dia + tarefas com `date` = dia (exceto canceladas) + 1 treino se há plano ativo para o dia (Fase 5) + ações de metas com `due_date` = dia (Fase 4) + 1 "acordar" se há horário de acordar configurado.
- **Concluído** = os mesmos itens com registro de conclusão.
- **Disciplina** = concluído ÷ planejado × 100. Peso igual para todos no MVP; a coluna `breakdown` permite ponderar depois sem migrar dados.
- **Sequência** = dias consecutivos com `hit_target = true`. **Dia sem nada planejado conta como 0% e quebra a sequência** (decisão do fundador: sem plano, sem disciplina).
- **Janela de registro**: um dia D aceita checks, tarefas e "Levantei" até as **03:00 de D+1** no fuso do usuário (quem fecha a rotina da noite depois da meia-noite). Nunca para o futuro. O corte é configurável (`DAY_CLOSE_HOUR`).
- **Evolução (Fase 7)** é leitura sobre esta tabela: `/progress/history?start&end` devolve um item por dia (dias finalizados vêm daqui; hoje, e ontem antes do corte, são calculados ao vivo e marcados `live`); `/progress/summary` calcula sequência atual, recorde (`MAX(streak_day)`), médias de 7 e 30 dias e barras por área somando `breakdown` dos dias fechados — **sem o dia de hoje** e só a partir do dia em que a conta foi criada.

---

## Módulo 7 · Agenda semanal (Fase 9)

### `subjects` (matérias)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| name | varchar(60) | |
| color | varchar(7) | `#RRGGBB`, paleta fixa de 8 cores |
| teacher | varchar(60) NULL | |
| is_active | bool | arquivada some das opções, mantém aulas e notas |
| sort_order | smallint | |
| created_at · updated_at · deleted_at | timestamptz | soft delete (lixeira) |

### `schedule_blocks` (blocos fixos por dia da semana)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| title | varchar(60) | |
| kind | enum | `class` · `workout` · `study` · `other` |
| subject_id | uuid FK NULL | `SET NULL`; só para `class` |
| workout_id | uuid FK NULL | `SET NULL` (outro módulo); só para `workout` |
| weekday | smallint | 0 = segunda … 6 = domingo |
| start_time · end_time | time | fim > início; sem sobreposição no mesmo dia (encostado é permitido) |
| location | varchar(60) NULL | |
| is_active | bool | pausado não ocupa horário |
| created_at · updated_at · deleted_at | timestamptz | soft delete (lixeira) |

`INDEX (user_id, weekday, start_time)`. Criar em vários dias gera **um registro por dia** (cada dia pode ter horário diferente depois). Não há tabela de "ocorrências": o dia é calculado a partir de `weekday`.

## Módulo 8 · Provas e estudos (Fase 10)

### `exams` (provas e trabalhos)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| subject_id | uuid FK NULL | `SET NULL` |
| title | varchar(80) | |
| kind | enum | `exam` · `assignment` |
| date | date | dia da prova / entrega |
| lead_days | smallint | 1–60; começa a cobrar X dias antes (padrão 7) |
| minutes_per_day | smallint | 10–240 (padrão 30) |
| notes | text NULL | |
| status | enum | `open` · `done` (feita/entregue: para de cobrar) |
| done_at | timestamptz NULL | |
| created_at · updated_at · deleted_at | timestamptz | soft delete (lixeira; com sessões nunca é apagada em definitivo) |

`INDEX (user_id, date)`.

### `exam_topics` (conteúdos)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| exam_id | uuid FK | `CASCADE` |
| title | varchar(120) | |
| is_done | bool | |
| sort_order | int | |

### `study_sessions` (registro de uma sessão num dia)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| exam_id | uuid FK | `CASCADE` |
| date | date | |
| status | enum | `in_progress` · `completed` · `skipped` (pendente = sem linha) |
| planned_minutes | smallint | copiado da prova ao criar (histórico fiel) |
| focused_seconds | int | tempo do cronômetro de foco |
| started_at · completed_at | timestamptz NULL | |

`UNIQUE (exam_id, date)` · `INDEX (user_id, date)`. O planejado do dia vem da definição das provas (janela), não desta tabela — por isso mudar a data da prova não "apaga" sessões: só muda quais dias cobram dali em diante.

## Módulo 9 · Notas (Fase 11)

`user_settings` ganhou `passing_grade numeric(4,2)` (padrão 6), `periods_per_year smallint` (padrão 3) e `grade_max numeric(5,2)` (padrão 10).

### `grades`
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| subject_id | uuid FK | `CASCADE` (nota sem matéria não faz sentido) |
| exam_id | uuid FK NULL | `SET NULL`; nota lançada a partir de uma prova |
| year | smallint | |
| period | smallint | 1..`periods_per_year` |
| title | varchar(60) NULL | "Prova 1", "Trabalho"… |
| value | numeric(5,2) | 0..`grade_max` |
| weight | numeric(4,2) | padrão 1 |
| created_at · updated_at | timestamptz | sem soft delete (excluir pede confirmação) |

`INDEX (user_id, year, subject_id)`. Médias e "quanto preciso tirar" são calculados na leitura (`/grades?year=`), nunca gravados.

## Módulo 10 · Estudos com IA (Fase 12)

### `study_materials`
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id · exam_id | uuid FK | `CASCADE` |
| title | varchar(80) NULL | |
| source | enum | `photo` (transcrito) · `text` (colado) |
| content | text | até 40 mil caracteres; **só texto — fotos não são guardadas** |
| created_at · updated_at | timestamptz | |

### `study_artifacts`
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id · exam_id | uuid FK | `CASCADE` |
| kind | enum | `theory` · `solutions` · `mindmap` · `quiz` |
| status | enum | `queued` · `running` · `done` · `failed` |
| content_md | text NULL | teoria e resoluções (Markdown) |
| content_json | jsonb NULL | mapa mental (árvore) e quiz (questões) validados |
| error | varchar(300) NULL | mensagem amigável quando falha |
| model | varchar(80) NULL | modelo que gerou |
| input_hash | varchar(64) NULL | sha-256 dos materiais usados → `stale` quando muda |
| finished_at | timestamptz NULL | |

`UNIQUE (exam_id, kind)`: um artefato por tipo; regenerar substitui.

## Índices e integridade (resumo)

- Toda tabela de domínio: `INDEX (user_id)`; tabelas de registro: `INDEX (user_id, date)`.
- Constraints `UNIQUE` acima impedem duplicidade de registro no mesmo dia (idempotência ao marcar/desmarcar).
- FKs com `ON DELETE CASCADE` de filho para pai dentro do mesmo módulo; entre módulos, `SET NULL`.
- Todas as migrações via Alembic, versionadas no repositório.
