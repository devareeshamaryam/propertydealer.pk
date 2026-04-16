import { Controller, Get, Post, Body , Param, Put, Delete, UsePipes, ValidationPipe, UseGuards} from '@nestjs/common';
import { CityService } from './city.service';
import { CreateCityDto } from '@rent-ghar/dtos/city/createcity.dto';
import { CityDocument } from '@rent-ghar/db/schemas/city.schema';
import { UpdateCityDto } from '@rent-ghar/dtos/city/updatecity.dto';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('cities')
export class CityController {
    constructor(private readonly cityService: CityService){}

    @Post()
    @UseGuards(JwtAuthGuard, AdminGuard)
    async createCity(@Body() createCityDto: CreateCityDto): Promise<CityDocument> {
        try {
            return await this.cityService.createCity(createCityDto);
        } catch (error) {
            console.error('Error in createCity controller:', error);
            throw error;
        }
    }

    @Get()
    async findAllCities(): Promise<CityDocument[]> {
        try {
            return await this.cityService.findAllCities();
        } catch (error) {
            console.error('Error in findAllCities controller:', error);
            throw error;
        }
    }

    @Get('name/:name')
    async findCityByName(@Param('name') name: string): Promise<CityDocument> {
        return this.cityService.findCityByName(name);
    }

    @Get(':id')
    async findCityById(@Param('id') id: string): Promise<CityDocument> {
        return this.cityService.findCityById(id);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async updateCity(@Param('id') id: string, @Body() updateCityDto: UpdateCityDto): Promise<CityDocument> {
        return await this.cityService.updateCity(id, updateCityDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async deleteCity(@Param('id') id: string): Promise<void> {
        await this.cityService.deleteCity(id);
    }
}
