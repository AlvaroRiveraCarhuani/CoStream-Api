import { Controller, Get, Post, UseGuards, Req, Res, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any, @Res() res: Response) {
    const result = await this.authService.login(body.email, body.password);

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('jwt', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    });

    // También retornamos el token en el body para compatibilidad con Bearer auth
    return res.status(200).json({ accessToken: result.accessToken, message: 'Login exitoso' });
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() _req: Request) {
    // Manejado automáticamente por Passport Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const token = await this.authService.loginWithGoogle(req.user);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

    // Los browsers modernos bloquean cookies cross-site incluso con SameSite=None.
    // Pasamos el token como query param para que el frontend lo guarde en localStorage.
    res.redirect(`${frontendUrl}/login/success?token=${token}`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: any) {
    return req.user;
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('jwt');
    return res.status(200).json({ message: 'Sesión finalizada con éxito' });
  }
}