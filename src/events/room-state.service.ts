import { Injectable } from '@nestjs/common';

export interface RoomParticipant {
  userId: string;
  name: string;
  role: 'HOST' | 'PRESENTER' | 'VIEWER';
  isOnStage: boolean;
}

@Injectable()
export class RoomStateService {
  // Map<RoomId, Map<UserId, Participant>>
  private rooms = new Map<string, Map<string, RoomParticipant>>();

  addParticipant(roomId: string, participant: RoomParticipant) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }
    this.rooms.get(roomId)?.set(participant.userId, participant);
  }

  removeParticipant(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        this.rooms.delete(roomId); 
      }
    }
  }

  getRoomState(roomId: string): RoomParticipant[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.values());
  }

  getParticipant(roomId: string, userId: string): RoomParticipant | undefined {
    return this.rooms.get(roomId)?.get(userId);
  }

  updateParticipantStage(roomId: string, userId: string, isOnStage: boolean, newRole?: 'HOST' | 'PRESENTER' | 'VIEWER') {
    const participant = this.getParticipant(roomId, userId);
    if (participant) {
      participant.isOnStage = isOnStage;
      if (newRole) participant.role = newRole;
      this.rooms.get(roomId)?.set(userId, participant);
    }
  }
}