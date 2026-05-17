import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Cambiamos la fuente de extracción
    const token = this.extractTokenFromCookie(request);
    
    if (!token) {
      throw new UnauthorizedException('No tienes autorización para realizar esta acción.');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'super_secret_costream_key_2026',
      });
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('El token es inválido o ha expirado.');
    }
    return true;
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies?.jwt; // Asumimos que nombraremos a la cookie como 'jwt'
  }
}