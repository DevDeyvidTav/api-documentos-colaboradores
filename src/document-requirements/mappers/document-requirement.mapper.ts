import { DocumentRequirementResponseDto } from '../dto/document-requirement-response.dto';
import { DocumentRequirement } from '../entities/document-requirement.entity';

export class DocumentRequirementMapper {
  static toResponse(
    requirement: DocumentRequirement,
  ): DocumentRequirementResponseDto {
    return {
      id: requirement.id,
      collaborator: {
        id: requirement.collaborator.id,
        name: requirement.collaborator.name,
        email: requirement.collaborator.email,
      },
      documentType: {
        id: requirement.documentType.id,
        name: requirement.documentType.name,
        description: requirement.documentType.description,
      },
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt,
      ...(requirement.deletedAt != null
        ? { deletedAt: requirement.deletedAt }
        : {}),
    };
  }

  static toResponseList(
    requirements: DocumentRequirement[],
  ): DocumentRequirementResponseDto[] {
    return requirements.map((requirement) => this.toResponse(requirement));
  }
}
