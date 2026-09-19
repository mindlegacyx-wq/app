# 03 · Banco de Dados

PostgreSQL 16. Convenções válidas para todas as tabelas:

- `id UUID` (v7) como chave primária.
- `created_at`, `updated_at` em `timestamptz` (UTC).
- `deleted_at timestamptz NULL` (soft delete) nas entidades criadas pelo usuário.
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
       ├─ task_categories ── tasks
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
| wake_time | time NULL | informado no setup; a Fase 6 cria o alarme a partir dele |
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

### `push_subscriptions`
| Coluna | Tipo |
|---|---|
| id | uuid PK |
| user_id | uuid FK |
| endpoint | text UNIQUE |
| p256dh | text |
| auth | text |
| user_agent | text |
| created_at / last_used_at | timestamptz |

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

### `alarms`
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| label | varchar(40) | "Acordar" |
| time | time | no fuso do usuário |
| days_of_week | smallint[] | |
| sound | varchar(40) | chave do arquivo de som |
| requires_confirmation | bool | padrão true |
| max_snoozes | smallint | padrão 1 |
| snooze_minutes | smallint | padrão 5 |
| is_active | bool | |
| created_at / updated_at / deleted_at | | |

### `wake_logs` (registro de que levantou)
| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| alarm_id | uuid FK NULL | NULL quando confirmou manualmente sem alarme. **Coluna entra na Fase 6**, junto com a tabela `alarms`. |
| date | date | |
| scheduled_at | timestamptz NULL | horário planejado |
| rang_at | timestamptz NULL | primeiro disparo |
| confirmed_at | timestamptz NULL | **horário que levantou** |
| snooze_count | smallint | |
| status | enum(`pending`,`confirmed`,`missed`,`manual`) | |
| UNIQUE (user_id, date) | | um registro de acordar por dia |

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

Progresso da meta = ações concluídas ÷ total de ações (calculado, não armazenado).

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
| title | varchar(140) | |
| notes | text NULL | |
| date | date | dia em que está planejada |
| priority | enum(`low`,`medium`,`high`) | |
| status | enum(`pending`,`done`,`cancelled`) | |
| completed_at | timestamptz NULL | |
| sort_order | int | |
| created_at / updated_at / deleted_at | | |
| INDEX (user_id, date, status) | | |

Regras:

- **Atrasada** = pendente com `date` anterior ao dia consultado. Aparece em Hoje num grupo próprio e não conta no planejado do dia até ser movida.
- **Crédito da conclusão**: concluir uma tarefa planejada para hoje ou ontem mantém a data; planejada para dias anteriores ou futuros, a data passa a ser hoje (o dia em que o trabalho aconteceu).
- **Cancelada** sai do planejado sem apagar o registro; **excluída** vai para a lixeira (soft delete).

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

---

## Índices e integridade (resumo)

- Toda tabela de domínio: `INDEX (user_id)`; tabelas de registro: `INDEX (user_id, date)`.
- Constraints `UNIQUE` acima impedem duplicidade de registro no mesmo dia (idempotência ao marcar/desmarcar).
- FKs com `ON DELETE CASCADE` de filho para pai dentro do mesmo módulo; entre módulos, `SET NULL`.
- Todas as migrações via Alembic, versionadas no repositório.
