"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const client_s3_1 = require("@aws-sdk/client-s3");
let StorageService = StorageService_1 = class StorageService {
    config;
    logger = new common_1.Logger(StorageService_1.name);
    disk;
    localRoot;
    s3Client;
    bucket;
    publicBaseUrl;
    constructor(config) {
        this.config = config;
        this.disk = this.config.get('STORAGE_DISK', 'local');
        const cwd = process.cwd();
        const isInAppsApi = cwd.includes(path.join('apps', 'api')) || cwd.endsWith('apps\\api');
        this.localRoot = isInAppsApi
            ? path.join(cwd, '..', '..', 'uploads')
            : path.join(cwd, 'uploads');
        this.logger.log(`Storage initialized - Disk: ${this.disk}, Root: ${this.localRoot}, CWD: ${cwd}`);
        if (this.disk === 's3') {
            this.bucket = this.config.getOrThrow('STORAGE_BUCKET');
            this.publicBaseUrl = this.config.get('STORAGE_PUBLIC_URL');
            this.s3Client = new client_s3_1.S3Client({
                region: this.config.get('STORAGE_REGION', 'auto'),
                endpoint: this.config.get('STORAGE_ENDPOINT'),
                credentials: {
                    accessKeyId: this.config.getOrThrow('STORAGE_KEY'),
                    secretAccessKey: this.config.getOrThrow('STORAGE_SECRET'),
                },
                forcePathStyle: true,
            });
        }
        if (this.disk === 'local') {
            fs.mkdir(this.localRoot, { recursive: true })
                .then(() => this.logger.log(`Uploads directory created/verified: ${this.localRoot}`))
                .catch((err) => this.logger.error(`Failed to create uploads directory: ${err.message}`));
        }
    }
    async upload(file, folder = 'properties') {
        if (!file || !file.buffer) {
            throw new Error('Invalid file: file or file.buffer is missing');
        }
        const ext = path.extname(file.originalname) || '.webp';
        const key = `${folder}/${(0, crypto_1.randomUUID)()}${ext}`;
        if (this.disk === 'local') {
            const fullPath = path.join(this.localRoot, key);
            const dirPath = path.dirname(fullPath);
            this.logger.log(`Uploading to: ${fullPath}`);
            await fs.mkdir(dirPath, { recursive: true });
            await fs.writeFile(fullPath, file.buffer);
            this.logger.log(`File saved successfully: ${fullPath}`);
            return key;
        }
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            CacheControl: 'public, max-age=31536000, immutable',
        }));
        return key;
    }
    getUrl(key) {
        if (this.disk === 'local') {
            return `/uploads/${key}`;
        }
        if (this.publicBaseUrl) {
            return `${this.publicBaseUrl}/${key}`;
        }
        const endpoint = this.config.get('STORAGE_ENDPOINT');
        const match = endpoint.match(/https:\/\/([^.]+)\.r2\.cloudflarestorage\.com/);
        if (match) {
            return `https://${this.bucket}.${match[1]}.r2.dev/${key}`;
        }
        return `https://${this.bucket}.s3.${this.config.get('STORAGE_REGION')}.amazonaws.com/${key}`;
    }
    async listFiles(folder = '') {
        if (this.disk === 'local') {
            const folderPath = folder ? path.join(this.localRoot, folder) : this.localRoot;
            const storageService = this;
            try {
                const files = [];
                async function scanDirectory(dir, baseFolder = '') {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        const relativePath = baseFolder ? path.join(baseFolder, entry.name) : entry.name;
                        if (entry.isDirectory()) {
                            await scanDirectory(fullPath, relativePath);
                        }
                        else if (entry.isFile()) {
                            const stats = await fs.stat(fullPath);
                            const key = relativePath.replace(/\\/g, '/');
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
                return files.sort((a, b) => (b.modified?.getTime() || 0) - (a.modified?.getTime() || 0));
            }
            catch (error) {
                this.logger.error(`Error listing files: ${error}`);
                return [];
            }
        }
        return [];
    }
    async deleteFile(key) {
        if (this.disk === 'local') {
            const fullPath = path.join(this.localRoot, key);
            try {
                await fs.unlink(fullPath);
                this.logger.log(`File deleted: ${fullPath}`);
                return true;
            }
            catch (error) {
                this.logger.error(`Error deleting file: ${error}`);
                return false;
            }
        }
        return false;
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
exports.default = StorageService;
//# sourceMappingURL=storage.service.js.map