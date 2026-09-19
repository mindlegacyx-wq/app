# Publicar o Disciplina de graça (sem cartão)

Resultado: um endereço `https://…onrender.com` sempre no ar, que você instala no celular e no PC como
app, com despertador, offline e tudo. **Não depende do seu computador ligado** e **não pede cartão**
em nenhum dos serviços.

| Peça                | Serviço                              | Plano                                                             |
| ------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| App (API + telas)   | **Render** (render.com)              | Web Service Free · 512 MB · 750 h/mês                             |
| Banco de dados      | **Aiven** (aiven.io)                 | PostgreSQL Free · 1 GB · sem prazo de validade                    |
| Manter acordado     | **cron-job.org** (ou UptimeRobot)    | Free · chama o app a cada 10 min para ele não "dormir"            |
| IA dos estudos      | **Groq** (console.groq.com) opcional | Free                                                              |

Tempo total: uns **30 minutos**, a maior parte esperando a primeira publicação.

> Tudo isso é plano gratuito de empresa — pode mudar de regra um dia. Se acontecer, o app não se
> perde: é o mesmo código, só troca de casa (ver "Se um dia precisar mudar", no fim).

---

## Passo 1 — Banco de dados na Aiven (5 min)

1. Entre em **https://console.aiven.io** e crie a conta (dá para entrar com Google ou GitHub). Não pede cartão.
2. Clique em **Create service**.
3. Escolha **PostgreSQL**.
4. Em **Service plan**, escolha **Free**.
5. Em **Cloud / Region**, escolha uma região dos **Estados Unidos, leste** (algo como `us-east`), se aparecer. É onde o Render também vai ficar — quanto mais perto um do outro, mais rápido o app.
6. Em **Service name**, escreva `disciplina`. Clique em **Create service**.
7. Espere o status mudar de *Rebuilding* para **Running** (1 a 3 minutos).
8. Na aba **Overview**, em **Connection information**, copie a **Service URI**. Ela tem este formato:

   ```
   postgres://avnadmin:SENHA@disciplina-xxxx.aivencloud.com:12345/defaultdb?sslmode=require
   ```

   Guarde num bloco de notas — vai usar no Passo 3. **Não** mande essa linha para ninguém: ela é a chave do seu banco.

---

## Passo 2 — Código no GitHub (2 min)

O Render lê o app direto do seu repositório `app` no GitHub.

1. Extraia o ZIP novo numa pasta limpa.
2. No **GitHub Desktop**: **File → Add local repository** → escolha a pasta → **Push origin**.
3. Confira em github.com que apareceram os arquivos `Dockerfile`, `render.yaml` e `PUBLICAR-DE-GRACA.md` na raiz do repositório.

---

## Passo 3 — Publicar no Render (10 min, quase tudo espera)

1. Entre em **https://dashboard.render.com** e crie a conta **com o GitHub** (botão *GitHub*). Não pede cartão.
2. No topo, clique em **New +** → **Blueprint**.
3. Conecte a sua conta do GitHub, se ele pedir, e escolha o repositório **app**. Clique em **Connect**.
4. O Render lê o `render.yaml` e mostra o serviço **disciplina** (plano *Free*). Ele pede dois valores:
   - **DATABASE_URL** → cole a *Service URI* da Aiven (Passo 1).
   - **SIGNUP_INVITE_CODE** → invente um código, tipo `kayo-2026`. É a "senha" para poder **criar conta** no seu app. Só quem souber o código consegue se cadastrar. Anote.
5. Clique em **Apply** (ou *Deploy Blueprint*).
6. Abra o serviço **disciplina** e acompanhe a aba **Logs**. A primeira publicação demora **5 a 10 minutos** (ele compila o app e instala tudo). Termina quando aparecer:

   ```
   [api] aplicando migrações...
   [api] iniciando uvicorn na porta 10000 com 1 worker(s)   (o número da porta pode variar)
   Application startup complete.
   ```

   e, no topo da página, o status **Live**.
7. O endereço do app aparece no topo, tipo **https://disciplina.onrender.com** (se o nome já estiver em uso, o Render acrescenta um sufixo, ex.: `disciplina-a1b2.onrender.com`). Abra-o.

Deu erro? Veja "Se der errado", no fim.

---

## Passo 4 — Criar a sua conta (1 min)

1. No endereço do app, toque em **Criar conta**.
2. Preencha nome, e-mail, senha e o **Código de convite** (o que você inventou no Passo 3).
3. Faça o setup inicial (horário de acordar, meta). Pronto — é o seu app, no ar.

Para a **segunda pessoa** usar: mande o endereço e o código de convite. Cada conta só vê os próprios dados. Para fechar o cadastro depois, é só trocar o código no Render (Passo 7).

---

## Passo 5 — Instalar no celular e no PC (2 min)

- **Android (Chrome)**: abra o endereço → menu **⋮** → **Instalar app** (ou *Adicionar à tela inicial*).
- **iPhone (Safari)**: botão **Compartilhar** → **Adicionar à Tela de Início**.
- **PC (Chrome/Edge)**: ícone de **instalar** no fim da barra de endereço (um monitor com seta).

Depois de instalado, na tela **Hoje** ative as notificações quando o app pedir — é o que faz o despertador tocar com o app fechado (precisa do Passo 7b feito).

---

## Passo 6 — Não deixar o app dormir (3 min)

No plano gratuito, o Render **desliga o app depois de 15 minutos sem ninguém acessar** e religa no próximo acesso (demora ~1 minuto e o despertador daquele minuto não tocaria). Um "cutucão" a cada 10 minutos resolve:

