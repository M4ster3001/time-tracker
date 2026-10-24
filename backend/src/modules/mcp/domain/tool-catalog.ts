/**
 * MCP-01/02 — catalogo de ferramentas (plano §6.2).
 * Mesmo ACL do portal; sem aprovacao financeira no catalogo inicial.
 */

import type { Grant, Permission } from '../../access-control/domain/permissions.js';
import { scopeFor } from '../../access-control/domain/permissions.js';

export type McpToolDefinition = {
  name: string;
  description: string;
  effect: 'read' | 'propose';
  requiredPermission: Permission;
};

export const FORBIDDEN_MCP_TOOLS = [
  'closing.approve',
  'closing.submit',
  'closing.recalculate',
  'balances.write',
  'access.manage',
  'time_entries.confirm_duration',
  'work_activities.confirm_duration',
] as const;

const CATALOG: McpToolDefinition[] = [
  {
    name: 'clients.list',
    description: 'Lista clientes autorizados',
    effect: 'read',
    requiredPermission: 'clients.read',
  },
  {
    name: 'projects.list',
    description: 'Lista projetos autorizados',
    effect: 'read',
    requiredPermission: 'projects.read',
  },
  {
    name: 'activities.get',
    description: 'Consulta atividade (WorkActivity) autorizada',
    effect: 'read',
    requiredPermission: 'estimates.read',
  },
  {
    name: 'time_entries.list',
    description: 'Lista apontamentos permitidos',
    effect: 'read',
    requiredPermission: 'time.read',
  },
  {
    name: 'time_entries.propose',
    description:
      'Prepara proposta de apontamento para revisao humana (nao cria apontamento reconhecido)',
    effect: 'propose',
    requiredPermission: 'time.write',
  },
  {
    name: 'estimation_parameters.list',
    description: 'Lista revisoes de parametros aplicaveis',
    effect: 'read',
    requiredPermission: 'estimates.read',
  },
  {
    name: 'estimates.preview',
    description: 'Calcula previa de estimativa sem persistir',
    effect: 'propose',
    requiredPermission: 'estimates.propose',
  },
  {
    name: 'estimates.create_proposal',
    description: 'Persiste rascunho de proposta (nao confirma horas)',
    effect: 'propose',
    requiredPermission: 'estimates.propose',
  },
  {
    name: 'estimates.link_reference',
    description:
      'Vincula evidencia commit/PR/issue (EstimationReference); nunca Actual Tracked Duration',
    effect: 'propose',
    requiredPermission: 'estimates.propose',
  },
];

export type McpFlowFlags = {
  mcp: boolean;
  estimates: boolean;
};

export const listMcpToolsForGrants = (
  grants: Grant[],
  flows: McpFlowFlags
): McpToolDefinition[] => {
  if (!flows.mcp) return [];
  if (!scopeFor(grants, 'mcp.use')) return [];

  return CATALOG.filter((tool) => {
    if (
      (tool.name.startsWith('estimates.') ||
        tool.name === 'estimation_parameters.list' ||
        tool.name === 'activities.get') &&
      !flows.estimates
    ) {
      return false;
    }
    return scopeFor(grants, tool.requiredPermission) != null;
  });
};

export const resolveMcpToolPermission = (toolName: string): Permission | null => {
  if ((FORBIDDEN_MCP_TOOLS as readonly string[]).includes(toolName)) return null;
  return CATALOG.find((t) => t.name === toolName)?.requiredPermission ?? null;
};
