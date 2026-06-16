import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, StrategyOptions } from 'passport-google-oauth20';
import { PrismaService } from '../../prisma/prisma.service'; // Ruta corregida

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private prisma: PrismaService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
    } as StrategyOptions);
    
    // Log temporal para verificar la callback URL configurada
    console.log('Callback URL configurada:', process.env.GOOGLE_CALLBACK_URL);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    // Log para saber que se ejecutó el validate (opcional, muy útil)
    console.log('GoogleStrategy.validate() ejecutado para perfil:', profile.id);
    
    const { id, name, emails, photos } = profile; 
    const email = emails[0].value;
    const displayName = `${name.givenName} ${name.familyName}`;
    const avatar = photos && photos.length > 0 ? photos[0].value : null;

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: id }, { email: email }]
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          displayName,
          googleId: id,
          avatar,
        },
      });
    } else if (!user.googleId || !user.avatar) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { 
          googleId: id,
          avatar: user.avatar || avatar 
        },
      });
    }

    done(null, user);
  }
}