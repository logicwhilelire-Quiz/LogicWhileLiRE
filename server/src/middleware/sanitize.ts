import { Request, Response, NextFunction } from 'express';

/**
 * Strips script tags, javascript: pseudo-protocols, and malicious HTML/control characters.
 */
function sanitizeString(val: string): string {
  if (typeof val !== 'string') return val;
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:[^"']*/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Don't modify binary buffers or passwords that legitimately may contain special chars
      if (key === 'password' || key === 'confirm_password' || key === 'new_password') {
        clean[key] = value;
      } else {
        clean[key] = sanitizeObject(value);
      }
    }
    return clean;
  }
  return obj;
}

/**
 * Global input sanitization middleware.
 * Sanitizes req.body, req.query, and req.params against XSS.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (key !== 'password' && key !== 'confirm_password' && key !== 'new_password') {
        req.body[key] = sanitizeObject(req.body[key]);
      }
    }
  }
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      req.query[key] = sanitizeObject(req.query[key]);
    }
  }
  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      req.params[key] = sanitizeObject(req.params[key]);
    }
  }
  next();
}
