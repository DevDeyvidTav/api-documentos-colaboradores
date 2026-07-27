import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CollaboratorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Preenchido quando o colaborador foi soft-deleted.',
    nullable: true,
  })
  deletedAt?: Date | null;
}
