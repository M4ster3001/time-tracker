# Arquitetura

O repositório organiza o aplicativo web em dois workspaces: `frontend/` (SPA React/TypeScript) e `backend/` (API Express/TypeScript). O banco relacional é acessado por Prisma; Docker Compose fornece um ambiente local.

| Componente | Responsabilidade |
| --- | --- |
| `frontend/` | Navegação, autenticação no navegador, formulários, painéis, relatórios e preferências locais. |
| `backend/src/app/` | Inicialização do Express, middlewares, rotas e políticas transversais. |
| `backend/src/modules/` | Funcionalidades agrupadas por domínio, como usuários, clientes, horas, relatórios, projetos e integrações. |
| `backend/src/shared/` | Infraestrutura compartilhada, utilitários de domínio e adaptadores comuns. |
| `backend/prisma/` | Schema, migrações e seed de demonstração. |
| `docs/` | Guias para pessoas usuárias, desenvolvimento e operação. |

## Caminho de uma requisição

O frontend chama rotas `/api`; o backend valida entrada, autenticação, permissões e regras de domínio antes de persistir mudanças por meio do Prisma. A API é a autoridade para autorização e integridade, mesmo quando a interface oculta uma ação.

Veja o [diagrama de arquitetura](../diagrams/architecture.png) ou edite a fonte [architecture.mmd](../diagrams/architecture.mmd). O [fluxo de um lançamento](../diagrams/time-entry-lifecycle.png) mostra um exemplo de ponta a ponta.

## Organização do backend

Quando um módulo segue a separação por camadas, `domain/` contém regras e contratos; `application/` coordena casos de uso; `http/` recebe e responde requisições; `infrastructure/` implementa acesso a banco ou serviços externos. Nem todos os módulos legados foram migrados integralmente para essa convenção; use os módulos existentes como contexto e evite propagar inconsistências sem necessidade.

Os testes ficam próximos das regras que verificam. As configurações de workspace e scripts comuns ficam na raiz; veja também o [guia do frontend](frontend.md) e [como executar testes](testing.md).

## Autenticação, dados e integrações

O backend usa tokens JWT e cookie de refresh, com persistência MySQL via Prisma. Sessões, níveis de acesso, retenção e política de backup precisam ser configurados de acordo com o ambiente. Consulte [variáveis de ambiente](../getting-started/environment-variables.md), [segurança](../operations/security-controls.md) e [privacidade](../operations/privacy.md).

Google Calendar, provedores de IA, Redis, armazenamento de backup e endpoints MCP são opcionais. Não são necessários para executar a aplicação básica; habilite-os somente depois de definir credenciais, permissões, custos e limites. Veja o [índice de integrações](../integrations/README.md).
