import { ApiProperty } from '@nestjs/swagger';
import { DocumentRequirementResponseDto } from './document-requirement-response.dto';

export class DocumentRequirementsPaginatedResponseDto {
  @ApiProperty({ type: [DocumentRequirementResponseDto] })
  items: DocumentRequirementResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
