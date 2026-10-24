# Testes e qualidade

Os workspaces têm scripts independentes. No nível da raiz, os comandos são encaminhados pelo Turborepo.

```bash
npm ci
npm run type-check
npm run test
npm run build
npm run release:check
```

Os testes de backend usam Vitest e incluem testes unitários e cenários de integração. Alguns fluxos que precisam de MySQL exigem a configuração local correspondente; confira os scripts e a configuração do teste antes de habilitá-los. O frontend também usa Vitest; jornadas de navegador ficam em Playwright.

Para executar um workspace isoladamente:

```bash
npm run test --workspace=backend
npm run test --workspace=frontend
npm run test:e2e
```

Se uma alteração alterar migrations, permissões, formatos de exportação ou fluxos de aprovação, teste a integração completa com um banco descartável e atualize o guia correspondente. Não inclua snapshots com dados reais nem segredos em artefatos de teste.
