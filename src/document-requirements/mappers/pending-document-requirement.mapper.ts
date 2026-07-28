import { PendingDocumentRequirementResponseDto } from '../dto/pending-document-requirement-response.dto';
import { DocumentRequirement } from '../entities/document-requirement.entity';

export class PendingDocumentRequirementMapper {
  static toResponse(
    requirement: DocumentRequirement,
  ): PendingDocumentRequirementResponseDto {
    return {
      requirementId: requirement.id,
      collaborator: {
        id: requirement.collaborator.id,
        name: requirement.collaborator.name,
        email: requirement.collaborator.email,
      },
      documentType: {
        id: requirement.documentType.id,
        name: requirement.documentType.name,
      },
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt,
    };
  }

  static toResponseList(
    requirements: DocumentRequirement[],
  ): PendingDocumentRequirementResponseDto[] {
    return requirements.map((requirement) => this.toResponse(requirement));
  }
}
