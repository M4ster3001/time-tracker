# Dados sintéticos de demonstração

O seed de demonstração cria usuários, clientes e lançamentos fictícios para desenvolvimento. **Ele apaga registros existentes de usuários, clientes, lançamentos e dados relacionados.** Use somente em um banco descartável e local.

## Pré-requisitos

1. `backend/.env` deve apontar para um banco local isolado, por exemplo `127.0.0.1`.
2. Defina `NODE_ENV=development`.
3. Defina `ALLOW_DEMO_SEED=true` e `CONFIRM_DEMO_SEED_DELETE=I_UNDERSTAND_DELETE_ALL`.
4. Defina `DEMO_SEED_PASSWORD` com um valor local aleatório de pelo menos 16 caracteres. Todas as contas sintéticas geradas usarão essa senha.

Gere uma senha local aleatória:

```bash
node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"
```

Execute o comando somente depois de conferir a URL de banco:

```bash
npm run db:seed --workspace=backend
```

As contas usam endereços do domínio reservado `.test`; esses endereços não são caixas postais. O programa não imprime a senha configurada. A geração automática diária também é desligada por padrão e só pode ser usada em desenvolvimento.

Não habilite os flags de seed em ambiente compartilhado, staging com dados reais ou produção. A proteção do código não substitui backup, revisão da URL e confirmação manual do ambiente.
