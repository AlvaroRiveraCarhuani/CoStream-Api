import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt'; 
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule],
  providers: [RoomsService],
  controllers: [RoomsController]
})
export class RoomsModule {}
