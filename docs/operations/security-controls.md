# Guia de Seguranca - Time Tracker System

Este guia explica todas as configuracoes e mecanismos de seguranca implementados no sistema.

---

## Indice

1. [Autenticacao JWT](#1-autenticacao-jwt)
2. [Refresh Tokens](#2-refresh-tokens)
3. [Account Lockout](#3-account-lockout)
4. [Protecao CSRF](#4-protecao-csrf)
5. [Rate Limiting](#5-rate-limiting)
6. [Validacao de Senha](#6-validacao-de-senha)
7. [Headers de Seguranca](#7-headers-de-seguranca)
8. [Variaveis de Ambiente](#8-variaveis-de-ambiente)

---

## 1. Autenticacao JWT

### Como Funciona

O sistema usa JSON Web Tokens (JWT) para autenticacao stateless.

```
┌─────────┐     POST /api/auth/login      ┌─────────┐
│ Cliente │ ─────────────────────────────▶│ Servidor│
│         │     { email, password }       │         │
│         │                               │         │
│         │◀───────────────────────────── │         │
│         │     { token, user }           │         │
│         │     + Set-Cookie: refresh     │         │
└─────────┘                               └─────────┘
```

### Configuracao

```env
# .env
JWT_SECRET=sua_chave_secreta_com_pelo_menos_32_caracteres_aqui
JWT_EXPIRATION=15m
```

**Requisitos do JWT_SECRET:**
- Minimo 32 caracteres (obrigatorio)
- Deve ser unico por ambiente (dev/staging/prod)
- Nunca commitar no repositorio
- Rotacionar periodicamente (a cada 90 dias recomendado)

**Gerando um JWT_SECRET seguro:**
```bash
# Usando Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Usando OpenSSL
openssl rand -hex 64
```

### Estrutura do Token

```json
{
  "userId": 1,
  "email": "user@example.com",
  "roleId": 1,
  "iat": 1706832000,
  "exp": 1706832900
}
```

### Arquivos Relacionados

- `backend/src/config.ts` - Configuracao
- `backend/src/shared/infrastructure/crypto/jwt.ts` - Geracao/verificacao de tokens
- `backend/src/app/http/middleware/auth.middleware.ts` - Middleware de autenticacao

---

## 2. Refresh Tokens

### Como Funciona

Refresh tokens permitem renovar o JWT sem re-autenticacao.

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE REFRESH TOKEN                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Login bem-sucedido:                                     │
│     - JWT gerado (15min)                                    │
│     - Refresh token gerado (7 dias)                         │
│     - Refresh token armazenado como cookie httpOnly         │
│     - Hash do token salvo no banco                          │
│                                                              │
│  2. JWT expira:                                             │
│     - Frontend detecta 401                                  │
│     - Chama POST /api/auth/refresh                          │
│     - Cookie enviado automaticamente                        │
│                                                              │
│  3. Refresh (Token Rotation):                               │
│     - Token antigo revogado                                 │
│     - Novo token gerado                                     │
│     - Novo JWT emitido                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Configuracao

```env
# .env
REFRESH_TOKEN_TTL_DAYS=7
REFRESH_TOKEN_COOKIE=refresh_token
```

### Seguranca do Cookie

O refresh token e armazenado em cookie com as seguintes flags:

| Flag | Valor | Descricao |
|------|-------|-----------|
| `httpOnly` | `true` | Nao acessivel via JavaScript |
| `secure` | `true` (prod) | Apenas HTTPS em producao |
| `sameSite` | `strict` | Protecao CSRF |
| `maxAge` | 7 dias | Expiracao automatica |

### Token Rotation

Cada vez que um refresh token e usado:
1. O token antigo e marcado como revogado
2. Um novo token e gerado
3. O hash do novo token e salvo no banco
4. Se um token revogado for usado novamente, TODOS os tokens do usuario sao revogados (deteccao de roubo)

### Arquivos Relacionados

- `backend/src/services/refresh-token.service.ts` - Logica de tokens
- `backend/src/controllers/auth.controller.ts` - Endpoints

---

## 3. Account Lockout

### Como Funciona

Protege contra ataques de brute-force bloqueando contas apos multiplas falhas.

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE LOCKOUT                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tentativa 1: Senha errada → failedLoginAttempts = 1        │
│  Tentativa 2: Senha errada → failedLoginAttempts = 2        │
│  Tentativa 3: Senha errada → failedLoginAttempts = 3        │
│  Tentativa 4: Senha errada → failedLoginAttempts = 4        │
│  Tentativa 5: Senha errada → CONTA BLOQUEADA (15 min)       │
│                                                              │
│  Durante bloqueio:                                          │
│  - Mensagem: "Account locked. Try again in X minutes."      │
│  - Mesmo senha correta nao funciona                         │
│                                                              │
│  Apos 15 minutos OU desbloqueio por admin:                  │
│  - Conta liberada                                           │
│  - Contador resetado                                        │
│                                                              │
│  Login bem-sucedido (antes de 5 falhas):                    │
│  - Contador resetado para 0                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Configuracao

Definido em `backend/src/services/auth.service.ts`:

```typescript
const MAX_FAILED_ATTEMPTS = 5;      // Tentativas antes do bloqueio
const LOCKOUT_DURATION_MINUTES = 15; // Duracao do bloqueio
```

### Campos no Banco de Dados

```prisma
model User {
  failedLoginAttempts  Int       @default(0)
  lockedUntil          DateTime?
  lastFailedLoginAt    DateTime?
}
```

### Endpoint de Desbloqueio (Admin)

```http
POST /api/auth/unlock/:userId
Authorization: Bearer <admin_token>
```

### Monitoramento

Eventos de lockout sao logados:
```
[SECURITY] Account locked: user@example.com after 5 failed attempts
```

### Arquivos Relacionados

- `backend/src/services/auth.service.ts` - Logica de lockout
- `backend/src/controllers/auth.controller.ts` - Endpoint de unlock
- `backend/prisma/schema.prisma` - Campos do modelo User

---

## 4. Protecao CSRF

### Como Funciona

Cross-Site Request Forgery (CSRF) e prevenido validando a origem das requisicoes.

### Metodos Protegidos

- `POST`
- `PUT`
- `PATCH`
- `DELETE`

### Validacao

```typescript
// Requisicao aceita se:
// 1. Header Origin corresponde a CORS_ORIGIN
// 2. OU Header Referer corresponde a CORS_ORIGIN
// 3. EM DEV: Requisicoes sem Origin/Referer sao permitidas (curl, Postman)
```

### Configuracao

```env
# .env
CORS_ORIGIN=http://localhost:3000  # Dev
CORS_ORIGIN=https://app.exemplo.com # Prod
```

### Logs de Seguranca

Requisicoes bloqueadas sao logadas:
```
[CSRF] Blocked request: POST /api/users from origin=https://evil.com
```

### Arquivos Relacionados

- `backend/src/app/http/middleware/csrf.middleware.ts` - Middleware CSRF
- `backend/src/index.ts` - Aplicacao global

---

## 5. Rate Limiting

### Endpoints com Rate Limit

| Endpoint | Limite | Janela | Motivo |
|----------|--------|--------|--------|
| `POST /api/auth/login` | 5 req | 15 min | Previne brute-force |
| `POST /api/auth/refresh` | 20 req | 15 min | Previne abuse de refresh |
| `POST /api/auth/logout` | 20 req | 15 min | Previne DOS |
| `POST /api/auth/revoke/:userId` | 10 req | 15 min | Operacao sensivel |

### Configuracao

```env
# .env
RATE_LIMIT_WINDOW_MS=900000   # 15 minutos em ms
RATE_LIMIT_MAX_REQUESTS=5     # Maximo de requests para login
```

### Resposta quando Limitado

```json
{
  "message": "Too many login attempts, please try again later"
}
```
Status: `429 Too Many Requests`

### Arquivos Relacionados

- `backend/src/index.ts` - Configuracao dos limiters

---

## 6. Validacao de Senha

### Requisitos

| Requisito | Descricao |
|-----------|-----------|
| Comprimento | Minimo 12 caracteres |
| Maiuscula | Pelo menos 1 letra maiuscula |
| Minuscula | Pelo menos 1 letra minuscula |
| Numero | Pelo menos 1 digito |
| Especial | Pelo menos 1 caractere especial |

### Caracteres Especiais Aceitos

```
! @ # $ % ^ & * ( ) _ + - = [ ] { } ; ' : " \ | , . < > / ?
```

### Exemplo de Senha Forte

Use uma frase-senha exclusiva e longa, gerada por um gerenciador confiável. Não reutilize os exemplos desta documentação como credenciais.

### Exemplo de Senhas Invalidas

| Senha | Problema |
|-------|----------|
| Uma palavra comum seguida somente de números | Fácil de adivinhar e curta |
| Uma palavra em caixa alta com números e símbolo | Falta diversidade de caracteres |
| Uma frase curta sem número | Não atende à política de complexidade descrita acima |
| Uma sequência de poucos caracteres | Muito curta |

### Mensagens de Erro

```json
{
  "success": false,
  "error": "Password must be at least 12 characters. Password must contain at least one uppercase letter."
}
```

### Arquivos Relacionados

- `backend/src/services/auth.service.ts` - Funcao `validatePasswordStrength()`

---

## 7. Headers de Seguranca

### Headers Aplicados (via Helmet)

| Header | Valor | Descricao |
|--------|-------|-----------|
| `X-Content-Type-Options` | `nosniff` | Previne MIME sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Previne clickjacking |
| `X-XSS-Protection` | `0` | Desativa filtro XSS legado |
| `Strict-Transport-Security` | `max-age=15552000` | Forca HTTPS |
| `X-Download-Options` | `noopen` | IE: previne execucao de downloads |
| `X-Permitted-Cross-Domain-Policies` | `none` | Bloqueia politicas cross-domain |
| `Referrer-Policy` | `no-referrer` | Nao envia referrer |

### Arquivos Relacionados

- `backend/src/index.ts` - `app.use(helmet())`

---

## 8. Variaveis de Ambiente

### Obrigatorias

| Variavel | Descricao | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | URL de conexao MySQL | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Chave secreta JWT (32+ chars) | `abc123...` (64 chars hex) |

### Opcionais (com defaults)

| Variavel | Default | Descricao |
|----------|---------|-----------|
| `NODE_ENV` | `development` | Ambiente |
| `PORT` | `5000` | Porta do servidor |
| `JWT_EXPIRATION` | `15m` | Tempo de expiracao JWT |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Dias de validade do refresh |
| `BCRYPT_ROUNDS` | `10` | Rounds de hash |
| `CORS_ORIGIN` | `http://localhost:3000` | Origem permitida |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Janela de rate limit (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `5` | Max requests por janela |

### Exemplo Completo (.env)

```env
# Ambiente
NODE_ENV=production

# Servidor
PORT=5000
HOST=0.0.0.0

# Banco de Dados
DATABASE_URL=mysql://user:password@localhost:3306/time_tracker

# JWT (OBRIGATORIO)
JWT_SECRET=sua_chave_secreta_muito_longa_com_pelo_menos_64_caracteres_hexadecimais
JWT_EXPIRATION=15m

# Refresh Token
REFRESH_TOKEN_TTL_DAYS=7
REFRESH_TOKEN_COOKIE=refresh_token

# Bcrypt
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGIN=https://app.seudominio.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5
```

---

## Checklist de Seguranca para Producao

- [ ] `JWT_SECRET` definido com 64+ caracteres aleatorios
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` usando HTTPS
- [ ] Banco de dados com senha forte
- [ ] HTTPS configurado no servidor/proxy
- [ ] Logs de seguranca monitorados
- [ ] Backups do banco configurados
- [ ] Firewall configurado (apenas portas necessarias)
- [ ] Rate limiting ajustado para producao
- [ ] Certificado SSL valido

---

## Troubleshooting

### "FATAL: JWT_SECRET environment variable is required"

**Causa:** JWT_SECRET nao definido no .env

**Solucao:**
```bash
# Gerar chave
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Adicionar ao .env
JWT_SECRET=<chave_gerada>
```

### "FATAL: JWT_SECRET must be at least 32 characters"

**Causa:** JWT_SECRET muito curto

**Solucao:** Use uma chave com pelo menos 32 caracteres (recomendado 64)

### "Account locked. Try again in X minutes."

**Causa:** Muitas tentativas de login falhas

**Solucao:**
1. Aguardar o tempo de lockout (15 min)
2. OU Admin desbloquear via `POST /api/auth/unlock/:userId`

### "Invalid origin - CSRF protection"

**Causa:** Requisicao de origem nao autorizada (ex.: abrir o app em
`http://192.168.x.x:3000` com `CORS_ORIGIN=http://localhost:3000`)

**Solucao:**
1. Incluir a origem na allowlist: `CORS_ORIGIN=http://localhost:3000,http://192.168.x.x:3000`
2. Ou, so em non-production: `CORS_ALLOW_PRIVATE_LAN=true`
3. Em produção, usar somente HTTPS em `CORS_ORIGIN` — o flag LAN é ignorado
4. Reiniciar o backend apos mudar o `.env`

---

Revise este guia quando a configuração de segurança ou a arquitetura do aplicativo mudar.
