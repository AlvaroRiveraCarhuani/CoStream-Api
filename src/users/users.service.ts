import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async createHost(email: string, passwordPlain: string, displayName: string) {
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('El correo ya está en uso');
    }

    const hashedPassword = await bcrypt.hash(passwordPlain, 10);
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff`;

    return this.prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        displayName,
        avatar: defaultAvatar,
      },
    });
  }
}