import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, passwordPlain: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Esta cuenta usa inicio de sesión con Google. Por favor, usa "Iniciar sesión con Google".');
    }

    const isPasswordValid = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: 'HOST',
      avatar: user.avatar 
    };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }

  async loginWithGoogle(user: any): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: 'HOST',
      avatar: user.avatar
    };
    return this.jwtService.signAsync(payload);
  }
}