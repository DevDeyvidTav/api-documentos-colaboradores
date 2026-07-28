import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  isTransactionConflict,
  isUniqueViolation,
} from '../common/database/database-errors.util';
import { DocumentRequirementsService } from '../document-requirements/document-requirements.service';
import { DocumentVersionsRepository } from './document-versions.repository';
import { CreateDocumentVersionDto } from './dto/create-document-version.dto';
import { SubmitDocumentVersionResult } from './dto/submit-document-version-result';
import { DocumentVersion } from './entities/document-version.entity';
import { buildDocumentVersionRequestHash } from './utils/document-version-request-hash.util';

const VERSION_CONFLICT_MESSAGE =
  'Não foi possível registrar o envio devido a um conflito de versão.';
const IDEMPOTENCY_PAYLOAD_CONFLICT_MESSAGE =
  'A Idempotency-Key informada já foi utilizada neste requisito com um payload diferente.';
const VERSION_NOT_FOUND_MESSAGE = 'Versão de documento não encontrada.';
const REQUIREMENT_NOT_FOUND_MESSAGE = 'Requisito documental não encontrado.';
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
    idempotencyKey: string,
  ): Promise<SubmitDocumentVersionResult> {
    const requestHash = buildDocumentVersionRequestHash(dto);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const requirement =
          await this.documentVersionsRepository.lockActiveRequirement(
            manager,
            requirementId,
          );
        if (!requirement) {
          throw new NotFoundException(REQUIREMENT_NOT_FOUND_MESSAGE);
        }

        const existing =
          await this.documentVersionsRepository.findByRequirementAndIdempotencyKey(
            manager,
            requirementId,
            idempotencyKey,
          );
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException(IDEMPOTENCY_PAYLOAD_CONFLICT_MESSAGE);
          }
          return { version: existing, replay: true };
        }

        const collaborator =
          await this.documentVersionsRepository.findActiveCollaborator(
            manager,
            requirement.collaboratorId,
          );
        if (!collaborator) {
          throw new NotFoundException(COLLABORATOR_INACTIVE_MESSAGE);
        }

        const documentType =
          await this.documentVersionsRepository.findActiveDocumentType(
            manager,
            requirement.documentTypeId,
          );
        if (!documentType) {
          throw new NotFoundException(DOCUMENT_TYPE_INACTIVE_MESSAGE);
        }

        await this.documentVersionsRepository.deactivateActiveVersions(
          manager,
          requirementId,
        );

        const versionNumber =
          await this.documentVersionsRepository.getNextVersionNumber(
            manager,
            requirementId,
          );

        const version =
          await this.documentVersionsRepository.createActiveVersion(manager, {
            requirementId,
            versionNumber,
            documentReference: dto.documentReference,
            idempotencyKey,
            requestHash,
            submittedAt: new Date(),
          });

        return { version, replay: false };
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      if (isUniqueViolation(error) || isTransactionConflict(error)) {
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
