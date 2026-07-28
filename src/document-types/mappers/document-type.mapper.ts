import { DocumentTypeResponseDto } from '../dto/document-type-response.dto';
import { DocumentType } from '../entities/document-type.entity';

export class DocumentTypeMapper {
  static toResponse(documentType: DocumentType): DocumentTypeResponseDto {
    return {
      id: documentType.id,
      name: documentType.name,
      description: documentType.description,
      createdAt: documentType.createdAt,
      updatedAt: documentType.updatedAt,
      ...(documentType.deletedAt != null
        ? { deletedAt: documentType.deletedAt }
        : {}),
    };
  }

  static toResponseList(
    documentTypes: DocumentType[],
  ): DocumentTypeResponseDto[] {
    return documentTypes.map((documentType) => this.toResponse(documentType));
  }
}
