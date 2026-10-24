# Instalação

Há dois caminhos: executar a aplicação web inteira com Docker Compose ou usar Docker somente para o MySQL e rodar frontend/backend no host.

## Requisitos

- Docker Engine e Docker Compose v2 para o caminho em containers; ou
- Node.js `>=24.14 <25`, npm `>=11 <12` e MySQL 8+ para desenvolvimento local.

Confira os limites exatos de versão em `package.json`.

## Docker Compose

Na raiz do repositório, copie os exemplos e substitua as senhas de desenvolvimento:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp backend/.env.docker.example backend/.env.docker
```

Gere um `JWT_SECRET` aleatório para `backend/.env` (veja [variáveis de ambiente](environment-variables.md)). Preencha `MYSQL_ROOT_PASSWORD` e `MYSQL_PASSWORD` no `.env` da raiz com valores locais diferentes. Em `backend/.env`, alinhe `DATABASE_URL` com `MYSQL_USER` e `MYSQL_PASSWORD` do arquivo raiz se for executar comandos Node no host.

Suba os serviços:

```bash
docker compose up --build -d
```

A interface fica em `http://localhost:3000`. O container do backend executa as migrações na inicialização; acompanhe a inicialização com `docker compose logs -f backend`.

O Compose deste repositório é uma configuração de **desenvolvimento**: ele expõe o MySQL somente em loopback para facilitar inspeção local. Não o publique diretamente na internet nem o trate como uma implantação de produção.

## Desenvolvimento com Node.js

Copie `backend/.env.example` para `backend/.env` e `frontend/.env.example` para `frontend/.env`. Defina um `JWT_SECRET` aleatório, ajuste `DATABASE_URL` para seu MySQL local e confirme `CORS_ORIGIN=http://localhost:3000`.

Em seguida:

```bash
npm ci
docker compose up -d mysql
npm run db:generate --workspace=backend
npm run db:migrate --workspace=backend
npm run dev
```

Frontend: `http://localhost:3000`. Backend: `http://localhost:5000`. O Vite encaminha `/api` para a API local; o valor `VITE_API_URL` do exemplo aponta diretamente para o backend.

## Verificações úteis

```bash
npm run type-check
npm run test
npm run build
npm run release:check
```

Para criar usuários e registros de exemplo, siga [Dados de demonstração](demo-data.md). O seed remove dados existentes e não deve ser usado em bancos compartilhados ou de produção.
