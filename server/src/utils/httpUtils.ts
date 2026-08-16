import type { NextFunction, Request, RequestHandler, Response } from "express";

/** 带状态码的业务错误（配合统一错误中间件） */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** 包装 async 路由：异常统一交给错误中间件（替代每个路由手写 try/catch） */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
