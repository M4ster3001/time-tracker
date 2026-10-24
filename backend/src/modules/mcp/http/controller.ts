import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../../app/http/presenters/api.presenter.js';
import { BadRequestError, toAppError, UnauthorizedError } from '../../../app/errors/app-error.js';
import { config } from '../../../config.js';
import { invokeMcpTool, listAuthorizedMcpTools } from '../application/mcp-tools.service.js';
import {
  listMcpResourcesForActor,
  readMcpResource,
} from '../application/mcp-resources.service.js';
import {
  buildMcpOAuthResourceConfig,
  buildProtectedResourceMetadata,
  matchMcpResourceUri,
} from '../domain/oauth-resource.js';

export const listMcpToolsController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    sendSuccess(res, 200, {
      transport: 'streamable-http-stub',
      protocol: '2026-07-28',
      tools: await listAuthorizedMcpTools(req.user.userId),
    });
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

export const callMcpToolController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const toolName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!toolName) throw new BadRequestError('tool name is required');
    const result = await invokeMcpTool({
      userId: req.user.userId,
      toolName,
      arguments:
        req.body?.arguments && typeof req.body.arguments === 'object'
          ? (req.body.arguments as Record<string, unknown>)
          : {},
    });
    sendSuccess(res, 200, { name: toolName, result });
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

/** Discovery stub — sem IdP; status not_configured ate env MCP_OAUTH_* preenchido. */
export const mcpProtectedResourceMetadataController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const metadata = buildProtectedResourceMetadata(
    buildMcpOAuthResourceConfig({
      resourceUri: config.mcp.oauth.resourceUri,
      authorizationServers: config.mcp.oauth.authorizationServers,
      scopesSupported: config.mcp.oauth.scopesSupported,
      documentationUrl: config.mcp.oauth.documentationUrl,
    })
  );
  res.status(200).json(metadata);
};

export const listMcpResourceTemplatesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const resources = await listMcpResourcesForActor(req.user.userId);
    sendSuccess(res, 200, {
      transport: 'streamable-http-stub',
      resourcesImplemented: true,
      authNote:
        'Resource bodies served under JWT/PAT (same as tools). OAuth IdP discovery remains separate and blocked-on-host.',
      resources,
    });
  } catch (error) {
    sendError(res, toAppError(error));
  }
};

/** Leitura ACL-gated via JWT/PAT — nao exige IdP OAuth live. */
export const resolveMcpResourceStubController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const uri = typeof req.query.uri === 'string' ? req.query.uri : '';
    if (!uri) throw new BadRequestError('uri query is required');
    const matched = matchMcpResourceUri(uri);
    if (!matched) throw new BadRequestError('UNKNOWN_MCP_RESOURCE');
    const result = await readMcpResource({ userId: req.user.userId, uri });
    sendSuccess(res, 200, {
      uri: result.uri,
      template: matched.template.uriTemplate,
      params: matched.params,
      mimeType: result.mimeType,
      content: result.content,
      status: result.status,
      note: 'Body served with JWT/PAT ACL; OAuth protected-resource IdP still blocked-on-host.',
    });
  } catch (error) {
    sendError(res, toAppError(error));
  }
};
