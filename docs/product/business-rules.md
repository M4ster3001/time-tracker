# Regras de negócio

O sistema associa registros de trabalho a pessoas e clientes e, conforme os módulos habilitados, a projetos, equipes, alocações e períodos de fechamento. A identidade da pessoa e suas permissões determinam quais registros podem ser criados, consultados ou revisados.

## Lançamentos

Um apontamento deve identificar quem realizou o trabalho, a data, o escopo permitido, a duração e uma descrição adequada. A API aplica validações de formato, limites e período; a interface também ajuda a prevenir erros, mas não é uma barreira de segurança.

## Clientes, projetos e equipe

Clientes e projetos são dados de referência para organizar o trabalho. Atribuições e escopos de gerente limitam quais equipes e carteiras ficam visíveis. Ao alterar papéis, associações ou hierarquias, atualize os testes de autorização e confirme que usuários não conseguem ler registros fora de seu escopo.

## Períodos e fechamento

Fechamento, bloqueio, revisão e aprovação são fluxos configuráveis que podem afetar a edição de horas. Reabertura ou desbloqueio deve ser controlado e auditável. Antes de adaptar as regras, leia [fluxos](workflows.md) e [desbloqueios temporários](temporary-unlocks.md).

## Saldos, faturamento e conformidade

Os saldos e relatórios são derivados dos dados registrados e das regras codificadas. Eles não constituem, por si só, cálculo oficial de folha, contabilidade, tributação, faturamento ou conformidade trabalhista. A empresa que implanta o sistema deve validar seus critérios, arredondamento, fuso horário, retenção e aprovação com profissionais responsáveis.
