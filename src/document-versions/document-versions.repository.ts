import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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
      submittedAt: Date;
    },
  ): Promise<DocumentVersion> {
    const version = manager.create(DocumentVersion, {
      requirementId: data.requirementId,
      versionNumber: data.versionNumber,
      documentReference: data.documentReference,
      submittedAt: data.submittedAt,
      isActive: true,
    });

    return manager.save(version);
  }
}
