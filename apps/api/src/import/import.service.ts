import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from '../../../../packages/db/src/schemas/property.schema';
import { Area } from '../../../../packages/db/src/schemas/area.schema';
import { City } from '../../../../packages/db/src/schemas/city.schema';
import { XMLParser } from 'fast-xml-parser';
import * as he from 'he';
import slug from 'slug';
import AdmZip from 'adm-zip';
import * as path from 'path';
import { StorageService } from '../../../../packages/storage/storage.service';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import { IndexNowService } from '../indexnow/indexnow.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    @InjectModel('Property') private propertyModel: Model<Property>,
    @InjectModel('Area') private areaModel: Model<Area>,
    @InjectModel('City') private cityModel: Model<City>,
    private readonly storageService: StorageService,
    private readonly indexNowService: IndexNowService,
    private readonly configService: ConfigService,
  ) {}

  async importWordPress(xmlData: string, ownerId: string, zipFile?: Express.Multer.File, imagesXmlData?: string): Promise<any> {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      tagValueProcessor: (tagName, tagValue, jPath, hasAttributes, isLeafNode) => {
        if (typeof tagValue === 'string') {
          return he.decode(tagValue);
        }
        return tagValue;
      },
    });

    const jsonObj = parser.parse(xmlData);
    const channel = jsonObj.rss?.channel;
    
    if (!channel || !channel.item) {
      throw new Error('Invalid WordPress XML format.');
    }

    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    const listings = items.filter(item => item['wp:post_type'] === 'listivo_listing');
    const attachments = items.filter(item => item['wp:post_type'] === 'attachment');

    this.logger.log(`Found ${listings.length} property listings and ${attachments.length} attachments.`);
    
    // Process Images if Zip is provided
    const imageMap = new Map<string, string>(); // ID -> URL
    if (zipFile) {
        await this.processImages(zipFile, attachments, imageMap);
    } else {
        // If no zip, try to process images from XML URLs (Main XML or Secondary Images XML)
        const toProcess: any[] = [];
        
        // 1. Attachments from Main XML
        toProcess.push(...attachments);

        // 2. Attachments from Secondary XML (if provided)
        if (imagesXmlData) {
            const imagesJson = parser.parse(imagesXmlData);
            const imagesChannel = imagesJson?.rss?.channel;
            if (imagesChannel?.item) {
                const imagesItems = Array.isArray(imagesChannel.item) ? imagesChannel.item : [imagesChannel.item];
                const imageAttachments = imagesItems.filter(item => item['wp:post_type'] === 'attachment');
                toProcess.push(...imageAttachments);
                this.logger.log(`Found ${imageAttachments.length} additional attachments in Images XML.`);
            }
        }

        if (toProcess.length > 0) {
            await this.processImagesFromUrls(toProcess, imageMap);
        }
    }

    this.logger.log(`Image Map Size: ${imageMap.size}`);

    let importedCount = 0;
    let skippedCount = 0;
    const importedUrls: string[] = [];
    const host = this.configService.get<string>('APP_HOST') || 'propertydealer.pk';

    for (const item of listings) {
      try {
        const metadata = this.extractMetadata(item['wp:postmeta']);
        
        // Resolve categories
        const categories = Array.isArray(item.category) ? item.category : (item.category ? [item.category] : []);
        const cityNicename = categories.find(c => c['@_domain'] === 'listivo_9508')?.['@_nicename'];
        const typeNicename = categories.find(c => c['@_domain'] === 'listivo_14')?.['@_nicename'];
        const purposeNicename = categories.find(c => c['@_domain'] === 'listivo_5495')?.['@_nicename'];

        // Find or create City
        let cityId: Types.ObjectId | null = null;
        if (cityNicename) {
          cityId = await this.resolveCity(cityNicename, categories.find(c => c['@_domain'] === 'listivo_9508')?.['#text'] || cityNicename);
        }

        // Find or create Area (using the post title as a fallback location hint if needed)
        let areaId: Types.ObjectId | null = null;
        if (cityId) {
            // Usually area is another category, but in this XML it might be complex
            // For now, we'll try to find any category that isn't city/type/purpose
            const areaCat = categories.find(c => !['listivo_9508', 'listivo_14', 'listivo_5495', 'listivo_4661'].includes(c['@_domain']));
            if (areaCat) {
                areaId = await this.resolveArea(areaCat['@_nicename'], areaCat['#text'], cityId);
            }

        }

        const priceStr = String(metadata['listivo_130_listivo_13'] || '0');
        const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;

        const areaSizeStr = String(metadata['listivo_340'] || '0');
        const areaSize = parseInt(areaSizeStr.replace(/[^0-9]/g, '')) || 0;

        const bedrooms = parseInt(metadata['listivo_5462'] || '0') || 0;
        const bathrooms = parseInt(metadata['listivo_5463'] || '0') || 0;

        const propertyData = {
          title: item.title,
          slug: item['wp:post_name'] || slug(item.title),
          description: item['content:encoded'] || '',
          listingType: purposeNicename === 'for-sale' ? 'sale' : 'rent',
          propertyType: this.mapPropertyType(typeNicename),
          location: item.title, // Fallback location
          price,
          areaSize,
          bedrooms,
          bathrooms,
          contactNumber: '0000000000', // WordPress XML usually doesn't have this in meta by default unless customized
          owner: new Types.ObjectId(ownerId),
          area: areaId,
          status: 'approved',
          features: categories.filter(c => c['@_domain'] === 'listivo_4661').map(c => c['#text']),
          mainPhotoUrl: imageMap.get(metadata['_thumbnail_id'] || '') || '',
          additionalPhotosUrls: [], // TODO: extract gallery IDs if available in meta
        };

        await this.propertyModel.findOneAndUpdate(
          { slug: propertyData.slug },
          propertyData,
          { upsert: true, new: true }
        );

        importedCount++;
        importedUrls.push(`https://${host}/p/${propertyData.slug}`);
      } catch (err: any) {
        this.logger.error(`Failed to import item: ${item.title || 'Unknown'}`, err instanceof Error ? (err.stack || String(err)) : String(err));
        skippedCount++;
      }
    }

    if (importedUrls.length > 0) {
      this.indexNowService.submitUrls(importedUrls).catch(err => {
        this.logger.error('Failed to submit URLs to IndexNow during import', err);
      });
    }

    return {
      totalFound: listings.length,
      imported: importedCount,
      skipped: skippedCount
    };
  }

  private extractMetadata(postmeta: any[]): Record<string, string> {
    const meta: Record<string, string> = {};
    if (!postmeta) return meta;
    
    const metas = Array.isArray(postmeta) ? postmeta : [postmeta];
    for (const m of metas) {
      meta[m['wp:meta_key']] = m['wp:meta_value'];
    }
    return meta;
  }

  private mapPropertyType(nicename: string): string {
    const mapping: Record<string, string> = {
      'houses': 'house',
      'apartments': 'apartment',
      'flats': 'flat',
      'commercial': 'commercial',
      'plots': 'plot',
    };
    return mapping[nicename] || 'other';
  }

  private async resolveCity(nicename: string, name: string): Promise<Types.ObjectId> {
    let city = await this.cityModel.findOne({ 
      $or: [{ slug: nicename }, { name: new RegExp(`^${name}$`, 'i') }] 
    });

    if (!city) {
      city = await this.cityModel.create({
        name,
        slug: nicename,
        isActive: true
      });
    }
    return city._id as Types.ObjectId;
  }

  private async resolveArea(nicename: string, name: string, cityId: Types.ObjectId): Promise<Types.ObjectId> {
    let area = await this.areaModel.findOne({
      city: cityId,
      $or: [{ slug: nicename }, { name: new RegExp(`^${name}$`, 'i') }]
    });

    if (!area) {
      area = await this.areaModel.create({
        name,
        slug: nicename,
        city: cityId,
        isActive: true
      });
    }
    return area._id as Types.ObjectId;
  }

  private async processImages(zipFile: Express.Multer.File, attachments: any[], imageMap: Map<string, string>) {
    try {
        const zip = new AdmZip(zipFile.buffer);
        const zipEntries = zip.getEntries();
        const entryMap = new Map<string, AdmZip.IZipEntry>();
        
        // Normalize paths for easier lookup
        zipEntries.forEach(entry => {
            if (!entry.isDirectory) {
               // zip paths might be "wp-content/uploads/2026/02/start.jpg" or just "2026/02/start.jpg"
               // The XML _wp_attached_file usually looks like "2026/02/start.jpg"
               // We should map the end of the zip path to the entry
               entryMap.set(entry.entryName, entry); // full path
               
               // Also try to map strict relative path if possible
               // A standard WXR export + wp-content/uploads zip usually matches by suffix
               // Let's rely on the fact that the user zips "uploads" folder.
               // So an entry might be "uploads/2025/10/img.jpg" or just "2025/10/img.jpg".
            }
        });

        for (const attachment of attachments) {
            const meta = this.extractMetadata(attachment['wp:postmeta']);
            const attachedFile = meta['_wp_attached_file']; // e.g., "2026/02/house.jpg"
            const postId = attachment['wp:post_id']; // e.g., "123"

            if (attachedFile && postId) {
                // Find matching zip entry
                // We search for an entry that ENDS with the attachedFile path
                // to handle different zipping root folders
                const entry = zipEntries.find(e => e.entryName.endsWith(attachedFile) && !e.isDirectory);
                
                if (entry) {
                    this.logger.log(`Processing image for ID ${postId}: ${attachedFile}`);
                    
                    // Create a mock Multer file for StorageService
                    const buffer = entry.getData();
                    const mimeType = this.getMimeType(attachedFile);
                    
                    const mockFile: Express.Multer.File = {
                        fieldname: 'file',
                        originalname: path.basename(attachedFile),
                        encoding: '7bit',
                        mimetype: mimeType,
                        buffer: buffer,
                        size: buffer.length,
                        stream: null as any,
                        destination: '',
                        filename: '',
                        path: ''
                    };

                    const key = await this.storageService.upload(mockFile, 'properties');
                    const url = this.storageService.getUrl(key);
                    imageMap.set(String(postId), url);
                }
            }
        }

    } catch (err) {
        this.logger.error('Failed to process zip file', err);
    }
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        default: return 'application/octet-stream';
    }
  }

  private async processImagesFromUrls(attachments: any[], imageMap: Map<string, string>) {
    this.logger.log(`Processing ${attachments.length} images from URLs...`);
    const CONCURRENT_LIMIT = 5; // Concurrency limit
    const storageService = this.storageService; // Capture local reference to avoid losing 'this' context/undefined errors in callback

    // Chunk array for concurrency control
    for (let i = 0; i < attachments.length; i += CONCURRENT_LIMIT) {
        const chunk = attachments.slice(i, i + CONCURRENT_LIMIT);
        await Promise.all(chunk.map(async (attachment) => {
            const postId = attachment['wp:post_id'];
            const url = attachment['wp:attachment_url'];
            
            if (postId && url) {
                try {
                    // Check if already mapped (e.g. from zip)
                    if (imageMap.has(String(postId))) return;

                    this.logger.log(`Downloading image for ID ${postId}: ${url}`);
                    
                    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
                    const buffer = Buffer.from(response.data);
                    
                    // Guess filename from URL
                    let filename = `image-${postId}.jpg`;
                    try {
                        filename = path.basename(new URL(url).pathname) || filename;
                    } catch (e) { /* ignore URL errors */ }

                    // Safely access headers and typecast
                    const mimeType = (response.headers ? response.headers['content-type'] : undefined) || this.getMimeType(filename);

                    const mockFile: Express.Multer.File = {
                        fieldname: 'file',
                        originalname: filename,
                        encoding: '7bit',
                        mimetype: mimeType as string,
                        buffer: buffer,
                        size: buffer.length,
                        stream: null as any,
                        destination: '',
                        filename: '',
                        path: ''
                    };

                    const key = await storageService.upload(mockFile, 'properties');
                    if (key) {
                        const storedUrl = storageService.getUrl(key);
                        imageMap.set(String(postId), storedUrl);
                    }

                } catch (err: any) {
                    this.logger.warn(`Failed to download image ${url} for ID ${postId}: ${err.message}`);
                }
            }
        }));
    }
  }
}
