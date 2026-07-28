import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateDocumentRequirementDto {
  @ApiProperty({
    format: 'uuid',
    example: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
  })
  @IsUUID()
  collaboratorId: string;

  @ApiProperty({
    format: 'uuid',
    example: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
  })
  @IsUUID()
  documentTypeId: string;
}
