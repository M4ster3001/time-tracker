# Guia do Frontend - Time Tracker System

Este guia explica a arquitetura, seguranca e configuracao do frontend React.

---

## Indice

1. [Arquitetura](#1-arquitetura)
2. [Autenticacao](#2-autenticacao)
3. [Rotas e Permissoes](#3-rotas-e-permissoes)
4. [API Client](#4-api-client)
5. [Estado Global](#5-estado-global)
6. [Seguranca](#6-seguranca)
7. [Variaveis de Ambiente](#7-variaveis-de-ambiente)
8. [Build e Deploy](#8-build-e-deploy)

---

## 1. Arquitetura

### Estrutura de Pastas

```
frontend/src/
├── components/          # Componentes reutilizaveis
│   ├── AppShell.tsx    # Layout principal
│   ├── ProtectedRoute.tsx  # Wrapper de rota autenticada
│   ├── RoleRoute.tsx   # Wrapper de rota por role
│   └── Sidebar.tsx     # Menu lateral
├── contexts/
│   └── AuthContext.tsx # Contexto de autenticacao
├── pages/              # Paginas (uma por rota)
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   └── ...
├── services/
│   ├── api.ts          # Cliente Axios configurado
│   └── tokenStore.ts   # Armazenamento de token em memoria
├── App.tsx             # Definicao de rotas
└── main.tsx            # Ponto de entrada
```

### Stack Tecnologico

| Tecnologia | Versao | Uso |
|------------|--------|-----|
| React | 18.2.0 | UI Library |
| React Router | 6.20.1 | Roteamento |
| Axios | 1.6.5 | Cliente HTTP |
| Tailwind CSS | 3.3.6 | Estilizacao |
| Vite | 5.0.8 | Build tool |
| TypeScript | 5.3.3 | Tipagem |

---

## 2. Autenticacao

### Fluxo de Autenticacao

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE AUTENTICACAO                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Usuario acessa a aplicacao                              │
│     ↓                                                        │
│  2. AuthProvider tenta refresh (POST /api/auth/refresh)     │
│     ↓                                                        │
│  3a. Se sucesso: Usuario autenticado, redireciona dashboard │
│  3b. Se falha: Mostra tela de login                         │
│     ↓                                                        │
│  4. Usuario faz login                                       │
│     ↓                                                        │
│  5. Token JWT armazenado em MEMORIA (nao localStorage)      │
│     ↓                                                        │
│  6. Refresh token armazenado em cookie httpOnly pelo server │
│     ↓                                                        │
│  7. Usuario navega pela aplicacao                           │
│     ↓                                                        │
│  8. Token expira (401) → Auto-refresh via interceptor       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### AuthContext

**Arquivo:** `frontend/src/contexts/AuthContext.tsx`

```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

### Uso do AuthContext

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return (
    <div>
      <p>Ola, {user.name}!</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}
```

### Armazenamento de Token

**IMPORTANTE:** O token JWT e armazenado APENAS em memoria, nao em localStorage ou sessionStorage.

**Arquivo:** `frontend/src/services/tokenStore.ts`

```typescript
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => { accessToken = token; };
export const clearAccessToken = () => { accessToken = null; };
```

**Por que em memoria?**
- Protecao contra XSS (scripts maliciosos nao podem acessar)
- Token perdido ao fechar aba (refresh token mantem sessao)
- Mais seguro que localStorage

---

## 3. Rotas e Permissoes

### Sistema de Roles

| roleId | Role | Descricao |
|--------|------|-----------|
| 1 | Admin | Acesso total ao sistema |
| 2 | Manager | Gerencia consultores e clientes |
| 3 | Consultant | Registra horas proprias |

### Mapa de Rotas

```typescript
// Rotas publicas
/login          → LoginPage
/register       → RegisterPage

// Rotas autenticadas (qualquer role)
/dashboard      → DashboardPage (dispatcher por role)
/export         → ExportPage

// Rotas de Consultant (role 3)
/time-entries           → TimeEntriesListPage
/time-entries/new       → TimeEntryPage
/time-entries/:id/edit  → TimeEntryPage
/time-entries/bulk      → BulkTimeEntryPage

// Rotas de Manager (role 2)
/dashboard/team         → DashboardManagerPage
/manager/clients        → ManagerClientsPage
/manager/consultants    → ManagerAllocationsPage

// Rotas de Admin (role 1)
/admin/users           → UsersPage
/admin/clients         → ClientsPage
/admin/consultants     → ManagerConsultantsPage
/admin/managers        → AdminManagerAllocationsPage
/admin/audit           → AuditLogsPage
/admin/export          → ExportPage
```

### Componentes de Protecao

**ProtectedRoute** - Requer autenticacao:

```typescript
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>
```

**RoleRoute** - Requer role especifica:

```typescript
<RoleRoute allowedRoles={[1, 2]}>
  <ManagerDashboard />  {/* Apenas Admin e Manager */}
</RoleRoute>
```

### Exemplo de Uso no App.tsx

```typescript
<Routes>
  {/* Publicas */}
  <Route path="/login" element={<LoginPage />} />

  {/* Autenticadas */}
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  } />

  {/* Por role */}
  <Route path="/admin/users" element={
    <ProtectedRoute>
      <RoleRoute allowedRoles={[1]}>
        <UsersPage />
      </RoleRoute>
    </ProtectedRoute>
  } />
</Routes>
```

---

## 4. API Client

### Configuracao Base

**Arquivo:** `frontend/src/services/api.ts`

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true,  // Envia cookies automaticamente
});
```

### Interceptor de Request

Adiciona token JWT automaticamente:

```typescript
api.interceptors.request.use((config) => {
  if (!config.skipAuth) {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
```

### Interceptor de Response (Auto-Refresh)

Renova token automaticamente em caso de 401:

```typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);
```

### Uso em Componentes

```typescript
import api from '../services/api';

// GET
const { data } = await api.get('/api/users');

// POST
await api.post('/api/time-entries', { clientId, date, duration });

// PUT
await api.put(`/api/users/${id}`, { name, email });

// DELETE
await api.delete(`/api/users/${id}`);

// Skip auth (para refresh)
await api.post('/api/auth/refresh', {}, { skipAuth: true });
```

---

## 5. Estado Global

### AuthContext (Principal)

Estado de autenticacao compartilhado via React Context.

```typescript
// Provedor no App.tsx
<AuthProvider>
  <App />
</AuthProvider>

// Consumo em componentes
const { user, isAuthenticated } = useAuth();
```

### Estado Local

Cada pagina gerencia seu proprio estado com `useState`:

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [data, setData] = useState<Data[]>([]);
```

### LocalStorage (Apenas Preferencias)

Usado apenas para preferencias de UI, nunca para dados sensiveis:

```typescript
// OK - Preferencia de visualizacao
localStorage.setItem('managerDashboardView', 'table');

// NUNCA - Dados sensiveis
// localStorage.setItem('token', token); ← PROIBIDO
```

---

## 6. Seguranca

### Boas Praticas Implementadas

| Pratica | Implementacao |
|---------|---------------|
| Token em memoria | `tokenStore.ts` |
| Cookies httpOnly | Servidor configura |
| CSRF via SameSite | Cookie `sameSite: strict` |
| Auto-refresh | Interceptor Axios |
| Protecao de rotas | `ProtectedRoute`, `RoleRoute` |
| Validacao de roles | Client + Server |

### O que NAO Fazer

```typescript
// ❌ NUNCA armazenar token em localStorage
localStorage.setItem('token', token);

// ❌ NUNCA expor dados sensiveis em URL
navigate(`/users?password=${password}`);

// ❌ NUNCA confiar apenas em validacao client-side
if (user.roleId === 1) { /* admin */ }
// (Server SEMPRE deve validar tambem)

// ❌ NUNCA desabilitar seguranca do Axios
axios.defaults.withCredentials = false;
```

### Validacao de Roles

**IMPORTANTE:** A validacao de roles no frontend e apenas para UX. O backend SEMPRE valida permissoes.

```typescript
// Frontend (UX only)
{user.roleId === 1 && <AdminMenu />}

// Backend (real security)
app.get('/api/users', authMiddleware, adminMiddleware, listUsers);
```

---

## 7. Variaveis de Ambiente

### Arquivo `.env` (Local)

```env
VITE_API_URL=http://localhost:5000
```

### Arquivo `.env.production` (Producao)

```env
VITE_API_URL=https://api.seudominio.com
```

### Uso no Codigo

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

### Importante sobre Vite

- Variaveis devem comecar com `VITE_`
- Sao injetadas no build (estaticas)
- NAO colocar secrets no frontend

---

## 8. Build e Deploy

### Comandos

```bash
# Desenvolvimento
yarn dev

# Build producao
yarn build

# Preview do build
yarn preview

# Type check
yarn type-check

# Lint
yarn lint
```

### Estrutura do Build

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js      # Bundle principal
│   ├── index-[hash].css     # Estilos
│   └── vendor-[hash].js     # Dependencias (se code-split)
└── ...
```

### Deploy com Docker

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Configuracao Nginx

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache de assets
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

---

## Troubleshooting

### "Network Error" em todas requisicoes

**Causa:** CORS ou backend offline

**Solucao:**
1. Verificar se backend esta rodando
2. Verificar `VITE_API_URL` no `.env`
3. Verificar `CORS_ORIGIN` no backend

### Token perdido ao atualizar pagina

**Comportamento esperado:** Token em memoria e perdido ao refresh.

**Solucao:** O sistema usa refresh token (cookie) para obter novo JWT automaticamente.

### "401 Unauthorized" em loop

**Causa:** Refresh token expirado ou revogado

**Solucao:**
1. Limpar cookies do navegador
2. Fazer login novamente

### Rota protegida mostra brevemente antes de redirecionar

**Causa:** Loading state do AuthContext

**Solucao:** O `ProtectedRoute` ja mostra loading durante verificacao.

```typescript
if (loading) {
  return <LoadingSpinner />;
}
```

---

## Checklist para Producao

- [ ] `VITE_API_URL` aponta para API de producao
- [ ] Build otimizado (`yarn build`)
- [ ] Assets com hash para cache-busting
- [ ] Nginx configurado para SPA
- [ ] HTTPS configurado
- [ ] Headers de seguranca no servidor

---

*Documento atualizado em: 01/02/2026*
