/**
 * MCP resource catalog + safe JSON body shapes for tts:// reads.
 * Bodies are ACL-gated by the application layer (JWT/PAT/stdio actor) — not OAuth IdP.
 */

import { MCP_RESOURCE_TEMPLATES } from './oauth-resource.js';

export type McpResourceCatalogEntry = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
};

export const listMcpResourceCatalogEntries = (): McpResourceCatalogEntry[] =>
  MCP_RESOURCE_TEMPLATES.map((t) => ({
    uri: t.uriTemplate,
    name: t.name,
    description: t.description,
    mimeType: t.mimeType,
  }));

export type ProjectContextInput = {
  uuid: string;
  code: string;
  name: string;
  state: string;
  description: string | null;
  client: { uuid: string; code: string; name: string };
};

export const buildProjectContextResourceBody = (input: ProjectContextInput) => ({
  kind: 'project_context' as const,
  project: {
    uuid: input.uuid,
    code: input.code,
    name: input.name,
    state: input.state,
    description: input.description,
  },
  client: input.client,
  note: 'Minimal project context; ACL revalidated on read; financial fields omitted',
});

export type EstimateExplanationReferenceInput = {
  uuid: string;
  kind: string;
  provider: string;
  externalId: string;
  title: string | null;
  uri: string | null;
  isActualTrackedEvidence: false;
};

export type EstimateExplanationInput = {
  uuid: string;
  version: number;
  baseMinutes: number;
  factor: number;
  rawMinutes: number;
  suggestedMinutes: number;
  roundingMode: string;
  origin: string;
  algorithmVersion: string;
  parameterRevisionUuid: string | null;
  reason: string | null;
  workActivity: { uuid: string; title: string; state: string };
  allowedReferences: EstimateExplanationReferenceInput[];
};

export const buildEstimateExplanationResourceBody = (input: EstimateExplanationInput) => ({
  kind: 'estimate_explanation' as const,
  confirmed: false as const,
  isActualTracked: false as const,
  revision: {
    uuid: input.uuid,
    version: input.version,
    baseMinutes: input.baseMinutes,
    factor: input.factor,
    rawMinutes: input.rawMinutes,
    suggestedMinutes: input.suggestedMinutes,
    roundingMode: input.roundingMode,
    origin: input.origin,
    algorithmVersion: input.algorithmVersion,
    parameterRevisionUuid: input.parameterRevisionUuid,
    reason: input.reason,
  },
  workActivity: input.workActivity,
  allowedReferences: input.allowedReferences,
  note: 'Estimate explanation is evidence/formula only — not Actual Tracked Duration; never confirms hours',
});
