import { IsString, IsEmail, IsNotEmpty, IsOptional, IsNumber, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CementOrderItemDto {
  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsNumber()
  weightKg: number;

  @IsNumber()
  price: number;

  @IsNumber()
  quantity: number;

  @IsString()
  @IsOptional()
  image?: string;
}

export class CreateCementOrderDto {
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsEmail()
  @IsNotEmpty()
  customerEmail: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  deliveryInstruction?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CementOrderItemDto)
  items: CementOrderItemDto[];

  @IsNumber()
  subTotal: number;

  @IsNumber()
  deliveryCharges: number;

  @IsNumber()
  total: number;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;
}
