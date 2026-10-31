// Errors the API sends to the app. `code` is stable and the app switches on it;
// `message` is plain English the app may show as is.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) => new AppError(400, code, message, details);
export const unauthorized = (code, message, details) => new AppError(401, code, message, details);
export const forbidden = (code, message, details) => new AppError(403, code, message, details);
export const notFound = (code, message, details) => new AppError(404, code, message, details);
export const conflict = (code, message, details) => new AppError(409, code, message, details);
export const locked = (message, details) => new AppError(423, 'LOCKED', message, details);
export const tooMany = (code, message, details) => new AppError(429, code, message, details);
export const unavailable = (code, message, details) => new AppError(503, code, message, details);
