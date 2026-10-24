# Funcionalidades

O aplicativo combina apontamento, organização de trabalho e revisão de horas. Os recursos abaixo descrevem a estrutura do código; o que cada pessoa vê depende de seu perfil, permissões, dados cadastrados e fluxos ativados pela organização.

| Área | O que oferece |
| --- | --- |
| Registro de horas | Lançamentos manuais, apontamento rápido e sessões de timer. |
| Organização | Clientes, projetos, alocações e associação de lançamentos a trabalho realizado. |
| Equipes | Perfis de administrador, gerente e consultor, com escopos distintos. |
| Revisão | Fechamentos de período, análise de pendências e fluxos de aprovação configuráveis. |
| Acompanhamento | Painéis, saldos, histórico, exportação e visão por equipe/cliente conforme permissões. |
| Integrações | Google Calendar, IA, Redis e MCP como opções independentes. |

Administradores mantêm a configuração geral e os registros mestres. Gerentes acompanham clientes e equipes atribuídos. Consultores registram e revisam o próprio trabalho conforme as regras da organização. A implementação de permissões no backend é a fonte de autoridade; consulte [regras de negócio](business-rules.md), [fluxos](workflows.md) e [API](../development/api-endpoints.md) ao adaptar esses perfis.

Organizações diferem em critérios de faturamento, fechamento, feriados, retenção e aprovações. Personalize essas regras conscientemente e inclua testes. Não interprete relatórios como validação automática de faturamento, folha, contabilidade ou conformidade legal.
