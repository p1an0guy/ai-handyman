import type { Request, Response, NextFunction } from 'express';
import type { ErrorDetails, ErrorResponse } from '../models/index.js';

// Error handler middleware — must be registered AFTER all routes
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void { // eslint-disable-line @typescript-eslint/no-unused-vars
  if (isAppError(err)) {
    const statusCode = mapErrorCodeToStatus(err.code);
    const response: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      },
    };
    res.status(statusCode).json(response);
    return;
  }

  console.error('Unhandled error:', err);
  const response: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: {},
    },
  };
  res.status(500).json(response);
}

interface AppError {
  code: string;
  message: string;
  details?: ErrorDetails;
}

function isAppError(err: unknown): err is AppError {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}

function mapErrorCodeToStatus(code: string): number {
  switch (code) {
    case 'SESSION_NOT_FOUND':
    case 'MANUAL_NOT_FOUND':
    case 'JOB_NOT_FOUND':
      return 404;
    case 'VERSION_CONFLICT':
      return 409;
    case 'INVALID_TRANSITION':
    case 'STEP_MISMATCH':
    case 'INVALID_RESUME_TOKEN':
      return 400;
    case 'STORAGE_ERROR':
      return 503;
    default:
      return 500;
  }
}

export function requireBody(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === null);
    if (missing.length > 0) {
      const response: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required fields: ${missing.join(', ')}`,
          details: {},
        },
      };
      res.status(400).json(response);
      return;
    }
    next();
  };
}
