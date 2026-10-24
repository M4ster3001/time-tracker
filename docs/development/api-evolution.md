# API da evolução — guia prático

Atualizado em **15/10/2026**. Documenta rotas, permissões, flows e exemplos disponíveis no código. Consulte também as [regras de negócio](../product/business-rules.md), a [integração MCP](../integrations/mcp.md) e as [orientações de operação](../operations/deployment.md).

O mapa legado por role continua em [ENDPOINTS.md](api-endpoints.md).

## Sumário

1. [Autenticação e envelope](#1-autenticação-e-envelope)
2. [Flows e permissões](#2-flows-e-permissões)
3. [Migrações](#3-migrações)
4. [Durações (DAT-01) + time entries](#4-durações-dat-01--time-entries)
5. [Projetos (PRJ-01)](#5-projetos-prj-01)
6. [Estimativas, atividades, confirmação, referências, calibração](#6-estimativas-atividades-confirmação-referências-calibração)
7. [Tracking sessions (TRK-01)](#7-tracking-sessions-trk-01)
8. [MCP HTTP](#8-mcp-http)
9. [Códigos de erro comuns](#9-códigos-de-erro-comuns)
10. [UI verificada](#10-ui-verificada)

---

## 1. Autenticação e envelope

### Auth

| Modo | Header | Notas |
| --- | --- | --- |
| JWT (login no portal) | `Authorization: Bearer <access_token>` | Refresh em `POST /api/auth/refresh` (cookie/refresh conforme app) |
| PAT | `Authorization: Bearer ttpat_...` | Criar em `POST /api/access-tokens` (flow `tokens`); concessões = interseção token × grants atuais do usuário |

Placeholders nos exemplos: `<ACCESS_TOKEN>`, `<PAT>`, IDs numéricos fictícios.

Todas as rotas desta evolução passam por `authMiddleware` + `authorizeRequest` (exceto health/setup públicos).

### Envelope HTTP

Sucesso:

```json
{ "success": true, "data": { }, "message": null }
```

Erro:

```json
{
  "success": false,
  "error": "FLOW_DISABLED",
  "code": "FORBIDDEN",
  "requestId": "...",
  "details": { "code": "FORBIDDEN", "fields": null, "fieldErrors": null, "requestId": "..." }
}
```

O campo `error` (mensagem) carrega textos de domínio (`FLOW_DISABLED`, `PERMISSION_DENIED`, `PROJECT_CODE_DUPLICATE`, …). O `code` HTTP de app é estável: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), etc. (`backend/src/app/errors/app-error.ts`, `api.presenter.ts`).

---

## 2. Flows e permissões

Defaults em `getFlows()` (`access-control.service.ts`):

| Flow key | Default | Gate nas rotas / serviços |
| --- | --- | --- |
| `projects` | **on** | `/api/projects`, `/api/clients/:id/projects` |
| `estimates` | **on** | `/api/estimates/*`, `/api/task-types`, `/api/work-activities`, `confirm-duration`, `duration-confirmations` / `estimate-revisions` / `estimate-history` |
| `tracking` | **off** | `/api/tracking-sessions/*` |
| `mcp` | **off** | `/api/mcp/*` e stdio via mesmo serviço |

Desligar flow → `403` com mensagem `FLOW_DISABLED` (mesmo com grant da permissão).

Permissões novas (`permissions.ts` → `permissionForRoute`):

| Permissão | Uso principal |
| --- | --- |
| `projects.read` / `projects.write` | CRUD de projetos |
| `estimates.read` | task-types, calibration preview, histórico de confirmações/revisões do apontamento |
| `estimates.propose` | preview, references, work-activities, estimate-revisions |
| `estimates.confirm` | `POST .../time-entries/:id/confirm-duration`, `POST .../work-activities/:id/confirm-duration` |
| `estimation_parameters.manage` | `POST .../calibration/:id/decide`, `PUT .../calibration/policy` |
| `tracking.read` / `tracking.write` | sessões de medição |
| `mcp.use` | listar e chamar tools MCP (HTTP); `mcp.manage` existe no catálogo, mas as rotas HTTP atuais exigem `mcp.use` |

Alterar flows: `PUT /api/access-control/flows` (requer `access.manage`). Revise [permissões](api-endpoints.md) e [variáveis de ambiente](../getting-started/environment-variables.md) ao adaptar a configuração.

---

## 3. Migrações

Aplicar com Prisma no backend (`npm run db:migrate` / `db:migrate:dev` em `backend/`). Nomes relevantes da evolução:

| Migration | Conteúdo |
| --- | --- |
| `20261015140000_add_time_entry_duration_contract` | Colunas de duração em `time_entries` |
| `20261015150000_add_projects` | `projects`, `client.requireProjectOnEntries`, `time_entries.projectId` |
| `20261015160000_add_estimation_catalog` | `task_types`, parameter sets/revisions |
| `20261015170000_add_est02_trk_mcp_src_cal` | `duration_confirmations`, `estimation_references`, `tracking_sessions`, `calibration_proposals` |
| `20261015180000_add_work_activity_estimate_revision_cal_approve` | `work_activities`, `estimate_revisions`, vínculos e campos de aprovação de calibração |

Desktop: upgrade SQLite em `desktop-schema-upgrade.ts` (colunas/tabelas compatíveis; pull do catálogo `projects[]` via `applyProjects` — ver PRJ-01).

---

## 4. Durações (DAT-01) + time entries

### Conceitos

| Campo produto | Persistência | Uso |
| --- | --- | --- |
| Legado / declarado | `durationMinutes` (obrigatório) | Compatibilidade; fechamento se não houver confirmação |
| Estimated | `estimatedDurationMinutes` | Sugestão; não fecha sozinha |
| Confirmed | `confirmedDurationMinutes` + `confirmedAt` / `confirmedByUserId` | Elegível ao fechamento quando presente |
| Actual Tracked | `actualTrackedDurationMinutes` | Só via sessões STOPPED; escrita direta rejeitada |

Respostas de create/list/get/update/bulk anexam `durations` (`withDurationContract`):

```json
{
  "durations": {
    "estimatedMinutes": null,
    "confirmedMinutes": null,
    "actualTrackedMinutes": null,
    "legacyDeclaredMinutes": 120,
    "closingEligibleMinutes": 120,
    "actualTrackedStatus": "NOT_TRACKED",
    "classification": "LEGACY_DECLARED"
  }
}
```

`closingEligibleMinutes` = `confirmedDurationMinutes` se existir; senão `durationMinutes`.

### Endpoints existentes (campos novos)

| Método | Path | Permissão | Flow | Notas |
| --- | --- | --- | --- | --- |
| POST | `/api/time-entries` | `time.write` | — | Body aceita `projectId` opcional; **rejeita** `actualTrackedDurationMinutes` / `deriveActualFrom` |
| PUT | `/api/time-entries/:id` | `time.write` | — | Idem |
| GET | `/api/time-entries` / `/:id` | `time.read` | — | Inclui `durations` |

**POST create — request:**

```json
{
  "clientId": 1,
  "projectId": 10,
  "date": "2026-10-15",
  "activityDescription": "Implementar endpoint",
  "durationMinutes": 120
}
```

**Erros de duração / medição:**

| Mensagem (`error`) | Quando |
| --- | --- |
| `ACTUAL_TRACKED_WRITE_REQUIRES_TRACKING_SESSION` | Body tenta gravar Actual Tracked direto |
| `ACTUAL_TRACKED_DERIVATION_FORBIDDEN` | `deriveActualFrom` presente |
| `FLOW_DISABLED` | `projectId` informado com flow `projects` off |

Confirmação formal: seção 6 (`confirm-duration`).

---

## 5. Projetos (PRJ-01)

Flow: `projects` (default **on**).

| Método | Path | Permissão | Flow |
| --- | --- | --- | --- |
| GET | `/api/projects?clientId=` | `projects.read` | `projects` |
| GET | `/api/clients/:clientId/projects` | `projects.read` | `projects` |
| POST | `/api/projects` | `projects.write` | `projects` |
| PUT | `/api/projects/:id` | `projects.write` | `projects` |
| POST | `/api/projects/:id/archive` | `projects.write` | `projects` |
| GET | `/api/projects/:id/legacy-entries` | `projects.read` | `projects` |
| POST | `/api/projects/:id/classify-legacy-entries` | `projects.write` | `projects` |

Estados: `PLANNED` \| `ACTIVE` \| `PAUSED` \| `COMPLETED` \| `ARCHIVED`. Lançamento só em `PLANNED`/`ACTIVE`. Código único por cliente (normalizado UPPER).

**POST create:**

```http
POST /api/projects
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "clientId": 1,
  "code": "PORTAL",
  "name": "Portal web",
  "description": "Entregas do portal",
  "state": "ACTIVE",
  "ownerUserId": null
}
```

**Response `201` (campos típicos Prisma):** `id`, `uuid`, `clientId`, `code`, `name`, `description`, `state`, `ownerUserId`, `startsOn`, `endsOn`, `createdAt`, `updatedAt`.

**Erros:** `PROJECT_CODE_REQUIRED`, `PROJECT_NAME_REQUIRED`, `PROJECT_CODE_DUPLICATE` (`409 CONFLICT`), `PROJECT_CLIENT_MISMATCH` (ao vincular em hours), `Client not found`, `Invalid project state`.

### 5.1 Classificação legado sem projeto

Prévia dos lançamentos do **cliente do projeto** com `projectId` null; apply atribui o projeto alvo aos elegíveis e devolve conflitos (mês/lockDay, fechamento REVIEW/publicado, já classificado, etc.). Teto 100 IDs; `dryRun: true` não persiste. Audit: `CLASSIFY_LEGACY_PROJECT`.

```http
POST /api/projects/5/classify-legacy-entries
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "entryIds": [11, 12, 13],
  "dryRun": false
}
```

**Response `200`:** `{ projectId, clientId, dryRun, assignedIds, conflicts: [{ entryId, reason }] }`.

---

## 6. Estimativas, atividades, confirmação, referências, calibração

Flow: `estimates` (default **on**), reforçado nos serviços.

### 6.1 Task types e preview

| Método | Path | Permissão |
| --- | --- | --- |
| GET | `/api/task-types` | `estimates.read` |
| GET | `/api/task-types/:id/parameter-sets` | `estimates.read` |
| POST | `/api/task-types` | `estimation_parameters.manage` |
| PUT | `/api/task-types/:id` | `estimation_parameters.manage` |
| PUT | `/api/task-types/:id/parameters` | `estimation_parameters.manage` |
| POST | `/api/estimates/preview` | `estimates.propose` |

`GET` aceita `includeInactive=true` (admin). Resposta inclui `activeBaseMinutes` / `activeFactor` da revisão GLOBAL vigente (`effectiveTo` null).  
`GET /:id/parameter-sets` lista sets ativos (GLOBAL/CLIENT/PROJECT) com revisão vigente.  
`POST` cria tipo (código estável A–Z/0–9/_) e, se `baseMinutes`+`factor`, set GLOBAL + revisão inicial.  
`PUT /:id` atualiza nomes/descrição/`isActive` (arquivar).  
`PUT /:id/parameters` fecha a revisão vigente do escopo alvo e cria nova (não muta o passado). Body opcional: `scope` (`GLOBAL`|`CLIENT`|`PROJECT`), `clientId`, `projectId`. Precedência na resolução: projeto > cliente > global (sem combinar fatores).

**Preview request:**

```json
{
  "baseMinutes": 120,
  "factor": 1.25,
  "roundingMode": "NEAREST_MINUTE",
  "taskTypeCode": "IMPLEMENTATION",
  "clientId": 10,
  "projectId": 20
}
```

Se `taskTypeCode` resolver revisão ativa no contexto, `baseMinutes`/`factor` vêm do catálogo e a resposta inclui `parameterRevisionUuid` + `parameterScope`.

**Preview response `data`:**

```json
{
  "baseMinutes": 120,
  "factor": 1.25,
  "rawMinutes": 150,
  "suggestedMinutes": 150,
  "roundingMode": "NEAREST_MINUTE",
  "formula": "120 × 1.25 → 150 (NEAREST_MINUTE)",
  "parameterRevisionUuid": null
}
```

`roundingMode`: `NEAREST_MINUTE` \| `CEIL_MINUTE` \| `FLOOR_MINUTE`. Erros: `ESTIMATE_BASE_INVALID`, `ESTIMATE_FACTOR_INVALID`.

### 6.2 Work activities e estimate revisions

| Método | Path | Permissão |
| --- | --- | --- |
| POST | `/api/work-activities` | `estimates.propose` |
| POST | `/api/work-activities/:id/estimate-revisions` | `estimates.propose` |

**Create activity:**

```json
{
  "clientId": 1,
  "projectId": 10,
  "title": "Implementar endpoint",
  "description": null,
  "taskTypeCode": "IMPLEMENTATION",
  "timeEntryId": 42
}
```

**Create revision:**

```json
{
  "baseMinutes": 120,
  "factor": 1.25,
  "origin": "CATALOG",
  "reason": null,
  "parameterRevisionUuid": null,
  "syncEstimatedOnLinkedEntries": true
}
```

`origin`: `CATALOG` \| `ONE_OFF` \| `MCP` \| `AI`.  
Por padrão (`syncEstimatedOnLinkedEntries` omitido ou `true`), atualiza `estimatedDurationMinutes` dos `time_entries` vinculados à atividade com `suggestedMinutes`. Não altera `actualTrackedDurationMinutes` nem confirma duração. Resposta inclui `syncedEntryCount`.

### 6.3 Confirmar duração e histórico (EST-02)

| Método | Path | Permissão | Flow |
| --- | --- | --- | --- |
| POST | `/api/time-entries/:id/confirm-duration` | `estimates.confirm` | `estimates` |
| GET | `/api/work-activities/:id/confirm-duration-preview` | `estimates.read` | `estimates` |
| POST | `/api/work-activities/:id/confirm-duration` | `estimates.confirm` | `estimates` |
| GET | `/api/time-entries/:id/duration-confirmations` | `estimates.read` | `estimates` |
| GET | `/api/time-entries/:id/estimate-revisions` | `estimates.read` | `estimates` |
| GET | `/api/time-entries/:id/estimate-history` | `estimates.read` | `estimates` |
| GET | `/api/time-entries/:id/estimation-references` | `estimates.read` | `estimates` |

**Confirm request:**

```json
{
  "confirmedMinutes": 135,
  "justification": "Ajuste após revisão"
}
```

Aceita também `durationMinutes` como alias de `confirmedMinutes`. Autorização: escopo de `estimates.confirm` — `self` (dono), `team` (dono + `managerId` do ator), `all` (qualquer). Não usa `roleId` sozinho; `WorkActivity.owner` não basta para terceiros. Cria linha imutável em `duration_confirmations` (com `workActivityId` / `estimateRevisionId` quando existirem) e atualiza espelho no `TimeEntry`; estimativa original preservada. Resposta: apontamento + `durations`.

**Confirmação de atividade (multi-apontamento):**

```json
{
  "confirmedMinutes": 270,
  "justification": "Total da atividade",
  "distribution": [
    { "timeEntryId": 10, "confirmedMinutes": 180 },
    { "timeEntryId": 11, "confirmedMinutes": 90 }
  ]
}
```

Sem `distribution`, rateio proporcional ao `durationMinutes` (fallback estimado / igual) com largest remainder **somente entre apontamentos confirmáveis pelo ator**. Com `distribution`, deve listar exatamente os apontamentos do subconjunto confirmável (soma = `confirmedMinutes`); incluir id de terceiro não autorizado → `DISTRIBUTION_ENTRY_NOT_CONFIRMABLE`. Cada parcela (15–480 min) gera confirmação versionada própria. Resposta inclui `partial` + `skippedTimeEntryIds` quando há donos fora do escopo. Forbidden só se nenhum apontamento for confirmável. Prévia: `GET .../confirm-duration-preview?confirmedMinutes=270`.

**Não** fecha o mês nem move bolsões.

**Histórico (`estimate-history` response `data`):** confirmações, revisões e evidências SRC-01 ordenadas da mais recente para a mais antiga. `actualTrackedMinutes` espelha só o campo persistido do apontamento (`null` = Não medido); nunca é inventado a partir de estimativa/confirmação/commits. Cada item em `estimationReferences` traz `isActualTrackedEvidence: false`.

```json
{
  "timeEntryId": 42,
  "workActivityId": 7,
  "actualTrackedMinutes": null,
  "durationConfirmations": [
    {
      "id": 2,
      "uuid": "...",
      "version": 2,
      "confirmedMinutes": 120,
      "estimatedMinutesSnapshot": 150,
      "justification": "correcao",
      "confirmedByUserId": 3,
      "confirmedAt": "2026-10-15T12:00:00.000Z",
      "previousConfirmationId": 1,
      "estimateRevisionId": 5,
      "workActivityId": 7
    }
  ],
  "estimateRevisions": [
    {
      "id": 5,
      "version": 1,
      "baseMinutes": 120,
      "factor": 1.25,
      "suggestedMinutes": 150,
      "formula": "120 × 1.25 → 150 (NEAREST_MINUTE)",
      "origin": "ONE_OFF"
    }
  ],
  "estimationReferences": [
    {
      "id": 8,
      "kind": "COMMIT",
      "provider": "github",
      "externalId": "abc123",
      "repository": "org/repo",
      "isActualTrackedEvidence": false,
      "disclaimer": "EstimationReference is evidence input only — not Actual Tracked Duration"
    }
  ]
}
```

Os endpoints `duration-confirmations`, `estimate-revisions` e `estimation-references` devolvem subconjuntos do mesmo histórico (sem inventar medição).

### 6.4 Estimation references (SRC-01)

| Método | Path | Permissão |
| --- | --- | --- |
| POST | `/api/estimates/references` | `estimates.propose` |
| GET | `/api/time-entries/:id/estimation-references` | `estimates.read` |
| (incluso) | `GET .../estimate-history` → `estimationReferences[]` | `estimates.read` |
| GET | `/api/time-entries/:id/estimation-references` | `estimates.read` |

```json
{
  "kind": "COMMIT",
  "provider": "github",
  "externalId": "abc123def",
  "repository": "org/repo",
  "title": "feat: endpoint",
  "uri": "https://example.com/commit/abc123def",
  "timeEntryId": 42,
  "projectId": 10,
  "presentAsActualTracked": false
}
```

`kind`: `COMMIT` \| `PULL_REQUEST` \| `ISSUE` \| `DOCUMENT` \| `MANUAL`.  
`presentAsActualTracked: true` → `REFERENCE_NOT_ACTUAL_TRACKED`. Dedupe por chave provider/kind/repo/externalId. Resposta `201` inclui nota de que não é Actual Tracked.

**Local-git:** `POST /api/estimates/references/local-git` aceita `sha`, `message`, `repository`, opcional `authorEmail`/`authorName`. `authorUserId` só quando o e-mail Git mapeia (mapa `verified` injetável ou self-claim = e-mail da conta autenticada); terceiro sem mapa → `null` (não atribui o linker). Nunca Actual Tracked.

### 6.5 Calibração (CAL-01)

| Método | Path | Permissão |
| --- | --- | --- |
| POST | `/api/estimates/calibration/preview` | `estimates.read` |
| GET | `/api/estimates/calibration/policy` | `estimates.read` |
| PUT | `/api/estimates/calibration/policy` | `estimation_parameters.manage` |
| POST | `/api/estimates/calibration/:id/decide` | `estimation_parameters.manage` |

**Preview:**

```json
{
  "rows": [
    { "estimatedMinutes": 150, "confirmedMinutes": 135, "actualTrackedMinutes": 126 }
  ],
  "taskTypeCode": "IMPLEMENTATION",
  "parameterSetId": 1,
  "targetClientId": 10,
  "targetProjectId": 20,
  "proposedBaseMinutes": 110,
  "proposedFactor": 1.2,
  "justification": "Viés de superestimação",
  "persistDraft": true,
  "markProposed": true
}
```

Sem `rows`, o serviço monta amostra a partir de apontamentos com estimado+confirmado (até 500). Com `persistDraft`, cria `calibration_proposals` e devolve `proposalId` / `proposalUuid`. `parameterSetId` explícito tem prioridade; senão APPROVE usa `targetClientId`/`targetProjectId` com precedência projeto > cliente > global (`resolveCalibrationTargetParameterSet`).

**Decide:**

```json
{
  "decision": "APPROVE",
  "justification": "Promover revisão",
  "effectiveFrom": "2026-10-16",
  "targetClientId": 10,
  "targetProjectId": 20
}
```

`APPROVE` cria `EstimationParameterRevision` + auditoria; `REJECT` encerra a proposta. `targetClientId`/`targetProjectId` no decide são override opcional do contexto persistido na proposta. Erros: `CALIBRATION_PARAMETER_SET_REQUIRED`, estados inválidos de proposta.

---

## 7. Tracking sessions (TRK-01)

Flow: `tracking` (**default off**).

| Método | Path | Permissão |
| --- | --- | --- |
| GET | `/api/tracking-sessions` | `tracking.read` |
| GET | `/api/tracking-sessions/active` | `tracking.read` |
| POST | `/api/tracking-sessions` | `tracking.write` |
| POST | `/api/tracking-sessions/import` | `tracking.write` |
| POST | `/api/tracking-sessions/:id/pause` | `tracking.write` |
| POST | `/api/tracking-sessions/:id/resume` | `tracking.write` |
| POST | `/api/tracking-sessions/:id/stop` | `tracking.write` |

Estados: `RUNNING` \| `PAUSED` \| `STOPPED`. Uma sessão aberta (timer) por usuário. Import cria sessão já `STOPPED` (`source: IMPORT`).

**Start:**

```json
{ "timeEntryId": 42 }
```

`timeEntryId` opcional; se informado, deve ser do ator. Erro se já houver sessão aberta: `TRACKING_SESSION_ALREADY_OPEN`.

**Import** (rastreador externo; flow ainda off-by-default):

```json
{
  "externalId": "toggl:abc123",
  "startedAt": "2026-10-15T10:00:00.000Z",
  "endedAt": "2026-10-15T11:00:00.000Z",
  "timeEntryId": 42,
  "accumulatedPausedMs": 0
}
```

`externalId` obrigatório (unique com `source=IMPORT`). Reenvio do mesmo ator → `200` + `created: false` (idempotente). Outro usuário com o mesmo id → `TRACKING_EXTERNAL_ID_CONFLICT`. Intervalo inválido / pausa maior que a janela → `400`. Não inventa política de ociosidade.

No **stop** / **import**, se houver `timeEntryId`, recalcula `actualTrackedDurationMinutes` **somente** a partir de sessões `STOPPED` (união/pausas no domínio). Sem sessão fechada → campo permanece `null` (`NOT_TRACKED`). Zero medido ≠ não medido.

---

## 8. MCP HTTP

Flow: `mcp` (**default off**). Permissão: `mcp.use`. Detalhe completo: [MCP guide](../integrations/mcp.md).

| Método | Path | Permissão |
| --- | --- | --- |
| GET | `/api/mcp/tools` | `mcp.use` |
| POST | `/api/mcp/tools/call` | `mcp.use` |

**List response `data`:**

```json
{
  "transport": "streamable-http-stub",
  "protocol": "2026-07-28",
  "tools": [
    {
      "name": "estimates.preview",
      "description": "Calcula previa de estimativa sem persistir",
      "effect": "propose",
      "requiredPermission": "estimates.propose"
    }
  ]
}
```

**Call:**

```json
{
  "name": "estimates.preview",
  "arguments": { "baseMinutes": 120, "factor": 1.25 }
}
```

Tools de estimativa também exigem flow `estimates`. Proibidas (não estão no catálogo; chamada → `MCP_TOOL_FORBIDDEN`): fechamento financeiro, `balances.write`, `access.manage`, `time_entries.confirm_duration`.

---

## 9. Códigos de erro comuns

| HTTP | `code` | Mensagens frequentes (`error`) |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | validação de body, `ESTIMATE_*`, `TRACKING_SESSION_ALREADY_OPEN`, `ACTUAL_TRACKED_*`, `REFERENCE_NOT_ACTUAL_TRACKED` |
| 401 | `UNAUTHORIZED` | token ausente/inválido |
| 403 | `FORBIDDEN` | `FLOW_DISABLED`, `PERMISSION_DENIED`, `MCP_TOOL_FORBIDDEN`, `Forbidden` |
| 404 | `NOT_FOUND` | recurso inexistente |
| 409 | `CONFLICT` | `PROJECT_CODE_DUPLICATE` |

---

## 10. UI verificada

Evidência no frontend (não inventar telas workspace em andamento):

| Superfície | Evidência |
| --- | --- |
| Aba **Projetos** em Clientes | `ClientProjectsPage.tsx` + tab em `WorkspacePages.tsx` (flow `projects` + `projects.read`) |
| Seletor de projeto no lançamento | `TimeEntryForm.tsx` / `fetchClientProjects` |
| Confirmar duração | `confirmTimeEntryDuration` + botão no formulário de lançamento |
| Timer | `TrackingTimerWidget` montado no dashboard pessoal e na página de lançamento (`DashboardPersonalPage.tsx`, `TimeEntryPage.tsx`); exige flow `tracking` + grants; Actual Tracked só após stop na API |
| Access UI | Labels de flow para `projects` / `estimates` em `AccessPage`; `tracking` / `mcp` existem no backend (default off) e aparecem na lista de flows se retornados pela API |

As regras correspondentes estão nos módulos `backend/src/modules/estimates/`, `backend/src/modules/projects/`, `backend/src/modules/tracking/` e `backend/src/modules/mcp/`. Para visão geral, consulte [regras do produto](../product/business-rules.md) e [MCP](../integrations/mcp.md).
