import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createRoom(@Body() dto: CreateRoomDto) {
    const room = await this.roomsService.createRoom(dto.displayName);
    return {
      id: room.id,
      code: room.code,
      createdAt: room.createdAt,
    };
  }

  @Get(':code')
  async getRoom(@Param('code') code: string) {
    const room = await this.roomsService.getRoom(code);
    return {
      id: room.id,
      code: room.code,
      videoKey: room.videoKey,
      videoFilename: room.videoFilename,
      createdAt: room.createdAt,
    };
  }
}
