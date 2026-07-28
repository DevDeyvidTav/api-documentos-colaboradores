import { ApiProperty } from '@nestjs/swagger';
import { DocumentTypeResponseDto } from './document-type-response.dto';

export class DocumentTypesPaginatedResponseDto {
  @ApiProperty({ type: [DocumentTypeResponseDto] })
  items: DocumentTypeResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
