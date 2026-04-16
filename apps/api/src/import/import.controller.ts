import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('import')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('wordpress')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'xml', maxCount: 1 },
      { name: 'imagesXml', maxCount: 1 },
      { name: 'zip', maxCount: 1 },
    ], {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB
      },
    }),
  )
  async importWordPress(
    @UploadedFiles()
    files: { xml?: Express.Multer.File[]; zip?: Express.Multer.File[] },
    @Request() req: any,
  ) {
    const xmlFile = files.xml?.[0];
    const zipFile = files.zip?.[0];

    if (!xmlFile) {
      throw new Error('XML file is required');
    }

    const xmlData = xmlFile.buffer.toString('utf-8');
    const ownerId = req.user.id;
    return this.importService.importWordPress(xmlData, ownerId, zipFile);
  }
}
