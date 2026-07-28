import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isUniqueViolation } from '../common/database/database-errors.util';
import { DocumentRequirementsService } from '../document-requirements/document-requirements.service';
import { DocumentVersionsRepository } from './document-versions.repository';
import { CreateDocumentVersionDto } from './dto/create-document-version.dto';
import { DocumentVersion } from './entities/document-version.entity';

const VERSION_CONFLICT_MESSAGE =
  'Não foi possível registrar o envio devido a um conflito de versão.';
const VERSION_NOT_FOUND_MESSAGE = 'Versão de documento não encontrada.';
const COLLABORATOR_INACTIVE_MESSAGE = 'Colaborador não encontrado.';
const DOCUMENT_TYPE_INACTIVE_MESSAGE = 'Tipo de documento não encontrado.';

@Injectable()
export class DocumentVersionsService {
  constructor(
    private readonly documentVersionsRepository: DocumentVersionsRepository,
    private readonly documentRequirementsService: DocumentRequirementsService,
    private readonly dataSource: DataSource,
  ) {}

  async submit(
    requirementId: string,
    dto: CreateDocumentVersionDto,
  ): Promise<DocumentVersion> {
    const requirement =
      await this.documentRequirementsService.findOne(requirementId);

    if (requirement.collaborator.deletedAt != null) {
      throw new NotFoundException(COLLABORATOR_INACTIVE_MESSAGE);
    }
    if (requirement.documentType.deletedAt != null) {
      throw new NotFoundException(DOCUMENT_TYPE_INACTIVE_MESSAGE);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        await this.documentVersionsRepository.deactivateActiveVersions(
          manager,
          requirementId,
        );

        const versionNumber =
          await this.documentVersionsRepository.getNextVersionNumber(
            manager,
            requirementId,
          );

        return this.documentVersionsRepository.createActiveVersion(manager, {
          requirementId,
          versionNumber,
          documentReference: dto.documentReference,
          submittedAt: new Date(),
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(VERSION_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  async findByRequirementId(requirementId: string): Promise<DocumentVersion[]> {
    await this.documentRequirementsService.findOne(requirementId);
    return this.documentVersionsRepository.findByRequirementIdOrdered(
      requirementId,
    );
  }

  async findOne(id: string): Promise<DocumentVersion> {
    const version = await this.documentVersionsRepository.findById(id);
    if (!version) {
      throw new NotFoundException(VERSION_NOT_FOUND_MESSAGE);
    }
    return version;
  }
}
