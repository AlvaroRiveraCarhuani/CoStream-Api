import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { AccessToken } from 'livekit-server-sdk';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async createRoom(hostId: string, data: CreateRoomDto) {
    let accessPinHash: string | null = null;
    
    if (data.requiresPin && data.pin) {
      const saltRounds = 10;
      accessPinHash = await bcrypt.hash(data.pin, saltRounds);
    }

    const newRoom = await this.prisma.room.create({
      data: {
        hostId: hostId, 
        title: data.title,
        isPublic: data.isPublic,
        requiresPin: data.requiresPin,
        accessPinHash: accessPinHash, 
        isActive: true,
      },
      select: {
        id: true, 
        title: true,
        requiresPin: true,
        createdAt: true,
      },
    });

    const hostToken = await this.generateLiveKitToken(
      newRoom.id, 
      'Host',  
      hostId, 
      'HOST'
    );

    return {
      roomId: newRoom.id,
      hostToken: hostToken,
      livekitUrl: process.env.LIVEKIT_URL
    };
  }

  async getPublicRooms() {
    return this.prisma.room.findMany({
      where: {
        isPublic: true,
        isActive: true, 
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        host: {
          select: {
            displayName: true, 
          },
        },
      },
      orderBy: {
        createdAt: 'desc', 
      },
    });
  }

  async joinRoom(data: JoinRoomDto) {
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

    const guestIdentity = crypto.randomUUID(); 

    const guestToken = await this.generateLiveKitToken(
      room.id,
      data.displayName,
      guestIdentity,
      'VIEWER'
    );

    return {
      success: true,
      guestToken: guestToken,
      livekitUrl: process.env.LIVEKIT_URL,
      assignedRole: 'VIEWER', 
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
      data: { isActive: false },
    });

    return { success: true, message: 'Transmisión finalizada correctamente.' };
  }
  async getRoomMessages(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Sala no encontrada.');

    return this.prisma.message.findMany({
      where: { roomId: roomId },
      orderBy: { sentAt: 'asc' },
      select: {
        id: true,
        senderName: true,
        content: true,
        sentAt: true,
      }
    }).then(messages => messages.map(msg => ({
      id: msg.id,
      senderName: msg.senderName,
      role: 'VIEWER', 
      content: msg.content,
      timestamp: msg.sentAt,
    })));
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

  private async generateLiveKitToken(roomId: string, participantName: string, identity: string, role: string): Promise<string> {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: identity, 
        name: participantName,
      },
    );

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: role === 'HOST' || role === 'PRESENTER', 
      canSubscribe: true, 
    });

    return await at.toJwt();
  }
}