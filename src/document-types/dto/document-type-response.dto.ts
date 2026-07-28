import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentTypeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({
    description: 'Descrição opcional do tipo de documento.',
    nullable: true,
  })
  description?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Preenchido quando o tipo de documento foi soft-deleted.',
    nullable: true,
  })
  deletedAt?: Date | null;
}
