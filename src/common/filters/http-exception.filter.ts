import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    const status = 
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = 
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Error interno del servidor' };

    const message = typeof errorResponse === 'string' 
      ? errorResponse 
      : (errorResponse as any).message || 'Error interno del servidor';

    this.logger.error(`[${request.method}] ${request.url} - Status: ${status} - Error: ${JSON.stringify(message)}`);

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    });
  }
}