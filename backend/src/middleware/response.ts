import { Request, Response, NextFunction } from 'express';

export type ApiResponse = {
  success: boolean;
  data: unknown;
  message: string;
};

export const apiResponse = (
  res: Response,
  success: boolean,
  data: unknown,
  message: string,
  statusCode: number = 200
): Response => {
  return res.status(statusCode).json({
    success,
    data,
    message,
  });
};
