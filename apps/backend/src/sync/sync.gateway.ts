import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SyncService } from './sync.service';
import { RoomsService } from '../rooms/rooms.service';
import { VideoService } from '../video/video.service';
import { SyncEvents } from '../shared/events';
import type {
  JoinRoomPayload,
  TimestampPayload,
  RoomStatePayload,
  SyncPayload,
} from '../shared/events';

@WebSocketGateway({
  cors: {
    origin: '*', // tighten in production
  },
})
export class SyncGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SyncGateway.name);

  // Track socket → roomCode for cleanup on disconnect
  private socketRooms = new Map<string, string>();

  constructor(
    private readonly syncService: SyncService,
    private readonly roomsService: RoomsService,
    private readonly videoService: VideoService,
  ) {}

  // ── join-room ────────────────────────────────────────────

  @SubscribeMessage(SyncEvents.JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ): Promise<void> {
    const { roomCode, displayName } = payload;
    this.logger.log(
      `Socket ${client.id} joining room ${roomCode} as "${displayName}"`,
    );

    try {
      const room = await this.roomsService.getRoom(roomCode);

      // Determine if this is the first person (host)
      const participants = this.syncService.getParticipants(roomCode);
      const isHost = participants.length === 0;

      // Join the Socket.io room
      await client.join(roomCode);
      this.socketRooms.set(client.id, roomCode);

      // Register participant
      this.syncService.addParticipant(
        roomCode,
        client.id,
        displayName,
        isHost,
      );

      if (isHost) {
        await this.roomsService.setHostSocket(room.id, client.id);
      }

      // Send current room state to the joining client
      let videoUrl: string | null = null;
      if (room.videoKey) {
        videoUrl = await this.videoService.getPlaybackUrl(room.videoKey);
      }

      const roomState: RoomStatePayload = {
        videoUrl,
        playback: this.syncService.getPlayback(roomCode),
        participants: this.syncService.getParticipants(roomCode),
      };

      client.emit(SyncEvents.ROOM_STATE, roomState);

      // Broadcast to others that someone joined
      client.to(roomCode).emit(SyncEvents.PARTICIPANT_JOINED, {
        displayName,
        socketId: client.id,
      });
    } catch (error) {
      this.logger.error(`Failed to join room: ${error}`);
      client.emit(SyncEvents.ERROR, {
        message: `Room "${roomCode}" not found`,
      });
    }
  }

  // ── play ─────────────────────────────────────────────────

  @SubscribeMessage(SyncEvents.PLAY)
  handlePlay(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TimestampPayload,
  ): void {
    const roomCode = this.socketRooms.get(client.id);
    if (!roomCode) return;

    this.syncService.updatePlayback(roomCode, {
      playing: true,
      timestamp: payload.timestamp,
    });

    const sync: SyncPayload = {
      action: 'play',
      timestamp: payload.timestamp,
      serverTime: Date.now(),
    };

    // Broadcast to everyone in the room INCLUDING sender
    this.server.to(roomCode).emit(SyncEvents.SYNC, sync);
    this.logger.debug(`Room ${roomCode}: play at ${payload.timestamp}`);
  }

  // ── pause ────────────────────────────────────────────────

  @SubscribeMessage(SyncEvents.PAUSE)
  handlePause(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TimestampPayload,
  ): void {
    const roomCode = this.socketRooms.get(client.id);
    if (!roomCode) return;

    this.syncService.updatePlayback(roomCode, {
      playing: false,
      timestamp: payload.timestamp,
    });

    const sync: SyncPayload = {
      action: 'pause',
      timestamp: payload.timestamp,
      serverTime: Date.now(),
    };

    this.server.to(roomCode).emit(SyncEvents.SYNC, sync);
    this.logger.debug(`Room ${roomCode}: pause at ${payload.timestamp}`);
  }

  // ── seek ─────────────────────────────────────────────────

  @SubscribeMessage(SyncEvents.SEEK)
  handleSeek(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TimestampPayload,
  ): void {
    const roomCode = this.socketRooms.get(client.id);
    if (!roomCode) return;

    this.syncService.updatePlayback(roomCode, {
      timestamp: payload.timestamp,
    });

    const sync: SyncPayload = {
      action: 'seek',
      timestamp: payload.timestamp,
      serverTime: Date.now(),
    };

    this.server.to(roomCode).emit(SyncEvents.SYNC, sync);
    this.logger.debug(`Room ${roomCode}: seek to ${payload.timestamp}`);
  }

  // ── heartbeat (host sends every 5s) ──────────────────────

  @SubscribeMessage(SyncEvents.HEARTBEAT)
  handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TimestampPayload,
  ): void {
    const roomCode = this.socketRooms.get(client.id);
    if (!roomCode) return;

    // Only accept heartbeats from the host
    if (!this.syncService.isHost(roomCode, client.id)) return;

    this.syncService.updatePlayback(roomCode, {
      timestamp: payload.timestamp,
    });

    // Broadcast heartbeat to all OTHER clients (not the host)
    client.to(roomCode).emit(SyncEvents.HEARTBEAT_ACK, {
      timestamp: payload.timestamp,
      serverTime: Date.now(),
    });
  }

  // ── video-set (host signals upload complete) ─────────────

  @SubscribeMessage('video-set')
  async handleVideoSet(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { key: string },
  ): Promise<void> {
    const roomCode = this.socketRooms.get(client.id);
    if (!roomCode) return;

    try {
      const videoUrl = await this.videoService.getPlaybackUrl(payload.key);
      // Broadcast the video URL to everyone in the room
      this.server.to(roomCode).emit('video-url', { videoUrl });
      this.logger.log(`Room ${roomCode}: video set → ${payload.key}`);
    } catch (error) {
      this.logger.error(`Failed to get playback URL: ${error}`);
      client.emit(SyncEvents.ERROR, { message: 'Failed to set video' });
    }
  }

  // ── cam-enabled (user toggled cam on) ────────────────────

  @SubscribeMessage('cam-enabled')
  handleCamEnabled(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string },
  ): void {
    const roomCode = this.socketRooms.get(client.id) || payload.roomCode;
    if (!roomCode) return;

    // Broadcast to everyone in the room (including sender, so they
    // know about others who already had cam on)
    this.server.to(roomCode).emit('cam-enabled', {
      socketId: client.id,
    });
    this.logger.debug(`Room ${roomCode}: cam enabled by ${client.id}`);
  }

  // ── chat-message ─────────────────────────────────────────

  @SubscribeMessage('chat-message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { id: string; displayName: string; text: string; timestamp: number },
  ): void {
    const roomCode = this.socketRooms.get(client.id);
    if (!roomCode) return;

    // Broadcast to everyone in the room INCLUDING sender
    this.server.to(roomCode).emit('chat-message', payload);
    this.logger.debug(`Room ${roomCode}: chat from "${payload.displayName}"`);
  }

  // ── disconnect ───────────────────────────────────────────

  handleDisconnect(client: Socket): void {
    const roomCode = this.socketRooms.get(client.id);
    if (!roomCode) return;

    this.logger.log(`Socket ${client.id} disconnected from room ${roomCode}`);

    this.syncService.removeParticipant(roomCode, client.id);
    this.socketRooms.delete(client.id);

    // Notify remaining participants
    this.server.to(roomCode).emit(SyncEvents.PARTICIPANT_LEFT, {
      socketId: client.id,
    });
  }
}
