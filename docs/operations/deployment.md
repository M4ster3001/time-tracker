# Implantação e operação

A hospedagem é responsabilidade de quem opera esta cópia. O `docker-compose.yml` da raiz é uma base de desenvolvimento local, não uma topologia de produção pronta. Antes de expor a aplicação, monte uma implantação compatível com os requisitos da sua organização.

## Preparação

Defina um domínio e uma origem HTTPS exclusiva; termine TLS em um proxy reverso mantido; não publique diretamente MySQL, Redis ou a porta interna do backend. Use senhas aleatórias distintas para banco, JWT, integrações e contas administrativas. Armazene-as em um gerenciador de segredos e limite leitura/rotação.

Use uma conta de banco com privilégios mínimos. Restrinja CORS a origens necessárias, desative registro público quando não for intencional e mantenha o ambiente de demo/seed desligado. Configure e teste limites de requisição, logs, alertas, limpeza de sessões e retenção conforme sua política.

## Backups e recuperação

Escolha um destino de backup criptografado e separado do host principal, defina retenção e controle de acesso, e teste restauração regularmente em um ambiente isolado. Um arquivo criado sem teste de restauração não é um plano de recuperação. Não use o seed de demonstração em um banco que contenha dados importantes.

## Lançamento e atualização

Revise migrações, changelog, dependências e avisos de licença; rode type-check, testes, build e `npm run release:check`. Faça primeiro uma atualização de ensaio com cópia restaurável. Aplique atualizações de segurança do sistema base e das imagens de container, registre as versões implantadas e tenha plano de rollback compatível com as migrações.

## Checklist mínimo

- HTTPS, origem CORS explícita e serviços de banco/cache em rede privada.
- Segredos únicos fora do repositório, backup e restauração testados.
- Seed e geração diária desativados, sem contas ou senhas compartilhadas.
- Política de acesso, logging, retenção e resposta a incidentes documentados.
- Revisão de privacidade, termos aplicáveis e licenças de dependências/assets.

Para configurações específicas, consulte [variáveis de ambiente](../getting-started/environment-variables.md), [segurança](security-controls.md) e [privacidade](privacy.md).
