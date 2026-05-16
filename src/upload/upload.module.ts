import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt'; 
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { v2 as cloudinary } from 'cloudinary';

const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  useFactory: () => {
    return cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  },
};

@Module({
  imports: [JwtModule], 
  controllers: [UploadController],
  providers: [UploadService, CloudinaryProvider],
})
export class UploadModule {}