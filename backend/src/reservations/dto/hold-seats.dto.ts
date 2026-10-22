import { IsString, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HoldSeatsDto {
  @ApiProperty()
  @IsString()
  showtimeId: string;

  @ApiProperty({ type: [String], description: 'Array of seat IDs to hold' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  seatIds: string[];
}

export class ReleaseSeatsDto {
  @ApiProperty()
  @IsString()
  showtimeId: string;

  @ApiProperty({ type: [String], description: 'Array of seat IDs to release' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  seatIds: string[];
}
