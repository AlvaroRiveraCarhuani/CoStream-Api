import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createHost(email: string, passwordPlain: string, displayName: string) {
    // 1. Verificar si el correo ya existe para evitar errores raros de base de datos
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado en el sistema.');
    }

    // 2. Encriptar la contraseña (10 rondas de salt es el estándar seguro actual)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(passwordPlain, saltRounds);

    // 3. Guardar en PostgreSQL usando Prisma
    const newUser = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
      },
      // Excluimos explícitamente el hash de la respuesta por seguridad
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
    });

    return newUser;
  }

  async findByEmail(email: string) {
    // Este método lo usaremos más adelante en el AuthModule para el Login
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}