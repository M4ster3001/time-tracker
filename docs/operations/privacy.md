# Guia de Privacidade - Time Tracker System

Este guia explica as configuracoes e mecanismos de privacidade e protecao de dados implementados no sistema.

---

## Indice

1. [Dados Coletados](#1-dados-coletados)
2. [Criptografia de Dados](#2-criptografia-de-dados)
3. [Politica de Retencao](#3-politica-de-retencao)
4. [Auditoria e Logs](#4-auditoria-e-logs)
5. [Exportacao de Dados](#5-exportacao-de-dados)
6. [Exclusao de Dados](#6-exclusao-de-dados)
7. [Conformidade LGPD/GDPR](#7-conformidade-lgpdgdpr)

---

## 1. Dados Coletados

### Dados Pessoais (PII)

| Dado | Tabela | Campo | Tipo | Obrigatorio |
|------|--------|-------|------|-------------|
| Nome completo | `users` | `name` | String | Sim |
| Email | `users` | `email` | String (unique) | Sim |
| Senha | `users` | `passwordHash` | Bcrypt hash | Sim |
| IP (hash) | `refresh_tokens` | `ipHash` | SHA-256 | Nao |
| User-Agent | `refresh_tokens` | `userAgent` | String | Nao |
| Descricao de atividade | `time_entries` | `activityDescription` | Text | Sim |

### Dados de Negocio

| Dado | Tabela | Descricao |
|------|--------|-----------|
| Lancamentos de horas | `time_entries` | Data, duracao, cliente |
| Clientes | `clients` | Nome, codigo, configuracoes |
| Alocacoes | `client_allocations` | Horas alocadas por cliente |

### Dados de Auditoria

| Dado | Tabela | Descricao |
|------|--------|-----------|
| Acoes do usuario | `audit_logs` | Endpoint, acao, status, timestamp |
| Sessoes | `refresh_tokens` | Dispositivo, IP, timestamps |

---

## 2. Criptografia de Dados

### Utilitario de Criptografia

O sistema inclui um utilitario para criptografia de campos sensiveis usando AES-256-GCM.

**Arquivo:** `backend/src/shared/infrastructure/crypto/encryption.ts`

### Configuracao

```env
# .env
# Gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
FIELD_ENCRYPTION_KEY=<64_caracteres_hexadecimais>
```

### Funcoes Disponiveis

```typescript
import { encrypt, decrypt, hashForLookup } from './utils/encryption.js';

// Criptografar dado sensivel
const encrypted = encrypt('dado_sensivel');
// Resultado: "iv:authTag:encryptedData" (hex encoded)

// Descriptografar
const decrypted = decrypt(encrypted);
// Resultado: "dado_sensivel"

// Hash para busca (one-way)
const hash = hashForLookup('email@example.com');
// Resultado: SHA-256 hash (nao reversivel)
```

### Formato do Dado Criptografado

```
<IV 32 hex>:<AuthTag 32 hex>:<Encrypted Data hex>

Exemplo:
a1b2c3d4e5f6....:f1e2d3c4b5a6....:9876543210...
```

### Como Usar em Services

```typescript
import { encrypt, decrypt } from '../utils/encryption.js';

// Ao salvar dados sensiveis
const user = await prisma.user.create({
  data: {
    name: encrypt(data.name),
    email: data.email, // Email pode ser mantido para login
    // ...
  }
});

// Ao ler dados sensiveis
const decryptedName = decrypt(user.name);
```

### Campos Recomendados para Criptografia

| Campo | Prioridade | Motivo |
|-------|------------|--------|
| `activityDescription` | Alta | Pode conter info confidencial de negocio |
| `name` | Media | Dado pessoal identificavel |
| `userAgent` | Baixa | Metadata de sessao |

### Geracao de Chave

```bash
# Gerar chave de 32 bytes (256 bits)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Exemplo de saida:
# a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

---

## 3. Politica de Retencao

### Configuracao

```env
# .env
AUDIT_LOG_RETENTION_DAYS=90        # Logs de auditoria
EXPIRED_TOKEN_RETENTION_DAYS=30    # Tokens expirados
REVOKED_TOKEN_RETENTION_DAYS=30    # Tokens revogados
```

### Dados e Periodos de Retencao

| Tipo de Dado | Retencao | Acao apos Periodo |
|--------------|----------|-------------------|
| Audit Logs | 90 dias | Exclusao permanente |
| Refresh Tokens (expirados) | 30 dias | Exclusao permanente |
| Refresh Tokens (revogados) | 30 dias | Exclusao permanente |
| Activity Tags (nao usadas) | 365 dias | Exclusao permanente |
| Time Entries | Indefinido | Requer exclusao manual/LGPD |
| Usuarios | Indefinido | Exclusao via admin ou LGPD |

### Execucao Automatica

O cleanup e executado automaticamente:
- **Startup:** 5 segundos apos inicializacao
- **Periodico:** A cada 24 horas

### Logs de Cleanup

```
[DATA_RETENTION] Starting data retention cleanup...
[DATA_RETENTION] Deleted 150 audit logs older than 90 days
[DATA_RETENTION] Deleted 45 expired refresh tokens
[DATA_RETENTION] Deleted 12 revoked refresh tokens
[DATA_RETENTION] Cleanup complete: 207 records deleted in 234ms
```

### Arquivo Relacionado

`backend/src/services/data-retention.service.ts`

### Funcoes Disponiveis

```typescript
import {
  runDataRetentionCleanup,
  cleanupAuditLogs,
  cleanupExpiredTokens,
  cleanupRevokedTokens,
  getRetentionStats
} from './services/data-retention.service.js';

// Executar cleanup completo
const results = await runDataRetentionCleanup();
// { auditLogs: 150, expiredTokens: 45, revokedTokens: 12, activityTags: 0 }

// Obter estatisticas
const stats = await getRetentionStats();
// { auditLogs: { total: 5000, olderThanPolicy: 150 }, ... }
```

---

## 4. Auditoria e Logs

### O que e Logado

| Acao | Endpoint | Detalhes |
|------|----------|----------|
| Login | `/api/auth` | Sucesso/falha, userId |
| Logout | `/api/auth` | userId |
| Registro | `/api/auth` | Sucesso/falha |
| Refresh Token | `/api/auth` | Sucesso/falha |
| Revogacao | `/api/auth` | Admin que revogou, usuario alvo |
| CRUD Usuarios | `/api/users` | Acao, status |
| CRUD Clientes | `/api/clients` | Acao, status |
| CRUD Time Entries | `/api/time-entries` | Acao, status |
| Exportacao | `/api/export` | Tipo de exportacao |
| Data Retention | `/system/data-retention` | Quantidade deletada |

### Estrutura do Log

```json
{
  "id": 1,
  "userId": 5,
  "endpoint": "/api/users",
  "action": "POST /api/users",
  "status": "success",
  "details": "201",
  "createdAt": "2026-02-01T10:30:00.000Z"
}
```

### O que NAO e Logado

- Senhas (nem em hash)
- Tokens de acesso
- Conteudo de requisicoes
- Dados pessoais detalhados

### Consultando Logs (Admin)

```http
GET /api/audit-logs
Authorization: Bearer <admin_token>

Query params:
- userId: Filtrar por usuario
- action: Filtrar por acao
- startDate: Data inicial
- endDate: Data final
```

---

## 5. Exportacao de Dados

### Endpoints Disponiveis

```http
GET /api/export/time-entries
Authorization: Bearer <token>

Query params:
- month: Mes (1-12)
- year: Ano
- format: xlsx (padrao)
```

### Permissoes por Role

| Role | Pode Exportar |
|------|---------------|
| Admin | Todos os dados |
| Manager | Consultores gerenciados |
| Consultant | Apenas proprios dados |

### Formato de Exportacao

- **Excel (.xlsx)** com multiplas abas:
  - Resumo por cliente
  - Resumo por consultor
  - Detalhes de lancamentos

### Dados Incluidos na Exportacao

- Nome do usuario
- Nome do cliente
- Datas
- Descricoes de atividade
- Duracao em horas

### Dados NAO Incluidos

- Senhas
- Tokens
- IPs
- Logs de auditoria

---

## 6. Exclusao de Dados

### Exclusao de Usuario

Quando um usuario e excluido, os seguintes dados sao removidos em cascata:

| Tabela | Comportamento |
|--------|---------------|
| `refresh_tokens` | CASCADE (excluido) |
| `activity_tags` | CASCADE (excluido) |
| `client_allocations` | CASCADE (excluido) |
| `time_entries` | CASCADE (excluido) |
| `user_clients` | CASCADE (excluido) |
| `audit_logs` | SET NULL (userId = null, log mantido) |

### Endpoint de Exclusao

```http
DELETE /api/users/:id
Authorization: Bearer <admin_token>
```

### Exclusao de Cliente

Quando um cliente e excluido:

| Tabela | Comportamento |
|--------|---------------|
| `time_entries` | CASCADE (excluido) |
| `user_clients` | CASCADE (excluido) |
| `client_allocations` | CASCADE (excluido) |

---

## 7. Conformidade LGPD/GDPR

### Direitos do Titular

| Direito | Implementacao | Status |
|---------|---------------|--------|
| Acesso | Endpoint `/api/auth/me` + exportacao | Implementado |
| Retificacao | Endpoints de atualizacao | Implementado |
| Exclusao | DELETE + cascatas | Implementado |
| Portabilidade | Exportacao Excel | Implementado |
| Limitacao | Desativacao de conta | Implementado |

### Recomendacoes Pendentes

1. **Consentimento:** Adicionar checkbox de termos no registro
2. **Politica de Privacidade:** Criar documento e exibir ao usuario
3. **Direito ao Esquecimento:** Endpoint especifico para solicitacao
4. **DPO:** Definir responsavel por privacidade

### Bases Legais para Tratamento

| Dado | Base Legal |
|------|------------|
| Email/Nome | Execucao de contrato |
| Lancamentos de horas | Execucao de contrato |
| Logs de auditoria | Interesse legitimo (seguranca) |
| Cookies de sessao | Interesse legitimo (autenticacao) |

---

## Checklist de Privacidade para Producao

- [ ] `FIELD_ENCRYPTION_KEY` configurada
- [ ] Politica de retencao definida nos envs
- [ ] Campos sensiveis criptografados
- [ ] Logs nao contem PII em texto plano
- [ ] Exportacao funcionando corretamente
- [ ] Cascatas de exclusao testadas
- [ ] Backup com dados criptografados
- [ ] Politica de privacidade publicada
- [ ] Termos de uso implementados

---

## Troubleshooting

### "FATAL: FIELD_ENCRYPTION_KEY is required in production"

**Causa:** Chave de criptografia nao definida em producao

**Solucao:**
```bash
# Gerar chave
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Adicionar ao .env
FIELD_ENCRYPTION_KEY=<chave_gerada>
```

### Dados nao estao sendo criptografados

**Causa:** `FIELD_ENCRYPTION_KEY` nao definida em dev

**Solucao:** Em desenvolvimento, o sistema deriva uma chave do JWT_SECRET automaticamente, mas e recomendado definir a chave explicitamente.

### Cleanup nao esta executando

**Verificar:**
1. Logs no startup: `Data retention cleanup scheduled (every 24h)`
2. Logs do cleanup: `[DATA_RETENTION] Starting data retention cleanup...`

Se nao aparecer, verificar se `runDataRetentionCleanup` esta sendo importado em `index.ts`.

---

*Documento atualizado em: 01/02/2026*
