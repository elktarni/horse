import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  adminId: string;
  email: string;
}

export const authMiddleware = (
  req: Request & { admin?: AuthPayload },
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      success: false,
      data: null,
      message: 'Access denied. No token provided.',
    });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({
      success: false,
      data: null,
      message: 'Invalid or expired token.',
    });
  }
};
