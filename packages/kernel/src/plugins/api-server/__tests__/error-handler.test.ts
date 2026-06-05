import { describe, it, expect, vi } from 'vitest';
import { globalErrorHandler, NotFoundError, AuthError } from '../middleware/error-handler.js';
import { ZodError, z } from 'zod';

function mockReply() {
  const reply: any = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    sent: false,
  };
  return reply;
}

describe('globalErrorHandler', () => {
  it('handles ZodError as 400 VALIDATION_ERROR', () => {
    const schema = z.object({ name: z.string() });
    let zodError: ZodError;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      zodError = e as ZodError;
    }

    const reply = mockReply();
    globalErrorHandler(zodError!, {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        statusCode: 400,
        details: expect.any(Array),
      },
    });
  });

  it('handles NotFoundError as 404', () => {
    const reply = mockReply();
    globalErrorHandler(new NotFoundError('SESSION_NOT_FOUND', 'Session not found'), {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
        statusCode: 404,
      },
    });
  });

  it('handles AuthError as 401', () => {
    const reply = mockReply();
    globalErrorHandler(new AuthError('UNAUTHORIZED', 'Invalid token'), {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
        statusCode: 401,
      },
    });
  });

  it('handles AuthError with 403 status', () => {
    const reply = mockReply();
    globalErrorHandler(new AuthError('FORBIDDEN', 'Insufficient permissions', 403), {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        statusCode: 403,
      },
    });
  });

  it('handles unknown errors as 500 INTERNAL_ERROR', () => {
    const reply = mockReply();
    globalErrorHandler(new Error('something broke'), {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        statusCode: 500,
      },
    });
  });
});
