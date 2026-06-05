import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { extractAndCleanJwt } from './utils/cookie.util'; 

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const token = extractAndCleanJwt(request.cookies);
    
    if (!token) {
      throw new UnauthorizedException('No tienes autorización para realizar esta acción.');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'super_secret_costream_key_2026',
      });
      request['user'] = payload;
      return true;
      
    } catch (error) {
      console.error('Fallo en verificación JWT HTTP:', error.message);
      
      if (response && typeof response.clearCookie === 'function') {
        response.clearCookie('jwt');
      }
      
      throw new UnauthorizedException('El token es inválido o ha expirado.');
    }
  }
}