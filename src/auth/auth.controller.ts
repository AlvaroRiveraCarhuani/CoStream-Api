import { Controller, Get, Post, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request, Response } from 'express'; 

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() _req: Request) {
    // Manejado automáticamente por Passport Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const token = await this.authService.loginWithGoogle(req.user); 
    
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: false, // En entornos productivos con HTTPS esto debe ser true
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24, 
    });

    // Redirección directa y limpia hacia el frontend
    res.redirect('http://localhost:4200/login/success');
  }
  //Valida la cookie
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: Request) {
    return req.user; 
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('jwt');
    return res.status(200).json({ message: 'Sesión finalizada con éxito' });
  }
}