import { Injectable } from '@nestjs/common';
import { PlaybackState, ParticipantInfo } from '../shared/events';

interface RoomSyncState {
  playback: PlaybackState;
  participants: Map<string, ParticipantInfo>; // socketId → info
  hostSocketId: string | null;
}

@Injectable()
export class SyncService {
  // In-memory sync state per room code
  private rooms = new Map<string, RoomSyncState>();

  getOrCreateRoom(roomCode: string): RoomSyncState {
    if (!this.rooms.has(roomCode)) {
      this.rooms.set(roomCode, {
        playback: {
          playing: false,
          timestamp: 0,
          updatedAt: Date.now(),
        },
        participants: new Map(),
        hostSocketId: null,
      });
    }
    return this.rooms.get(roomCode)!;
  }

  addParticipant(
    roomCode: string,
    socketId: string,
    displayName: string,
    isHost: boolean,
  ): void {
    const room = this.getOrCreateRoom(roomCode);
    room.participants.set(socketId, { socketId, displayName });
    if (isHost) {
      room.hostSocketId = socketId;
    }
  }

  removeParticipant(roomCode: string, socketId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.participants.delete(socketId);

    // If host left, promote next participant
    if (room.hostSocketId === socketId) {
      const next = room.participants.keys().next();
      room.hostSocketId = next.done ? null : next.value;
    }

    // Clean up empty rooms
    if (room.participants.size === 0) {
      this.rooms.delete(roomCode);
    }
  }

  getParticipants(roomCode: string): ParticipantInfo[] {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    return Array.from(room.participants.values());
  }

  isHost(roomCode: string, socketId: string): boolean {
    const room = this.rooms.get(roomCode);
    return room?.hostSocketId === socketId;
  }

  updatePlayback(
    roomCode: string,
    update: Partial<PlaybackState>,
  ): PlaybackState {
    const room = this.getOrCreateRoom(roomCode);
    room.playback = {
      ...room.playback,
      ...update,
      updatedAt: Date.now(),
    };
    return room.playback;
  }

  getPlayback(roomCode: string): PlaybackState {
    return this.getOrCreateRoom(roomCode).playback;
  }

  /** Find which room a socket belongs to */
  findRoomBySocket(socketId: string): string | null {
    for (const [code, room] of this.rooms) {
      if (room.participants.has(socketId)) {
        return code;
      }
    }
    return null;
  }
}
