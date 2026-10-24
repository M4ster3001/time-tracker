# Fluxos do Sistema

## Roles
- Admin (roleId=1)
- Manager (roleId=2)
- Consultant (roleId=3)

## Fluxo de autenticacao

```mermaid
sequenceDiagram
  participant U as Usuario
  participant FE as Frontend
  participant API as Backend
  U->>FE: Login
  FE->>API: POST /api/auth/login
  API-->>FE: access token + refresh cookie
  FE->>API: Requests autenticadas (Authorization: Bearer)
  FE->>API: POST /api/auth/refresh (cookie)
  API-->>FE: novo access + refresh
  U->>FE: Logout
  FE->>API: POST /api/auth/logout
  API-->>FE: refresh revogado
```

## Fluxo de lancamento rapido (consultor/manager)

```mermaid
sequenceDiagram
  participant U as Usuario
  participant FE as Frontend
  participant API as Backend
  U->>FE: Quick log
  FE->>API: POST /api/time-entries
  API->>API: valida lockDay/fechamento
  API->>API: valida duracao
  API-->>FE: entry criada
  FE->>API: GET /api/dashboards/consultant (atualiza)
```

## Fluxo de lancamento em lote
- Usuario escolhe cliente e lista de dias
- Backend valida lockDay por cliente
- Backend cria entradas validas

## Fluxo de alocacao de horas (admin/manager)

```mermaid
sequenceDiagram
  participant A as Admin/Manager
  participant FE as Frontend
  participant API as Backend
  A->>FE: Ajusta alocacao por cliente
  FE->>API: PUT /api/users/:id/allocations/:clientId
  API->>API: valida (daily/monthly)
  API-->>FE: ok
  FE->>API: GET dashboards (metas atualizadas)
```

## Fluxo de fechamento (lockDay)
- lockDay define dia limite
- A partir do dia seguinte: somente mes atual
- Backend bloqueia alteracoes de entries fora da janela
- UI remove botoes de edicao

## Fluxo de importacao Google Calendar

```mermaid
sequenceDiagram
  participant U as Usuario
  participant FE as Frontend
  participant API as Backend
  participant G as Google

  U->>FE: Conectar Google Calendar
  FE->>API: GET /api/google-calendar/auth-url
  API-->>FE: { url } (com state JWT)
  FE->>G: Redirect para OAuth
  G->>U: Tela de consentimento
  U->>G: Autoriza
  G->>API: Callback com code + state
  API->>API: Verifica state, troca code, criptografa tokens
  API-->>FE: Redirect /calendar-import?connected=true

  U->>FE: Seleciona periodo
  FE->>API: GET /api/google-calendar/events
  API->>G: Busca eventos (calendar.events.list)
  API-->>FE: Eventos formatados + flag alreadyImported

  U->>FE: Seleciona eventos, mapeia clientes
  FE->>API: POST /api/google-calendar/import
  API->>API: createBulkTimeEntries + recordImports
  API-->>FE: Entries criadas
```

> Documentacao completa: [GOOGLE_CALENDAR.md](../integrations/google-calendar.md)

