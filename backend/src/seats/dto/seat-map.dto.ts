import {
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SeatDefinition {
  @ApiProperty({ example: 'A' })
  @IsString()
  @MaxLength(10)
  row: string;

  @ApiProperty({ example: '1' })
  @IsString()
  @MaxLength(10)
  number: string;

  @ApiProperty({ example: 'A1' })
  @IsString()
  @MaxLength(20)
  label: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  x?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  y?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SeatCategoryInput {
  @ApiProperty()
  @IsString()
  sectionId: string;

  @ApiProperty({ example: 'VIP' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'VIP' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameVi?: string;

  @ApiProperty({ example: 500000, description: 'Price in VND (integer)' })
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ default: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: '#FF0000' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class SeatMapSection {
  @ApiProperty()
  @IsString()
  sectionId: string;

  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty({ type: [SeatDefinition] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatDefinition)
  seats: SeatDefinition[];
}

export class UploadSeatMapDto {
  @ApiProperty({ type: [SeatCategoryInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatCategoryInput)
  categories: SeatCategoryInput[];

  @ApiProperty({ type: [SeatMapSection] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatMapSection)
  sections: SeatMapSection[];
}

export class UpdateCategoryPriceDto {
  @ApiProperty({ example: 600000, description: 'New price in VND (integer)' })
  @IsInt()
  @Min(0)
  price: number;
}
