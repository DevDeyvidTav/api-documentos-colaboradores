import { DocumentVersionResponseDto } from '../dto/document-version-response.dto';
import { DocumentVersion } from '../entities/document-version.entity';

export class DocumentVersionMapper {
  static toResponse(version: DocumentVersion): DocumentVersionResponseDto {
    return {
      id: version.id,
      requirementId: version.requirementId,
      versionNumber: version.versionNumber,
      isActive: version.isActive,
      documentReference: version.documentReference,
      submittedAt: version.submittedAt,
      createdAt: version.createdAt,
    };
  }

  static toResponseList(
    versions: DocumentVersion[],
  ): DocumentVersionResponseDto[] {
    return versions.map((version) => this.toResponse(version));
  }
}
