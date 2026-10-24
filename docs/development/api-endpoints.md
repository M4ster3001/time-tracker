# Mapa de Endpoints por Role

> **Evolução (15/10/2026):** projetos, durações estruturadas, estimativas/confirmação, tracking e MCP estão documentados com exemplos e permissões em [API_EVOLUTION.md](api-evolution.md) e [MCP guide](../integrations/mcp.md). Este arquivo permanece o mapa legado por role.

## Auth
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- POST /api/auth/revoke/:userId (admin)

## Consultor (roleId=3)
- GET /api/dashboards/consultant
- GET /api/time-entries
- POST /api/time-entries
- PUT /api/time-entries/:id
- DELETE /api/time-entries/:id
- GET /api/time-entries/lock-status
- GET /api/users/:id/clients
- GET /api/activity-tags
- GET /api/ai/status
- POST /api/ai/suggestions

## Manager (roleId=2)
- GET /api/dashboards/manager
- GET /api/manager/clients
- GET /api/manager/consultants
- GET /api/manager/consultants/:id/allocations
- PUT /api/manager/consultants/:id/allocations/:clientId
- DELETE /api/manager/consultants/:id/allocations/:clientId
- GET /api/time-entries (do proprio manager)
- POST /api/time-entries (do proprio manager)

## Google Calendar (consultor + manager)
- GET /api/google-calendar/auth-url - URL de autorizacao OAuth
- GET /api/google-calendar/callback - Callback OAuth (sem auth, usa state JWT)
- GET /api/google-calendar/status - Status da conexao
- POST /api/google-calendar/disconnect - Desconectar conta Google
- GET /api/google-calendar/events?startDate&endDate - Listar eventos do periodo
- POST /api/google-calendar/import - Importar eventos como time entries

> Detalhes completos: [GOOGLE_CALENDAR.md](../integrations/google-calendar.md)

## Admin (roleId=1)
- GET /api/dashboards/admin
- GET /api/users
- GET /api/users/:id
- POST /api/users
- PUT /api/users/:id
- DELETE /api/users/:id
- GET /api/users/:id/clients
- PUT /api/users/:id/clients/:clientId
- DELETE /api/users/:id/clients/:clientId
- GET /api/clients
- POST /api/clients
- PUT /api/clients/:id
- DELETE /api/clients/:id
- GET /api/audit-logs
- GET /api/users/:id/allocations
- PUT /api/users/:id/allocations/:clientId
- DELETE /api/users/:id/allocations/:clientId
- GET /api/export

## Tokens de Acesso Pessoal (PAT) - todos os roles autenticados
Permite que uma ferramenta externa (script, IA lendo commits, etc) chame a API como o proprio
usuario, sem depender de login via navegador. O token carrega as mesmas permissoes do usuario
que o gerou (mesmo `roleId`) e comeca com o prefixo `ttpat_`.

- POST /api/access-tokens - gera um token novo
- GET /api/access-tokens - lista os proprios tokens
- DELETE /api/access-tokens/:id - revoga um token proprio
- GET /api/admin/access-tokens (admin) - lista tokens de todos os usuarios
- DELETE /api/admin/access-tokens/:id (admin) - revoga o token de qualquer usuario

**POST /api/access-tokens - Body:**
```json
{
  "label": "Cursor - commits",
  "expiresInDays": 180   // 30 | 90 | 180 | 365
}
```

**Response (o `rawToken` so aparece nesta resposta, uma unica vez):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "rawToken": "ttpat_...",
    "label": "Cursor - commits",
    "expiresAt": "2027-01-18T00:00:00.000Z",
    "revokedAt": null,
    "lastUsedAt": null,
    "createdAt": "2026-07-22T00:00:00.000Z"
  }
}
```

**Uso pela ferramenta externa** (mesmos endpoints usados pelo app, so troca o tipo de token):
```
GET  /api/users/:id/clients                Authorization: Bearer ttpat_...
POST /api/time-entries/bulk                Authorization: Bearer ttpat_...
```

> Requisicoes autenticadas por PAT sao isentas da checagem de CSRF por Origin/Referer (ver
> `csrf.middleware.ts`), ja que um PAT e um segredo que so quem o possui consegue enviar - nao e
> uma credencial ambiente como cookie, entao CSRF nao se aplica a ele por definicao.

## Exportacao (por role)
- GET /api/export
  - consultor: apenas suas horas
  - manager: suas horas + consultores gerenciados
  - admin: visao executiva

## AI Suggestions (todos os roles autenticados)
- GET /api/ai/status - Retorna se AI esta habilitado e qual provider
- POST /api/ai/suggestions - Gera sugestoes de atividades com AI

**POST /api/ai/suggestions - Body:**
```json
{
  "triggerType": "button",    // "client_select" | "button" | "typing"
  "clientId": 1,              // opcional
  "prompt": "reuniao",        // opcional, max 500 chars
  "partialText": "Reu"        // opcional, para typing, max 200 chars
}
```

**Response:**
```json
{
  "suggestions": [
    { "text": "Reuniao de planejamento", "confidence": 0.9, "source": "ai_generated" }
  ],
  "fromCache": false,
  "provider": "openai"
}
```

> **Nota:** Quando AI esta habilitado, descricoes com 50+ caracteres geram automaticamente uma tag resumida para lancamentos rapidos.

