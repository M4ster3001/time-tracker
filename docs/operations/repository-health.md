# Saúde e manutenção do repositório

Este guia reúne práticas para manter o código-fonte confiável e o projeto sustentável no GitHub. Ele complementa, mas não substitui, os guias de [implantação](deployment.md), [segurança](security-controls.md) e [privacidade](privacy.md).

As práticas deste documento valem igualmente para pessoas contribuidoras, agentes de código e automações. Agentes devem seguir também as [instruções específicas para agentes](../../AGENTS.md); ninguém deve contornar as revisões humanas para merges ou releases.

## Automação já incluída

- `.github/workflows/ci.yml` executa auditoria npm, geração/migração do Prisma, lint, type-check, testes unitários, build, E2E e checagem de distribuição em pull requests e pushes para `main` ou `master`.
- `.github/dependabot.yml` agenda atualizações semanais de dependências npm, GitHub Actions e imagens-base dos Dockerfiles.
- Os formulários de issue e o template de pull request ajudam a coletar contexto reproduzível e a lembrar as verificações de qualidade.
- O badge **CI** no README mostra o status do workflow para o branch padrão. Ele só passa a mostrar execuções depois que o arquivo de workflow estiver no GitHub e a primeira execução começar.

## Proteja o branch padrão

Em **Settings → Rules → Rulesets** (ou **Settings → Branches**, conforme a interface do GitHub), crie uma regra para o branch padrão, normalmente `main`:

1. Exija pull request antes de integrar mudanças. Para um projeto de uma pessoa só, não configure uma aprovação obrigatória que ninguém além de você possa fornecer.
2. Depois da primeira execução da pipeline, exija o status check do job `quality` antes do merge.
3. Exija a resolução das conversas de revisão e bloqueie force-push e exclusão do branch padrão.
4. Se houver mais de uma pessoa mantenedora, exija ao menos uma aprovação e descarte aprovações antigas quando novos commits alterarem o pull request.
5. Opcionalmente, habilite exclusão automática dos branches de pull request após o merge.

Mantenha `main` ou o branch padrão real incluído nos gatilhos do workflow em `.github/workflows/ci.yml`. Evite proteger `main` se o repositório usa outro branch sem adaptar a regra.

## Segurança do GitHub e permissões

- Em **Settings → Security**, habilite o gráfico de dependências, alertas e atualizações de segurança do Dependabot, além de secret scanning e push protection quando disponíveis.
- Habilite o reporte privado de vulnerabilidades para que o canal descrito em [`SECURITY.md`](../../SECURITY.md) funcione para quem reporta.
- Mantenha as permissões padrão de Actions no mínimo necessário. O workflow fornecido declara `contents: read` e não precisa de credenciais de produção.
- Nunca coloque tokens, chaves, dados reais ou secrets de implantação em workflows de CI, issues, fixtures ou logs. Pull requests vindos de forks não devem receber secrets de produção.
- Se uma credencial aparecer em um commit, revogue-a e gere outra imediatamente. Apagar o arquivo em um commit posterior não remove o segredo do histórico.

## Dependências e atualizações

O Dependabot agrupa atualizações compatíveis menores/patch de npm para reduzir ruído; versões major permanecem em pull requests separados. Revise cada pull request, leia mudanças incompatíveis e exija CI verde antes do merge. Não habilite auto-merge de majors sem revisão e testes adequados.

Para investigar uma vulnerabilidade localmente, use `npm audit`. Atualize o lockfile com mudanças deliberadas, sem recorrer a `npm audit fix --force` como primeira resposta: isso pode introduzir breaking changes. Rode novamente lint, type-check, testes, build e E2E; revise também migrações e integração com o banco quando aplicável.

## Rotina de manutenção

| Frequência | Ações recomendadas |
| --- | --- |
| Semanal | Revisar falhas recentes de CI, pull requests do Dependabot e issues novas; responder, reproduzir ou pedir informações. |
| Mensal | Conferir alertas de segurança, dependências sem suporte, branches abandonados e se a documentação de instalação continua correta. |
| A cada release | Rodar as verificações abaixo, revisar `LICENSE` e avisos de terceiros, preparar notas de versão e confirmar que nenhum segredo ou dado real entrou no pacote. |

Use labels consistentes (`bug`, `enhancement`, `documentation`, `security`) e atribua responsáveis quando houver mantenedores disponíveis. Evite fechar issues automaticamente apenas por inatividade sem antes avaliar se continuam válidas.

## Checklist de release

Na raiz do repositório, execute:

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

Para cada versão pública, use uma tag SemVer (por exemplo, `v1.2.0`) e notas de release que resumam mudanças visíveis, migrações/configurações necessárias, incompatibilidades e problemas conhecidos. Aguarde o CI verde antes de publicar a release. Não distribua `node_modules`, builds locais, `.env` reais, backups ou dados de teste que contenham informações pessoais.
