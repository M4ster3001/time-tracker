# Variáveis de ambiente

Use os arquivos `.env.example` como referência, copie-os para arquivos locais ignorados pelo Git e substitua os valores de exemplo. Nunca reutilize valores de demonstração em staging ou produção.

## Arquivos

| Arquivo | Uso |
| --- | --- |
| `.env` | Interpolação do Docker Compose: credenciais locais do MySQL, porta web e diretório de backups. |
| `backend/.env` | API e comandos locais: banco, chave JWT, CORS, limites e integrações opcionais. |
| `backend/.env.docker` | Overrides para a API dentro da rede Docker. O Compose injeta a URL de banco com o hostname do serviço MySQL. |
| `frontend/.env` | Frontend em desenvolvimento, especialmente a URL da API. |

Os quatro arquivos locais não devem ser versionados. Os exemplos são deliberadamente simples e destinados a desenvolvimento local.

## Backups no Docker

Por padrão, os backups ficam em um volume Docker nomeado (`backups_data`), que funciona em Linux, macOS e Windows, inclusive em discos vfat/exFAT e compartilhamentos de rede onde o Docker não consegue aplicar `chown`.

Para gravar em **outro disco ou pasta do host** (por exemplo, a aplicação roda em `C:` e os backups vão para `F:`), defina `BACKUP_HOST_PATH` no `.env` da raiz:

| Sistema | Exemplo |
| --- | --- |
| Windows | `BACKUP_HOST_PATH=F:/time-tracker-backups` |
| Linux | `BACKUP_HOST_PATH=/mnt/backup/time-tracker` |
| macOS | `BACKUP_HOST_PATH=/Volumes/Backup/time-tracker` |

Requisitos: crie a pasta antes de subir os containers (o Docker não consegue criá-la em sistemas de arquivos sem suporte a `chown`, como vfat/exFAT), garanta permissão de escrita e, no Docker Desktop, que o disco esteja compartilhado com o Docker. Depois de alterar o `.env`, recrie o backend: `docker compose up -d backend`.

Para copiar os arquivos de um volume nomeado para o host: `docker compose cp backend:/app/backups ./backups-copy`.

## Configuração mínima

- `DATABASE_URL`: endereço MySQL alcançável pelo processo do backend.
- `JWT_SECRET`: valor aleatório com pelo menos 32 caracteres e entropia adequada. Gere um diferente para cada ambiente.
- `CORS_ORIGIN`: origem exata do navegador (por exemplo, `http://localhost:3000` em desenvolvimento ou a URL HTTPS da sua aplicação).
- `NODE_ENV`: use `development` localmente; containers de runtime são configurados para execução de produção.

Gere um segredo aleatório local sem copiar um segredo de terceiros:

```bash
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

Copie o resultado diretamente para o arquivo local apropriado. Não coloque o resultado em documentação, issue, histórico de shell compartilhado ou chat público.

## Integrações opcionais

As variáveis de Google Calendar, IA, Redis e armazenamento de backup ficam agrupadas em `backend/.env.example`. Deixe recursos desativados até configurar as credenciais e testar o caminho completo. O preenchimento de uma chave não substitui a revisão de escopos, retenção, custo, consentimento ou segurança do provedor.

A configuração MCP OAuth disponível no código é apenas metadata/discovery; o aplicativo não emite tokens OAuth. Consulte [MCP](../integrations/mcp.md) antes de habilitá-lo.

## Dados de demonstração

`ALLOW_DEMO_SEED`, `CONFIRM_DEMO_SEED_DELETE`, `DEMO_SEED_PASSWORD` e `DAILY_SEED_ENABLED` são opções locais para desenvolvimento. O seed de demonstração é destrutivo, exige confirmação explícita e recusa conexões que não pareçam locais. Leia [Dados sintéticos de demonstração](demo-data.md) antes de usá-lo.

## Produção

Mantenha os segredos em um gerenciador próprio para o ambiente, limite quem pode lê-los, configure HTTPS e uma origem CORS exata, use credenciais de banco não administrativas e planeje rotação. Veja [Implantação e operação](../operations/deployment.md).
