 import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { City, CityDocument } from '@rent-ghar/db/schemas/city.schema';
import { CreateCityDto } from '@rent-ghar/dtos/city/createcity.dto';
import { UpdateCityDto } from '@rent-ghar/dtos/city/updatecity.dto';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';

const TAG_CITIES = 'cities';

@Injectable()
export class CityService {
    constructor(
        @InjectModel(City.name) private cityModel: Model<CityDocument>,
        private readonly cache: RedisCacheService,
        private readonly revalidate: RevalidateService,
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

    async findAllCities(): Promise<CityDocument[]> {
        return this.cache.wrap(
            this.cache.buildKey('cities:all', []),
            async () => {
                try {
                    return await this.cityModel.find().sort({ name: 1 }).exec();
                } catch (error) {
                    console.error('Error in findAllCities:', error);
                    throw error;
                }
            },
            { ttl: 60, tags: [TAG_CITIES] },
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
            { ttl: 60, tags: [TAG_CITIES] },
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