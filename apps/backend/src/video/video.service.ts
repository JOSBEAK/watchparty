import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VideoService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(VideoService.name);

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');

    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const region = this.config.get<string>('AWS_REGION') || 'us-east-1';

    this.s3 = new S3Client({
      region,
      ...(endpoint && {
        endpoint,
        forcePathStyle: true, // needed for LocalStack / MinIO
      }),
      credentials: {
        accessKeyId:
          this.config.get<string>('AWS_ACCESS_KEY_ID') || 'test',
        secretAccessKey:
          this.config.get<string>('AWS_SECRET_ACCESS_KEY') || 'test',
      },
    });
  }

  /**
   * Generate a presigned PUT URL for the client to upload a video
   * directly to S3. Returns the key and the upload URL.
   */
  async getUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<{ key: string; uploadUrl: string }> {
    const ext = filename.split('.').pop() || 'mp4';
    const key = `videos/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 3600, // 1 hour
    });

    this.logger.log(`Generated presigned upload URL for key: ${key}`);

    return { key, uploadUrl };
  }

  /**
   * Generate a presigned GET URL for video playback.
   * The <video> tag will use this URL with native range request support.
   */
  async getPlaybackUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.s3, command, {
      expiresIn: 7200, // 2 hours
    });

    return url;
  }
}
