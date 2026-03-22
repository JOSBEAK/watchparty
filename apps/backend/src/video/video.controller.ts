import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { VideoService } from './video.service';
import { RoomsService } from '../rooms/rooms.service';
import { IsNotEmpty, IsString } from 'class-validator';

class PresignUploadDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;
}

@Controller('video')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    private readonly roomsService: RoomsService,
  ) {}

  /**
   * POST /video/presign
   * Returns a presigned S3 PUT URL for the client to upload a video.
   */
  @Post('presign')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getUploadUrl(@Body() dto: PresignUploadDto) {
    const { key, uploadUrl } = await this.videoService.getUploadUrl(
      dto.filename,
      dto.contentType,
    );

    // Save the video key to the room so it can be retrieved later
    await this.roomsService.updateVideoKey(dto.roomId, key, dto.filename);

    return { key, uploadUrl, roomId: dto.roomId };
  }

  /**
   * GET /video/:key/url
   * Returns a presigned S3 GET URL for video playback.
   */
  @Get(':key/url')
  async getPlaybackUrl(@Param('key') key: string) {
    // The key may contain slashes (e.g. videos/abc.mp4) — NestJS wildcard
    const url = await this.videoService.getPlaybackUrl(key);
    return { url };
  }
}
