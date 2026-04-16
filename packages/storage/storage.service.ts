// apps/api/src/storage/storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner'; // optional for private files

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly disk: 'local' | 's3';
  private readonly localRoot: string;
  private readonly s3Client?: S3Client;
  private readonly bucket?: string;
  private readonly publicBaseUrl?: string;

  constructor(private config: ConfigService) {
    this.disk = this.config.get('STORAGE_DISK', 'local') as 'local' | 's3';

    // Determine monorepo root: if we're in apps/api, go up 2 levels; otherwise use cwd
    const cwd = process.cwd();
    const isInAppsApi = cwd.includes(path.join('apps', 'api')) || cwd.endsWith('apps\\api');
    this.localRoot = isInAppsApi 
      ? path.join(cwd, '..', '..', 'uploads') // Go up to monorepo root
      : path.join(cwd, 'uploads'); // Use current directory
    
    this.logger.log(`Storage initialized - Disk: ${this.disk}, Root: ${this.localRoot}, CWD: ${cwd}`);

    if (this.disk === 's3') {
      this.bucket = this.config.getOrThrow('STORAGE_BUCKET');
      this.publicBaseUrl = this.config.get('STORAGE_PUBLIC_URL'); // e.g. https://img.yourdomain.com

      this.s3Client = new S3Client({
        region: this.config.get('STORAGE_REGION', 'auto'), // 'auto' for R2
        endpoint: this.config.get('STORAGE_ENDPOINT'),     // required for R2 / MinIO
        credentials: {
          accessKeyId: this.config.getOrThrow('STORAGE_KEY'),
          secretAccessKey: this.config.getOrThrow('STORAGE_SECRET'),
        },
        forcePathStyle: true, // important for R2 / MinIO
      });
    }

    // Ensure local dir exists (dev only)
    if (this.disk === 'local') {
      fs.mkdir(this.localRoot, { recursive: true })
        .then(() => this.logger.log(`Uploads directory created/verified: ${this.localRoot}`))
        .catch((err) => this.logger.error(`Failed to create uploads directory: ${err.message}`));
    }
  }

  async upload(
    file: Express.Multer.File,
    folder: string = 'properties', // e.g. 'properties/2026/01'
  ): Promise<string> {
    if (!file || !file.buffer) {
      throw new Error('Invalid file: file or file.buffer is missing');
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }

    const ext = path.extname(file.originalname).toLowerCase() || '.webp';
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (ext !== '.webp' && !allowedExtensions.includes(ext)) {
      throw new Error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`);
    }

    const key = `${folder}/${randomUUID()}${ext}`;

    if (this.disk === 'local') {
      const fullPath = path.join(this.localRoot, key);
      const dirPath = path.dirname(fullPath);
      
      this.logger.log(`Uploading to: ${fullPath}`);
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(fullPath, file.buffer);
      this.logger.log(`File saved successfully: ${fullPath}`);
      return key;
    }

    // S3 / R2 upload
    await this.s3Client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return key;
  }

  getUrl(key: string): string {
    if (this.disk === 'local') {
      return `/uploads/${key}`; // Nest will serve it
    }

    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${key}`;
    }

    // fallback: construct R2 public URL if no custom domain
    const endpoint = this.config.get('STORAGE_ENDPOINT')!;
    const match = endpoint.match(/https:\/\/([^.]+)\.r2\.cloudflarestorage\.com/);
    if (match) {
      return `https://${this.bucket}.${match[1]}.r2.dev/${key}`;
    }

    return `https://${this.bucket}.s3.${this.config.get('STORAGE_REGION')}.amazonaws.com/${key}`;
  }

  // List all files in a folder (for local storage)
  async listFiles(folder: string = ''): Promise<Array<{ key: string; url: string; size?: number; modified?: Date }>> {
    if (this.disk === 'local') {
      const folderPath = folder ? path.join(this.localRoot, folder) : this.localRoot;
      const storageService = this; // Capture this for use in nested function
      
      try {
        const files: Array<{ key: string; url: string; size?: number; modified?: Date }> = [];
        
        async function scanDirectory(dir: string, baseFolder: string = ''): Promise<void> {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = baseFolder ? path.join(baseFolder, entry.name) : entry.name;
            
            if (entry.isDirectory()) {
              await scanDirectory(fullPath, relativePath);
            } else if (entry.isFile()) {
              const stats = await fs.stat(fullPath);
              const key = relativePath.replace(/\\/g, '/'); // Normalize path separators
              files.push({
                key,
                url: storageService.getUrl(key),
                size: stats.size,
                modified: stats.mtime,
              });
            }
          }
        }
        
        await scanDirectory(folderPath, folder);
        return files.sort((a, b) => (b.modified?.getTime() || 0) - (a.modified?.getTime() || 0)); // Sort by newest first
      } catch (error) {
        this.logger.error(`Error listing files: ${error}`);
        return [];
      }
    }
    
    // For S3, you would need to implement ListObjectsV2Command
    // This is a placeholder for S3 implementation
    return [];
  }

  // Delete a file
  async deleteFile(key: string): Promise<boolean> {
    if (this.disk === 'local') {
      const fullPath = path.join(this.localRoot, key);
      try {
        await fs.unlink(fullPath);
        this.logger.log(`File deleted: ${fullPath}`);
        return true;
      } catch (error) {
        this.logger.error(`Error deleting file: ${error}`);
        return false;
      }
    }
    
    // For S3, implement DeleteObjectCommand
    // This is a placeholder
    return false;
  }

  // Optional: stream / download method if needed
  // async getStream(key: string) { ... }
}

export default StorageService;