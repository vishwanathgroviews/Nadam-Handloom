import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Raw request body bytes, captured by express.json()'s verify callback — needed for webhook signature verification, where re-serializing the parsed JSON wouldn't reproduce the exact bytes that were signed. */
    rawBody?: Buffer;
  }
}
