import { ConfigService } from '@nestjs/config';
export declare class StorageService {
    private config;
    private readonly logger;
    private readonly disk;
    private readonly localRoot;
    private readonly s3Client?;
    private readonly bucket?;
    private readonly publicBaseUrl?;
    constructor(config: ConfigService);
    upload(file: Express.Multer.File, folder?: string): Promise<string>;
    getUrl(key: string): string;
    listFiles(folder?: string): Promise<Array<{
        key: string;
        url: string;
        size?: number;
        modified?: Date;
    }>>;
    deleteFile(key: string): Promise<boolean>;
}
export default StorageService;
//# sourceMappingURL=storage.service.d.ts.map