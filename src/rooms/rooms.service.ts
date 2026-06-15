import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { AccessToken } from 'livekit-server-sdk';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async createRoom(hostId: string, data: CreateRoomDto) {
    await this.prisma.room.updateMany({
      where: { hostId: hostId, isActive: true },
      data: { isActive: false, endedAt: new Date() }
    });

    const newRoom = await this.prisma.room.create({
      data: {
        hostId,
        title: data.title,
        isPublic: data.isPublic,
        requiresPin: data.requiresPin,
        accessPinHash: data.pin ? await bcrypt.hash(data.pin, 10) : null,
        isActive: true,
      },
    });

    const hostToken = await this.generateLiveKitToken(newRoom.id, hostId, 'HOST');

    return {
      id: newRoom.id,
      title: newRoom.title,
      isPublic: newRoom.isPublic,
      requiresPin: newRoom.requiresPin,
      hostToken: hostToken,
      livekitUrl: process.env.LIVEKIT_URL,
    };
  }

  async getMyActiveRoom(hostId: string) {
    return this.prisma.room.findFirst({
      where: { hostId: hostId, isActive: true },
      select: { id: true, title: true, isPublic: true, requiresPin: true, createdAt: true } 
    });
  }

  async getPublicRooms(userId: string) {
    return this.prisma.room.findMany({
      where: {
        isActive: true,
        isPublic: true,
        hostId: { not: userId }
      },
      include: {
        host: { select: { displayName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // ✅ MÉTODO CORREGIDO: ahora recibe userId y lo usa como identity
  async joinRoom(userId: string, data: JoinRoomDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: data.roomId },
    });

    if (!room || !room.isActive) {
      throw new NotFoundException('La sala no existe o ya ha finalizado.');
    }

    if (room.requiresPin) {
      if (!data.pin) {
        throw new UnauthorizedException('Esta sala requiere un PIN de acceso.');
      }
      if (!room.accessPinHash) {
        throw new UnauthorizedException('Error de configuración en la sala.');
      }
      const isPinValid = await bcrypt.compare(data.pin, room.accessPinHash);
      if (!isPinValid) {
        throw new UnauthorizedException('El PIN ingresado es incorrecto.');
      }
    }

    const guestRole = 'PRESENTER';
    // ✅ Usamos el userId real, NO un UUID aleatorio
    const guestToken = await this.generateLiveKitToken(
      room.id,
      userId,
      guestRole,
      data.displayName
    );

    return {
      success: true,
      guestToken: guestToken,
      livekitUrl: process.env.LIVEKIT_URL,
      assignedRole: guestRole,
    };
  }

  async endRoom(roomId: string, hostId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) throw new NotFoundException('Sala no encontrada.');
    if (room.hostId !== hostId) {
      throw new UnauthorizedException('Solo el creador de la sala puede finalizarla.');
    }

    await this.prisma.room.update({
      where: { id: roomId },
      data: { isActive: false, endedAt: new Date() },
    });

    return { success: true, message: 'Transmisión finalizada correctamente.' };
  }

  async getRoomMessages(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Sala no encontrada.');

    const messages = await this.prisma.message.findMany({
      where: { roomId: roomId },
      orderBy: { sentAt: 'asc' },
      select: {
        id: true,
        senderName: true,
        content: true,
        sentAt: true,
      }
    });

    return messages.map(msg => ({
      id: msg.id,
      senderId: 'unknown',
      senderName: msg.senderName,
      text: msg.content,
      type: 'text',
      timestamp: msg.sentAt.toISOString(),
    }));
  }

  async getRoomHistory(hostId: string) {
    const rooms = await this.prisma.room.findMany({
      where: {
        hostId: hostId,
        isActive: false, 
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        endedAt: true,
        _count: {
          select: {
            messages: true, 
            participants: true, 
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return rooms.map(room => {
      let durationMinutes = 0;
      if (room.endedAt) {
        const diffMs = room.endedAt.getTime() - room.createdAt.getTime();
        durationMinutes = Math.floor(diffMs / 1000 / 60);
      }

      return {
        id: room.id,
        title: room.title,
        createdAt: room.createdAt,
        endedAt: room.endedAt,
        durationMinutes: durationMinutes,
        totalMessages: room._count.messages,
        totalParticipants: room._count.participants,
      };
    });
  }

  private async generateLiveKitToken(
    roomId: string,
    identity: string,
    role: string,
    participantName?: string,
  ): Promise<string> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('Faltan las credenciales de LiveKit en el entorno');
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: identity,
      name: participantName || identity,
    });

    const canPublish = role === 'HOST' || role === 'PRESENTER';
    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: canPublish,
      canSubscribe: true,
    });

    return at.toJwt();
  }

  async getRoomStatus(roomId: string) {
    try {
      const room = await this.prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true, requiresPin: true, hostId: true } 
      });

      if (!room) {
        return { exists: false, requiresPin: false };
      }

      return { 
        exists: true, 
        requiresPin: room.requiresPin, 
        creatorId: room.hostId 
      };
    } catch (error) {
      return { exists: false, requiresPin: false }; 
    }
  }
}