1. Entre em **https://cron-job.org** e crie a conta (gratuita).
2. **Create cronjob**:
   - **Title**: `disciplina acordado`
   - **URL**: `https://SEU-ENDERECO.onrender.com/api/v1/health` (troque pelo seu)
   - **Execution schedule**: **Every 10 minutes**
3. **Create**. Em alguns minutos o histórico mostra respostas **200 OK**.

Alternativa: **UptimeRobot** (uptimerobot.com), monitor *HTTP(s)* nessa mesma URL, intervalo de 5 minutos. Também avisa por e-mail se o app cair.

Conta importante: acordado 24 h por dia, o app usa ~744 das **750 horas gratuitas por mês** do Render. Cabe, mas por isso **só este serviço** deve existir na sua conta do Render.

---

## Passo 7 — Opcionais (mas valem a pena)

### 7a. IA para estudos (Groq, grátis)

1. **https://console.groq.com** → **API Keys** → **Create API Key** → copie.
2. No Render, abra o serviço → aba **Environment** → **Add Environment Variable**:
   `AI_API_KEY` = a chave. **Save Changes** (o app reinicia sozinho em ~1 min).
3. A seção **Estudar com IA** dentro de cada prova fica ativa.

### 7b. Despertador com o app fechado (Web Push)

Precisa de um par de chaves gerado uma vez só. No seu PC, na pasta do app, com o Docker Desktop aberto:

```bash
docker compose -f docker-compose.dev.yml run --rm api python -m app.core.push
```

Ele imprime duas linhas, `VAPID_PUBLIC_KEY=...` e `VAPID_PRIVATE_KEY=...`. No Render → **Environment**, adicione as duas (nome de um lado, valor do outro) e também `VAPID_SUBJECT` = `mailto:seu@email.com`. **Save Changes**.

Depois, no app, ative as notificações na tela **Hoje** (se já tinha ativado antes, desative e ative de novo). **Nunca troque** essas chaves depois: trocar desliga as notificações de todo mundo até reativarem.

### 7c. Trocar ou fechar o código de convite

Render → **Environment** → edite `SIGNUP_INVITE_CODE` → **Save Changes**. Quem já tem conta continua entrando normalmente; só o *criar conta* pede o novo código.

---

## Como fica o dia a dia

- **Atualizar o app** (versão nova): extraia o ZIP novo por cima da pasta → GitHub Desktop → **Push origin**. O Render percebe e publica sozinho (5 a 8 min). Nesse meio tempo o app pode ficar ~1 min fora do ar.
- **Offline**: o app abre sem internet e mostra o que já carregou; marcar e desmarcar (itens da rotina, tarefas, ações de meta, exercícios) funciona e sincroniza quando a conexão volta. Criar ou editar coisas precisa de internet.
- **Cópia de segurança do banco** (de vez em quando, no PC com Docker):

  ```bash
  docker run --rm postgres:alpine pg_dump "COLE-AQUI-A-SERVICE-URI" > backup-disciplina.sql
  ```

  A Aiven também guarda backups automáticos.
- **E-mail da Aiven falando em "power off" por inatividade**: acontece só se o app ficar dias sem uso e sem o cutucão do Passo 6. Basta entrar no console e clicar em **Power on**.

## Limites do gratuito (para saber)

- **Render Free**: 512 MB de RAM, 1 app "acordado" por vez (as 750 h/mês), sem shell no painel, publicação sem "zero downtime" (~1 min fora do ar a cada atualização). Mais que suficiente para 1 ou 2 pessoas.
- **Aiven Free**: 1 GB de banco (anos de uso pessoal — cada dia de rotina ocupa poucos KB) e 20 conexões (o app usa no máximo 6).
- **Groq Free**: cota diária de mensagens; se estourar, a tela mostra "limite atingido" e volta no dia seguinte.

## Se der errado

- **Logs mostram `connection refused` / `password authentication failed`**: a `DATABASE_URL` está errada. Copie de novo a *Service URI* na Aiven (aba Overview) e cole em **Environment** → `DATABASE_URL` → Save.
- **`SSL required` ou `ssl` nos logs**: a URI precisa terminar com `?sslmode=require` (a da Aiven já vem assim).
- **Status *Deploy failed* na primeira vez**: abra os logs do build; se for falta de memória ou timeout, clique em **Manual Deploy → Deploy latest commit** e tente de novo.
- **Abre a tela mas diz "servidor não respondeu"**: espere 1 min (app acordando) e recarregue. Se persistir, confira nos Logs se aparece `Application startup complete`.
- **Não aparece "Instalar app" no Chrome**: recarregue a página uma vez e espere 5 s; o endereço precisa ser o `https://` do Render (não `http://`).
- **Despertador não toca com o app fechado**: o Passo 7b foi feito? As notificações estão permitidas no celular para o app? No iPhone, só funciona instalado pela Tela de Início e a partir do iOS 16.4.
- **"Código de convite inválido"**: é o valor exato de `SIGNUP_INVITE_CODE` no Render (sem espaços a mais).

## Se um dia precisar mudar

O app é um container único (`Dockerfile` na raiz) + um Postgres qualquer. Serve em Fly.io, Koyeb, Railway, Oracle Cloud, numa VPS (`docker-compose.yml`, com Caddy e domínio próprio) ou no seu PC (`docker-compose.dev.yml`). Para migrar: `pg_dump` do banco antigo, `psql` no novo, mesmas variáveis de ambiente — e os aplicativos instalados continuam funcionando se o endereço for mantido (domínio próprio) ou basta reinstalar no endereço novo.
