import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { DocumentRequirement } from '../document-requirements/entities/document-requirement.entity';
import { DocumentType } from '../document-types/entities/document-type.entity';
import { DocumentVersion } from './entities/document-version.entity';

@Injectable()
export class DocumentVersionsRepository {
  constructor(
    @InjectRepository(DocumentVersion)
    private readonly repository: Repository<DocumentVersion>,
  ) {}

  findById(id: string): Promise<DocumentVersion | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByRequirementIdOrdered(
    requirementId: string,
  ): Promise<DocumentVersion[]> {
    return this.repository.find({
      where: { requirementId },
      order: { versionNumber: 'DESC' },
    });
  }

  lockActiveRequirement(
    manager: EntityManager,
    requirementId: string,
  ): Promise<DocumentRequirement | null> {
    return manager
      .createQueryBuilder(DocumentRequirement, 'requirement')
      .setLock('pessimistic_write')
      .where('requirement.id = :requirementId', { requirementId })
      .andWhere('requirement.deletedAt IS NULL')
      .getOne();
  }

  findActiveCollaborator(
    manager: EntityManager,
    collaboratorId: string,
  ): Promise<Collaborator | null> {
    return manager
      .createQueryBuilder(Collaborator, 'collaborator')
      .where('collaborator.id = :collaboratorId', { collaboratorId })
      .andWhere('collaborator.deletedAt IS NULL')
      .getOne();
  }

  findActiveDocumentType(
    manager: EntityManager,
    documentTypeId: string,
  ): Promise<DocumentType | null> {
    return manager
      .createQueryBuilder(DocumentType, 'documentType')
      .where('documentType.id = :documentTypeId', { documentTypeId })
      .andWhere('documentType.deletedAt IS NULL')
      .getOne();
  }

  findByRequirementAndIdempotencyKey(
    manager: EntityManager,
    requirementId: string,
    idempotencyKey: string,
  ): Promise<DocumentVersion | null> {
    return manager
      .createQueryBuilder(DocumentVersion, 'version')
      .where('version.requirementId = :requirementId', { requirementId })
      .andWhere('version.idempotencyKey = :idempotencyKey', { idempotencyKey })
      .getOne();
  }

  async deactivateActiveVersions(
    manager: EntityManager,
    requirementId: string,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(DocumentVersion)
      .set({ isActive: false })
      .where('requirement_id = :requirementId', { requirementId })
      .andWhere('is_active = true')
      .execute();
  }

  async getNextVersionNumber(
    manager: EntityManager,
    requirementId: string,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder(DocumentVersion, 'version')
      .select('MAX(version.versionNumber)', 'max')
      .where('version.requirementId = :requirementId', { requirementId })
      .getRawOne<{ max: string | null }>();

    const max = result?.max != null ? Number(result.max) : 0;
    return max + 1;
  }

  async createActiveVersion(
    manager: EntityManager,
    data: {
      requirementId: string;
      versionNumber: number;
      documentReference: string;
      idempotencyKey: string;
      requestHash: string;
      submittedAt: Date;
    },
  ): Promise<DocumentVersion> {
    const version = manager.create(DocumentVersion, {
      requirementId: data.requirementId,
      versionNumber: data.versionNumber,
      documentReference: data.documentReference,
      idempotencyKey: data.idempotencyKey,
      requestHash: data.requestHash,
      submittedAt: data.submittedAt,
      isActive: true,
    });

    return manager.save(version);
  }
}
