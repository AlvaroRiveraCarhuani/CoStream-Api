import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule, 
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'super_secret_costream_key_2026', 
      signOptions: { expiresIn: '1000h' }, 
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService], 
})
export class AuthModule {}