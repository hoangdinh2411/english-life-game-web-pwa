import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';

interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: { error: { code: string; message: string } }): void;
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const codes: Record<number, string> = {
      400: 'bad_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found',
      409: 'conflict', 429: 'too_many_requests', 503: 'service_unavailable',
    };
    const message = status >= 500 ? 'Service unavailable' :
      exception instanceof HttpException ? exception.message : 'Internal server error';
    host.switchToHttp().getResponse<JsonResponse>().status(status).json({
      error: { code: codes[status] ?? 'internal_error', message },
    });
  }
}
