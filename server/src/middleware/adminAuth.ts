import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminJWTPayload {
  sub: string;  // admin username
  role: 'admin';
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminJWTPayload;
    }
  }
}

/**
 * Admin auth middleware.
 * Reads JWT from HttpOnly cookie 'admin_token'.
 * Uses a separate ADMIN_JWT_SECRET to prevent participant tokens
 * from being used on admin routes.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = req.cookies?.admin_token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

  if (!token) {
    res.status(401).json({ success: false, error: 'Admin authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminJWTPayload;
    if (payload.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Insufficient privileges' });
      return;
    }
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired admin token' });
  }
}
