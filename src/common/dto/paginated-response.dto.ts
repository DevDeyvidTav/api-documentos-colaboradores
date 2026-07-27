import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  items: T[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
