import type { Express, RequestHandler } from 'express';
import {
  callMcpToolController,
  listMcpResourceTemplatesController,
  listMcpToolsController,
  mcpProtectedResourceMetadataController,
  resolveMcpResourceStubController,
} from './controller.js';

/** MCP-01/02: adaptador HTTP stub (mesma ACL do portal). stdio fica para host local. */
export const registerMcpRoutes = (
  app: Express,
  authMiddleware: RequestHandler[],
  limiter: RequestHandler
): void => {
  // Public discovery stub (no tokens issued). Safe even when flow mcp is off.
  app.get(
    '/.well-known/oauth-protected-resource',
    limiter,
    mcpProtectedResourceMetadataController
  );
  app.get('/api/mcp/tools', ...authMiddleware, limiter, listMcpToolsController);
  app.post('/api/mcp/tools/call', ...authMiddleware, limiter, callMcpToolController);
  app.get('/api/mcp/resources', ...authMiddleware, limiter, listMcpResourceTemplatesController);
  app.get('/api/mcp/resources/resolve', ...authMiddleware, limiter, resolveMcpResourceStubController);
};
