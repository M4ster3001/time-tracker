# Instruções para agentes de código

Estas regras se aplicam a agentes de IA, bots e automações que leiam ou alterem este repositório. Elas complementam o [guia de contribuição](CONTRIBUTING.md) e o [guia de saúde do repositório](docs/operations/repository-health.md). Pessoas contribuidoras podem usá-las como checklist adicional.

## Antes de alterar

1. Leia o `README.md`, `CONTRIBUTING.md`, `SECURITY.md` e a documentação relacionada à área que pretende mudar.
2. Entenda o escopo solicitado e mantenha a alteração focada. Não faça refatorações amplas ou mudanças de produto sem relação com a tarefa.
3. Preserve contratos de API e regras existentes. Regras de autorização e validação devem ser aplicadas no backend, não apenas escondidas na interface.

## Segurança e limites de autorização

- Não abra, imprima, copie ou inclua arquivos `.env` reais, tokens, chaves, cookies, dados de clientes, registros de produção ou backups. Use apenas arquivos `.example` e dados sintéticos.
- Não coloque credenciais em código, issues, pull requests, fixtures, logs, documentação ou artefatos gerados.
- Não acesse nem altere ambientes de produção, não execute migrações contra serviços remotos e não faça compras, deploys, pushes, merges, releases ou alterações nas configurações do GitHub sem autorização explícita da pessoa responsável.
- Não amplie permissões de workflows nem adicione secrets de produção à CI. Prefira permissões mínimas e dados locais/efêmeros.
- Se encontrar uma credencial exposta, não a repita no relatório: interrompa o uso, informe o mantenedor de forma privada e recomende revogação/rotação.

## Implementação

- Mantenha regras de negócio no backend e atualize testes de domínio, API e interface conforme o impacto.
- Para mudanças de banco, inclua e revise migrações, seeds e documentação operacional; não use dados reais.
- Para mudanças de interface, preserve acessibilidade por teclado/leitor de tela, responsividade e os catálogos em português e inglês.
- Adicione dependências somente quando necessárias; revise licença, manutenção e vulnerabilidades. Não use `npm audit fix --force` para contornar alertas sem avaliar compatibilidade.
- Use apenas marcas, fontes, imagens e outros ativos cuja licença permita a distribuição proposta; mantenha os avisos exigidos.
- Não inclua caches, `node_modules`, builds locais, relatórios de teste ou arquivos secretos em commits.

## Verificação antes de concluir

Use a versão definida em `.nvmrc` e siga os comandos de instalação do README. Para alterações relevantes, execute:

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

Se uma verificação não puder ser executada, informe claramente qual e por quê. Não desative, omita ou afirme como aprovada uma verificação que falhou; investigue a causa ou relate a limitação para revisão humana.

## Entrega e revisão

Ao concluir, apresente um resumo do que mudou, os arquivos afetados, os comandos executados e seus resultados, além de riscos ou pendências. Não inclua valores de secrets nos relatórios. Uma pessoa mantenedora continua responsável por revisar e aprovar pull requests e por decidir merges, releases e publicação.
