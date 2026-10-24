declare module 'hpp' {
  import type { RequestHandler } from 'express';

  const hpp: (options?: { whitelist?: string[] }) => RequestHandler;

  export default hpp;
}
