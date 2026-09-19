# Testar o Disciplina no seu computador

Jeito mais simples: **Docker Desktop**. Ele sobe o banco, a API e o site com um comando, sem instalar Python, Node nem Postgres.

## O que o computador precisa

- Windows 10/11 64 bits (ou Mac/Linux), com uns **4 GB de RAM livres** e **4 GB de disco**.
- Virtualização ligada na BIOS (na maioria dos PCs já vem ligada; o instalador do Docker avisa se não estiver).
- O app em si é leve — o que pesa é só o Docker.

## Passo a passo

1. Instale o **Docker Desktop**: https://www.docker.com/products/docker-desktop/
   Abra-o uma vez e espere aparecer "Engine running" no canto inferior esquerdo.
2. Extraia o ZIP do repositório numa pasta (ex.: `C:\disciplina`).
3. Abra o terminal nessa pasta (no Explorer: clique com o botão direito dentro da pasta → **Abrir no Terminal**).
4. Rode:

   ```bash
   docker compose -f docker-compose.dev.yml up
   ```

   Na primeira vez demora uns **3 a 5 minutos** (baixa as imagens e instala as dependências). Quando aparecer `Local: http://localhost:5173/`, está pronto.
5. Abra **http://localhost:5173** no Chrome ou Edge. Crie a conta e use.

Para parar: `Ctrl+C` no terminal. Para subir de novo, o mesmo comando do passo 4 (agora leva segundos). Os dados ficam guardados entre uma vez e outra.

## O que funciona no PC

- Tudo: rotina, despertador (com som e tela de alarme), tarefas, metas, treinos, agenda, provas, sessões de estudo, notas, evolução, lixeira, offline.
- Dá para **instalar como app** pelo Chrome (ícone de instalar na barra de endereço) — `localhost` conta como seguro.

## O que só funciona publicado com HTTPS

- Abrir **no celular**: o app precisa de um endereço `https://` (é assim que o navegador libera service worker, notificações, câmera e tela acesa). É o deploy na Oracle/VPS.
- **Notificação com o app fechado** (Web Push): precisa das chaves VAPID no `.env` (`docker compose -f docker-compose.dev.yml run --rm api python -m app.core.push` gera; cole as duas linhas num arquivo `.env` ao lado do compose e suba de novo).

## IA para estudos (opcional)

Crie um arquivo chamado `.env` ao lado do `docker-compose.dev.yml` com:

```
AI_API_KEY=sua-chave
```

Chave gratuita: **Groq** (console.groq.com → API Keys). Os outros valores já vêm prontos para o Groq. Suba de novo o compose e a seção "Estudar com IA" fica ativa. Sem chave, o app mostra "IA não configurada" e todo o resto funciona.

## Se der errado

- **"port is already allocated"**: outra coisa usa a porta 5173 ou 8000. Feche-a ou mude o número da esquerda em `ports:` no compose (ex.: `"5174:5173"`) e abra `http://localhost:5174`.
- **Site abre mas nada carrega**: espere a API terminar de subir (no terminal aparece `Application startup complete`) e recarregue.
- **Mudei o código e não atualizou**: o site (Vite) atualiza sozinho; a API precisa de `Ctrl+C` e subir de novo.
- **Quero zerar tudo**: `docker compose -f docker-compose.dev.yml down -v` (apaga o banco de teste).

## Sem Docker (manual)

Instale Python 3.11+, Node 22+ e PostgreSQL 16 e siga "Desenvolvimento local" no README. Funciona igual, só dá mais trabalho.
