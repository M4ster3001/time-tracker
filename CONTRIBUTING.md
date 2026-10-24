# Como contribuir

Obrigado por querer melhorar o Time Tracker. Contribuições de pessoas e empresas são bem-vindas, desde que respeitem a licença do projeto e os direitos dos componentes de terceiros.

## Antes de começar

1. Leia o [README](README.md), as [instruções para agentes e automações](AGENTS.md), o [índice da documentação](docs/README.md) e a [política de segurança](SECURITY.md).
2. Para mudanças grandes, abra uma discussão/issue antes de investir em uma implementação extensa.
3. Nunca inclua dados de clientes, registros de produção, tokens, chaves ou arquivos `.env` em issues, testes ou pull requests.
4. Consulte as [práticas de saúde e manutenção do repositório](docs/operations/repository-health.md), incluindo as regras para CI e atualizações de dependências.

## Fluxo sugerido

1. Crie uma branch com um nome curto, como `feat/export-filter` ou `fix/login-error`.
2. Faça uma alteração focada e inclua testes quando alterar regras de negócio, API ou comportamento da interface.
3. Atualize a documentação quando mudar configuração, fluxos, permissões ou instalação.
4. Rode localmente os comandos relevantes:

   ```bash
   npm ci
   npm audit --audit-level=high
   npm run lint:ci
   npm run type-check
   npm run test
   npm run build
   npm run test:e2e --workspace=frontend
   npm run release:check
   ```

5. Abra um pull request explicando problema, solução, impacto, configuração adicional e como testar.

## Convenções

- Prefira nomes que expliquem a responsabilidade do módulo.
- Mantenha regras de negócio no backend; a interface não deve ser a única barreira de autorização.
- Evite adicionar segredos, exemplos de senhas reutilizáveis ou dados pessoais mesmo em fixtures.
- Preserve a acessibilidade por teclado, leitores de tela e telas pequenas.
- Mantenha o idioma português claro; quando a interface oferecer português e inglês, atualize ambos os catálogos.

## Licença

Ao submeter uma contribuição intencionalmente, você concorda que ela poderá ser distribuída sob a licença MIT deste repositório, respeitando os direitos autorais aplicáveis. Se sua organização exige um acordo de contribuição, resolva isso com os mantenedores antes do envio.
