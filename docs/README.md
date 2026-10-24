# Documentação do Time Tracker

Este índice agrupa os guias por objetivo. Os índices de cada pasta listam também as referências técnicas mais detalhadas.

## Quero instalar, configurar ou personalizar

- [Primeiros passos](getting-started/README.md)
- [Instalação local e Docker Compose](getting-started/installation.md)
- [Variáveis de ambiente](getting-started/environment-variables.md)
- [Personalizar nome, cores, ícone e idioma](getting-started/customization.md)
- [Dados sintéticos de demonstração](getting-started/demo-data.md)

## Quero entender o produto

- [Visão de funcionalidades](product/features.md)
- [Regras de negócio](product/business-rules.md)
- [Fluxos principais](product/workflows.md)
- [Relatórios e exportações](product/exports.md)
- [Desbloqueios temporários](product/temporary-unlocks.md)

## Quero desenvolver ou integrar

- [Arquitetura](development/architecture.md)
- [Guia de desenvolvimento](development/README.md)
- [Referência de API](development/api-endpoints.md) e [evolução da API](development/api-evolution.md)
- [Guia do frontend](development/frontend.md)
- [Acessibilidade](development/accessibility.md)
- [Tratamento de erros](development/error-handling.md)
- [Integrações](integrations/README.md)

## Quero operar com responsabilidade

- [Implantação e operação](operations/deployment.md)
- [Controles de segurança](operations/security-controls.md)
- [Privacidade e dados](operations/privacy.md)
- [Política de reporte de vulnerabilidades](../SECURITY.md)

## Diagramas

- [Arquitetura e ciclo de um lançamento](diagrams/README.md) — Mermaid editável e prévias PNG.

## Estrutura

```text
docs/
├── getting-started/   instalação, configuração, personalização e seed
├── product/           funcionalidades, regras e fluxos
├── development/       arquitetura, API, frontend, testes e acessibilidade
├── integrations/      Google Calendar, IA e MCP
├── operations/        implantação, segurança e privacidade
└── diagrams/          fontes Mermaid e imagens renderizadas
```
