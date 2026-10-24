/**
 * MCP resource reads via JWT/PAT/stdio actor ACL — same gate as tools (flow mcp + grants).
 * Does not implement OAuth IdP or emit tokens.
 */

import { BadRequestError, ForbiddenError, NotFoundError } from '../../../app/errors/app-error.js';
import {
  getFlows,
  getUserGrants,
} from '../../access-control/application/access-control.service.js';
import { scopeFor } from '../../access-control/domain/permissions.js';
import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { matchMcpResourceUri } from '../domain/oauth-resource.js';
import {
  buildEstimateExplanationResourceBody,
  buildProjectContextResourceBody,
  listMcpResourceCatalogEntries,
} from '../domain/mcp-resource-body.js';

export const listMcpResourcesForActor = async (userId: number) => {
  const flows = await getFlows();
  if (!flows.mcp) throw new ForbiddenError('FLOW_DISABLED');
  const grants = await getUserGrants(userId);
  if (!scopeFor(grants, 'mcp.use')) throw new ForbiddenError('PERMISSION_DENIED');
  return listMcpResourceCatalogEntries();
};

export const readMcpResource = async (input: { userId: number; uri: string }) => {
  const flows = await getFlows();
  if (!flows.mcp) throw new ForbiddenError('FLOW_DISABLED');

  const grants = await getUserGrants(input.userId);
  if (!scopeFor(grants, 'mcp.use')) throw new ForbiddenError('PERMISSION_DENIED');

  const matched = matchMcpResourceUri(input.uri);
  if (!matched) throw new BadRequestError('UNKNOWN_MCP_RESOURCE');

  const templateUri = matched.template.uriTemplate;
  const uuid = matched.params.uuid;
  if (!uuid) throw new BadRequestError('UNKNOWN_MCP_RESOURCE');

  if (templateUri === 'tts://projects/{uuid}/context') {
    if (!scopeFor(grants, 'projects.read')) throw new ForbiddenError('PERMISSION_DENIED');
    const project = await prisma.project.findFirst({
      where: { uuid },
      select: {
        uuid: true,
        code: true,
        name: true,
        state: true,
        description: true,
        client: { select: { uuid: true, code: true, name: true } },
      },
    });
    if (!project) throw new NotFoundError('PROJECT_NOT_FOUND');
    const body = buildProjectContextResourceBody({
      uuid: project.uuid,
      code: project.code,
      name: project.name,
      state: project.state,
      description: project.description,
      client: project.client,
    });
    return {
      uri: input.uri,
      mimeType: matched.template.mimeType,
      status: 'ok' as const,
      content: body,
    };
  }

  if (templateUri === 'tts://estimates/{uuid}/explanation') {
    if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');
    if (!scopeFor(grants, 'estimates.read')) throw new ForbiddenError('PERMISSION_DENIED');
    const revision = await prisma.estimateRevision.findFirst({
      where: { uuid },
      include: {
        workActivity: {
          select: {
            uuid: true,
            title: true,
            state: true,
            id: true,
            timeEntries: {
              where: { deletedAt: null },
              select: { id: true },
              take: 50,
            },
          },
        },
      },
    });
    if (!revision) throw new NotFoundError('ESTIMATE_NOT_FOUND');

    const timeEntryIds = revision.workActivity.timeEntries.map((e) => e.id);
    const references =
      timeEntryIds.length === 0
        ? []
        : await prisma.estimationReference.findMany({
            where: { timeEntryId: { in: timeEntryIds } },
            orderBy: { collectedAt: 'desc' },
            take: 20,
            select: {
              uuid: true,
              kind: true,
              provider: true,
              externalId: true,
              title: true,
              uri: true,
            },
          });

    const body = buildEstimateExplanationResourceBody({
      uuid: revision.uuid,
      version: revision.version,
      baseMinutes: revision.baseMinutes,
      factor: Number(revision.factor),
      rawMinutes: Number(revision.rawMinutes),
      suggestedMinutes: revision.suggestedMinutes,
      roundingMode: revision.roundingMode,
      origin: revision.origin,
      algorithmVersion: revision.algorithmVersion,
      parameterRevisionUuid: revision.parameterRevisionUuid,
      reason: revision.reason,
      workActivity: {
        uuid: revision.workActivity.uuid,
        title: revision.workActivity.title,
        state: revision.workActivity.state,
      },
      allowedReferences: references.map((r) => ({
        uuid: r.uuid,
        kind: r.kind,
        provider: r.provider,
        externalId: r.externalId,
        title: r.title,
        uri: r.uri,
        isActualTrackedEvidence: false as const,
      })),
    });
    return {
      uri: input.uri,
      mimeType: matched.template.mimeType,
      status: 'ok' as const,
      content: body,
    };
  }

  throw new BadRequestError('UNKNOWN_MCP_RESOURCE');
};
