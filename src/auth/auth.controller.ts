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

    return res.status(200).json({ message: 'Login exitoso' });
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() _req: Request) {
    // Manejado automáticamente por Passport Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    console.log('[Google Callback] req.user recibido:', JSON.stringify(req.user));
    console.log('[Google Callback] NODE_ENV:', process.env.NODE_ENV);
    console.log('[Google Callback] FRONTEND_URL:', process.env.FRONTEND_URL);

    const token = await this.authService.loginWithGoogle(req.user);
    console.log('[Google Callback] Token generado (primeros 20 chars):', token?.substring(0, 20));

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    console.log('[Google Callback] Redirigiendo a:', `${frontendUrl}/login/success`);
    res.redirect(`${frontendUrl}/login/success`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: any) {
    console.log('[Profile] Cookies recibidas:', JSON.stringify(req.cookies));
    console.log('[Profile] Headers origin:', req.headers.origin);
    console.log('[Profile] User en request:', JSON.stringify(req.user));
    return req.user;
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('jwt');
    return res.status(200).json({ message: 'Sesión finalizada con éxito' });
  }
}