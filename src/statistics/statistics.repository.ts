import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { DocumentRequirement } from '../document-requirements/entities/document-requirement.entity';
import { DocumentType } from '../document-types/entities/document-type.entity';
import { DocumentVersion } from '../document-versions/entities/document-version.entity';

export interface RequirementTotalsRaw {
  requirements: string;
  completed: string;
  pending: string;
}

export interface MostPendingDocumentTypeRaw {
  documentTypeId: string;
  documentTypeName: string;
  pendingCount: string;
}

export interface LatestSubmissionRaw {
  documentVersionId: string;
  versionNumber: string;
  submittedAt: Date;
  collaboratorId: string;
  collaboratorName: string;
  documentTypeId: string;
  documentTypeName: string;
}

export const LATEST_SUBMISSIONS_LIMIT = 10;

@Injectable()
export class StatisticsRepository {
  constructor(
    @InjectRepository(DocumentRequirement)
    private readonly requirementRepository: Repository<DocumentRequirement>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepository: Repository<DocumentVersion>,
  ) {}

  async getRequirementTotals(): Promise<{
    requirements: number;
    completed: number;
    pending: number;
  }> {
    const raw = await this.requirementRepository
      .createQueryBuilder('requirement')
      .innerJoin(
        Collaborator,
        'collaborator',
        'collaborator.id = requirement.collaboratorId AND collaborator.deletedAt IS NULL',
      )
      .innerJoin(
        DocumentType,
        'documentType',
        'documentType.id = requirement.documentTypeId AND documentType.deletedAt IS NULL',
      )
      .leftJoin(
        DocumentVersion,
        'activeVersion',
        'activeVersion.requirementId = requirement.id AND activeVersion.isActive = true',
      )
      .select('COUNT(requirement.id)', 'requirements')
      .addSelect(
        'COUNT(CASE WHEN activeVersion.id IS NOT NULL THEN 1 END)',
        'completed',
      )
      .addSelect(
        'COUNT(CASE WHEN activeVersion.id IS NULL THEN 1 END)',
        'pending',
      )
      .where('requirement.deletedAt IS NULL')
      .getRawOne<RequirementTotalsRaw>();

    return {
      requirements: Number(raw?.requirements ?? 0),
      completed: Number(raw?.completed ?? 0),
      pending: Number(raw?.pending ?? 0),
    };
  }

  async findMostPendingDocumentTypes(): Promise<
    Array<{
      documentTypeId: string;
      documentTypeName: string;
      pendingCount: number;
    }>
  > {
    const rows = await this.requirementRepository
      .createQueryBuilder('requirement')
      .innerJoin(
        Collaborator,
        'collaborator',
        'collaborator.id = requirement.collaboratorId AND collaborator.deletedAt IS NULL',
      )
      .innerJoin(
        DocumentType,
        'documentType',
        'documentType.id = requirement.documentTypeId AND documentType.deletedAt IS NULL',
      )
      .leftJoin(
        DocumentVersion,
        'activeVersion',
        'activeVersion.requirementId = requirement.id AND activeVersion.isActive = true',
      )
      .select('documentType.id', 'documentTypeId')
      .addSelect('documentType.name', 'documentTypeName')
      .addSelect('COUNT(requirement.id)', 'pendingCount')
      .where('requirement.deletedAt IS NULL')
      .andWhere('activeVersion.id IS NULL')
      .groupBy('documentType.id')
      .addGroupBy('documentType.name')
      .orderBy('COUNT(requirement.id)', 'DESC')
      .addOrderBy('documentType.name', 'ASC')
      .getRawMany<MostPendingDocumentTypeRaw>();

    return rows.map((row) => ({
      documentTypeId: row.documentTypeId,
      documentTypeName: row.documentTypeName,
      pendingCount: Number(row.pendingCount),
    }));
  }

  async findLatestSubmissions(
    limit: number = LATEST_SUBMISSIONS_LIMIT,
  ): Promise<
    Array<{
      documentVersionId: string;
      versionNumber: number;
      submittedAt: Date;
      collaborator: { id: string; name: string };
      documentType: { id: string; name: string };
    }>
  > {
    const rows = await this.versionRepository
      .createQueryBuilder('version')
      .innerJoin(
        DocumentRequirement,
        'requirement',
        'requirement.id = version.requirementId AND requirement.deletedAt IS NULL',
      )
      .innerJoin(
        Collaborator,
        'collaborator',
        'collaborator.id = requirement.collaboratorId AND collaborator.deletedAt IS NULL',
      )
      .innerJoin(
        DocumentType,
        'documentType',
        'documentType.id = requirement.documentTypeId AND documentType.deletedAt IS NULL',
      )
      .select('version.id', 'documentVersionId')
      .addSelect('version.versionNumber', 'versionNumber')
      .addSelect('version.submittedAt', 'submittedAt')
      .addSelect('collaborator.id', 'collaboratorId')
      .addSelect('collaborator.name', 'collaboratorName')
      .addSelect('documentType.id', 'documentTypeId')
      .addSelect('documentType.name', 'documentTypeName')
      .orderBy('version.submittedAt', 'DESC')
      .addOrderBy('version.id', 'DESC')
      .limit(limit)
      .getRawMany<LatestSubmissionRaw>();

    return rows.map((row) => ({
      documentVersionId: row.documentVersionId,
      versionNumber: Number(row.versionNumber),
      submittedAt: row.submittedAt,
      collaborator: {
        id: row.collaboratorId,
        name: row.collaboratorName,
      },
      documentType: {
        id: row.documentTypeId,
        name: row.documentTypeName,
      },
    }));
  }
}
