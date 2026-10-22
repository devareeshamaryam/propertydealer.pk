 import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { City, CityDocument } from '@rent-ghar/db/schemas/city.schema';
import { CreateCityDto } from '@rent-ghar/dtos/city/createcity.dto';
import { UpdateCityDto } from '@rent-ghar/dtos/city/updatecity.dto';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';
import { cleanPlaceName } from '../common/place-name';
import { DISCORD_COLORS, DiscordService } from '../notify/discord.service';

const TAG_CITIES = 'cities';

@Injectable()
export class CityService {
    constructor(
        @InjectModel(City.name) private cityModel: Model<CityDocument>,
        private readonly cache: RedisCacheService,
        private readonly revalidate: RevalidateService,
        private readonly discord: DiscordService,
    ) {}

    private async bustCityCaches() {
        await this.revalidate.revalidate({
            tags: [TAG_CITIES],
            paths: ['/', '/properties'],
        });
    }

    private toTitleCase(str: string): string {
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    /**
     * An agent adds the city their listing is in. An existing city with the
     * same name (any case or spacing) is returned instead of a copy. New ones
     * are marked source 'agent' for the admin's Cities list.
     */
    async suggestCity(rawName: string) {
        const lower = cleanPlaceName(rawName, 'city');
        const loose = lower.replace(/[^a-z0-9]+/g, '');
        const all = await this.cityModel.collection.find({}, { projection: { name: 1 } }).toArray();
        const hit: any = all.find((c: any) => String(c.name).toLowerCase().replace(/[^a-z0-9]+/g, '') === loose);
        if (hit) return { _id: String(hit._id), name: hit.name, created: false };
        const name = this.toTitleCase(lower);
        const now = new Date();
        const r = await this.cityModel.collection.insertOne({ name, source: 'agent', createdAt: now, updatedAt: now } as any);
        this.bustCityCaches().catch(() => {});
        this.discord.send({
            title: '🏙️ New city added by an agent',
            description: `**${name}** — check the spelling in Cities.`,
            url: '/dashboard/city',
            color: DISCORD_COLORS.info,
            category: 'Places',
            links: [{ label: 'Cities', url: '/dashboard/city' }],
        });
        return { _id: String(r.insertedId), name, created: true };
    }

    async createCity(createCityDto: CreateCityDto): Promise<CityDocument> {
        try {
            const normalizedName = this.toTitleCase(createCityDto.name.trim());
            const normalizedState = createCityDto.state?.trim() ? this.toTitleCase(createCityDto.state.trim()) : undefined;
            const normalizedCountry = createCityDto.country?.trim() ? this.toTitleCase(createCityDto.country.trim()) : undefined;

            const existingCity = await this.cityModel.findOne({
                name: { $regex: new RegExp(`^${normalizedName}$`, 'i') }
            }).exec();

            if (existingCity) {
                throw new BadRequestException('City with this name already exists');
            }

            const cityData: any = { name: normalizedName };

            if (normalizedState)   cityData.state   = normalizedState;
            if (normalizedCountry) cityData.country = normalizedCountry;

            if (createCityDto.metaTitle)          cityData.metaTitle          = createCityDto.metaTitle;
            if (createCityDto.metaDescription)    cityData.metaDescription    = createCityDto.metaDescription;
            if (createCityDto.canonicalUrl)       cityData.canonicalUrl       = createCityDto.canonicalUrl;
            if (createCityDto.rentMetaTitle)      cityData.rentMetaTitle      = createCityDto.rentMetaTitle;
            if (createCityDto.rentMetaDescription)cityData.rentMetaDescription= createCityDto.rentMetaDescription;
            if (createCityDto.saleMetaTitle)      cityData.saleMetaTitle      = createCityDto.saleMetaTitle;
            if (createCityDto.saleMetaDescription)cityData.saleMetaDescription= createCityDto.saleMetaDescription;
            if (createCityDto.description)        cityData.description        = createCityDto.description;
            if (createCityDto.rentContent)        cityData.rentContent        = createCityDto.rentContent;
            if (createCityDto.saleContent)        cityData.saleContent        = createCityDto.saleContent;
            if (createCityDto.buyContent)         cityData.buyContent         = createCityDto.buyContent;
            if (createCityDto.thumbnail)          cityData.thumbnail          = createCityDto.thumbnail;
            if (createCityDto.typeContents)       cityData.typeContents       = createCityDto.typeContents;
            if (createCityDto.sizeContents)       cityData.sizeContents       = createCityDto.sizeContents; // 🆕

            const createdCity = new this.cityModel(cityData);
            const saved = await createdCity.save();
            this.bustCityCaches().catch(() => {});
            return saved;
        } catch (error: any) {
            if (error.code === 11000 || error.codeName === 'DuplicateKey') {
                throw new BadRequestException('City with this name already exists');
            }
            if (error instanceof BadRequestException) throw error;
            console.error('Error creating city:', error);
            throw error;
        }
    }

    /**
     * Just the names (and photo) — for dropdowns and shortcuts. The full list
     * carries every city's SEO content and is about a megabyte; a dropdown
     * needs a few kilobytes.
     */
    async findCityNames(): Promise<Array<{ _id: string; name: string; thumbnail?: string; state?: string; country?: string; createdAt?: Date }>> {
        return this.cache.wrap(
            this.cache.buildKey('cities:names:v2', []),
            async () => {
                // Everything a list or dropdown shows — and none of the SEO text.
                const rows = await this.cityModel.find().select('name thumbnail state country createdAt').sort({ name: 1 }).lean().exec();
                return rows.map((c: any) => ({ _id: String(c._id), name: c.name, thumbnail: c.thumbnail || undefined, state: c.state, country: c.country, createdAt: c.createdAt }));
            },
            { ttl: 3600, tags: [TAG_CITIES] },
        );
    }

    async findAllCities(): Promise<CityDocument[]> {
        return this.cache.wrap(
            this.cache.buildKey('cities:all', []),
            async () => {
                try {
                    return await this.cityModel.find().sort({ name: 1 }).lean().exec() as unknown as CityDocument[];
                } catch (error) {
                    console.error('Error in findAllCities:', error);
                    throw error;
                }
            },
            { ttl: 3600, tags: [TAG_CITIES] },
        );
    }

    async findCityById(id: string): Promise<CityDocument> {
        const city = await this.cityModel.findById(id).exec();
        if (!city) {
            throw new NotFoundException('City not found');
        }
        return city as CityDocument;
    }

    async findCityByName(name: string): Promise<CityDocument> {
        return this.cache.wrap(
            this.cache.buildKey('city:name', [name.trim().toLowerCase()]),
            async () => {
                const city = await this.cityModel.findOne({
                    name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
                }).exec();
                if (!city) {
                    throw new NotFoundException(`City ${name} not found`);
                }
                return city as CityDocument;
            },
            { ttl: 3600, tags: [TAG_CITIES] },
        );
    }

    async updateCity(id: string, updateCityDto: UpdateCityDto): Promise<CityDocument> {
        try {
            const existingCity = await this.cityModel.findById(id).exec();
            if (!existingCity) {
                throw new NotFoundException('City not found');
            }

            const updateData: any = {};

            if (updateCityDto.name) {
                const newName = this.toTitleCase(updateCityDto.name.trim());
                const duplicateCity = await this.cityModel.findOne({
                    name: { $regex: new RegExp(`^${newName}$`, 'i') },
                    _id: { $ne: id }
                }).exec();
                if (duplicateCity) {
                    throw new BadRequestException('City with this name already exists');
                }
                updateData.name = newName;
            }

            if (updateCityDto.state !== undefined) {
                const trimmedState = updateCityDto.state.trim();
                updateData.state = trimmedState ? this.toTitleCase(trimmedState) : undefined;
            }

            if (updateCityDto.country !== undefined) {
                const trimmedCountry = updateCityDto.country.trim();
                updateData.country = trimmedCountry ? this.toTitleCase(trimmedCountry) : undefined;
            }

            if (updateCityDto.metaTitle          !== undefined) updateData.metaTitle          = updateCityDto.metaTitle;
            if (updateCityDto.metaDescription     !== undefined) updateData.metaDescription    = updateCityDto.metaDescription;
            if (updateCityDto.canonicalUrl        !== undefined) updateData.canonicalUrl       = updateCityDto.canonicalUrl;
            if (updateCityDto.rentMetaTitle       !== undefined) updateData.rentMetaTitle      = updateCityDto.rentMetaTitle;
            if (updateCityDto.rentMetaDescription !== undefined) updateData.rentMetaDescription= updateCityDto.rentMetaDescription;
            if (updateCityDto.saleMetaTitle       !== undefined) updateData.saleMetaTitle      = updateCityDto.saleMetaTitle;
            if (updateCityDto.saleMetaDescription !== undefined) updateData.saleMetaDescription= updateCityDto.saleMetaDescription;
            if (updateCityDto.description         !== undefined) updateData.description        = updateCityDto.description;
            if (updateCityDto.rentContent         !== undefined) updateData.rentContent        = updateCityDto.rentContent;
            if (updateCityDto.saleContent         !== undefined) updateData.saleContent        = updateCityDto.saleContent;
            if (updateCityDto.buyContent          !== undefined) updateData.buyContent         = updateCityDto.buyContent;
            if (updateCityDto.thumbnail           !== undefined) updateData.thumbnail          = updateCityDto.thumbnail;
            if (updateCityDto.typeContents        !== undefined) updateData.typeContents       = updateCityDto.typeContents;
            if (updateCityDto.sizeContents        !== undefined) updateData.sizeContents       = updateCityDto.sizeContents; // 🆕

            const city = await this.cityModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
            if (!city) {
                throw new NotFoundException('City not found');
            }
            this.bustCityCaches().catch(() => {});
            return city;
        } catch (error: any) {
            if (error.code === 11000 || error.codeName === 'DuplicateKey') {
                throw new BadRequestException('City with this name already exists');
            }
            if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
            console.error('Error updating city:', error);
            throw error;
        }
    }

    async deleteCity(id: string): Promise<void> {
        const city = await this.cityModel.findByIdAndDelete(id).exec();
        if (!city) {
            throw new NotFoundException('City not found');
        }
        this.bustCityCaches().catch(() => {});
    }
}