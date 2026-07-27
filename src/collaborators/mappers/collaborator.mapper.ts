import { CollaboratorResponseDto } from '../dto/collaborator-response.dto';
import { Collaborator } from '../entities/collaborator.entity';

export class CollaboratorMapper {
  static toResponse(collaborator: Collaborator): CollaboratorResponseDto {
    return {
      id: collaborator.id,
      name: collaborator.name,
      email: collaborator.email,
      createdAt: collaborator.createdAt,
      updatedAt: collaborator.updatedAt,
      ...(collaborator.deletedAt != null
        ? { deletedAt: collaborator.deletedAt }
        : {}),
    };
  }

  static toResponseList(
    collaborators: Collaborator[],
  ): CollaboratorResponseDto[] {
    return collaborators.map((collaborator) => this.toResponse(collaborator));
  }
}
