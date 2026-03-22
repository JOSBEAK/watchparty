import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './rooms.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
  ) {}

  /**
   * Generate a random 6-character alphanumeric room code.
   * Uses uppercase letters + digits, avoids ambiguous chars (0/O, 1/I/L).
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createRoom(hostDisplayName: string): Promise<Room> {
    // Generate unique code (retry on collision)
    let code: string;
    let exists = true;
    while (exists) {
      code = this.generateCode();
      const found = await this.roomRepo.findOne({ where: { code } });
      exists = !!found;
    }

    const room = this.roomRepo.create({
      code: code!,
    });

    return this.roomRepo.save(room);
  }

  async getRoom(code: string): Promise<Room> {
    const room = await this.roomRepo.findOne({
      where: { code: code.toUpperCase() },
    });
    if (!room) {
      throw new NotFoundException(`Room with code "${code}" not found`);
    }
    return room;
  }

  async updateVideoKey(
    roomId: string,
    videoKey: string,
    videoFilename: string,
  ): Promise<Room> {
    await this.roomRepo.update(roomId, { videoKey, videoFilename });
    return this.getRoom(
      (await this.roomRepo.findOneBy({ id: roomId }))!.code,
    );
  }

  async setHostSocket(roomId: string, socketId: string): Promise<void> {
    await this.roomRepo.update(roomId, { hostSocketId: socketId });
  }
}
