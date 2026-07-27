import { ApiProperty } from '@nestjs/swagger';
import { CollaboratorResponseDto } from '../../collaborators/dto/collaborator-response.dto';

export class CollaboratorsPaginatedResponseDto {
  @ApiProperty({ type: [CollaboratorResponseDto] })
  items: CollaboratorResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
