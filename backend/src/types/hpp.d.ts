declare module 'hpp' {
  import { RequestHandler } from 'express';
  function hpp(options?: { whitelist?: string | string[] }): RequestHandler;
  export = hpp;
}
