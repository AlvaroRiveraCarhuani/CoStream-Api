import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway'; 
import { JwtModule } from '@nestjs/jwt'; 
import { PrismaModule } from '../prisma/prisma.module'; 

@Module({
  imports: [
    PrismaModule, 
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_costream_key_2026',
    }),
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway], 
  exports: [RoomsService, RoomsGateway]    
})
export class RoomsModule {}