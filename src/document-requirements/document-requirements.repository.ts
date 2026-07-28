import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { DocumentRequirementListStatus } from './dto/document-requirement-list-status.enum';
import { DocumentRequirement } from './entities/document-requirement.entity';

export interface PaginateDocumentRequirementsOptions {
  page: number;
  limit: number;
  status?: DocumentRequirementListStatus;
  collaboratorId?: string;
  documentTypeId?: string;
}

@Injectable()
export class DocumentRequirementsRepository {
  constructor(
    @InjectRepository(DocumentRequirement)
    private readonly repository: Repository<DocumentRequirement>,
  ) {}

  create(
    data: Pick<DocumentRequirement, 'collaboratorId' | 'documentTypeId'>,
  ): DocumentRequirement {
    return this.repository.create(data);
  }

  save(requirement: DocumentRequirement): Promise<DocumentRequirement> {
    return this.repository.save(requirement);
  }

  findActiveByCollaboratorAndDocumentType(
    collaboratorId: string,
    documentTypeId: string,
  ): Promise<DocumentRequirement | null> {
    return this.repository
      .createQueryBuilder('requirement')
      .where('requirement.collaboratorId = :collaboratorId', { collaboratorId })
      .andWhere('requirement.documentTypeId = :documentTypeId', {
        documentTypeId,
      })
      .andWhere('requirement.deletedAt IS NULL')
      .getOne();
  }

  findActiveById(id: string): Promise<DocumentRequirement | null> {
    return this.createBaseQuery()
      .where('requirement.id = :id', { id })
      .andWhere('requirement.deletedAt IS NULL')
      .getOne();
  }

  async paginate(
    options: PaginateDocumentRequirementsOptions,
  ): Promise<[DocumentRequirement[], number]> {
    const status = options.status ?? DocumentRequirementListStatus.Active;
    const query = this.createBaseQuery();

    if (status === DocumentRequirementListStatus.Active) {
      query.where('requirement.deletedAt IS NULL');
    } else if (status === DocumentRequirementListStatus.Deleted) {
      query.where('requirement.deletedAt IS NOT NULL');
    }

    if (options.collaboratorId) {
      query.andWhere('requirement.collaboratorId = :collaboratorId', {
        collaboratorId: options.collaboratorId,
      });
    }

    if (options.documentTypeId) {
      query.andWhere('requirement.documentTypeId = :documentTypeId', {
        documentTypeId: options.documentTypeId,
      });
    }

    query
      .orderBy('requirement.createdAt', 'DESC')
      .addOrderBy('requirement.id', 'DESC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit);

    return query.getManyAndCount();
  }

  async softDeleteActive(id: string): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .softDelete()
      .where('id = :id', { id })
      .andWhere('deleted_at IS NULL')
      .execute();

    return (result.affected ?? 0) > 0;
  }

  /**
   * withDeleted() no QB principal para:
   * - listar requisitos soft-deleted quando status=deleted|all;
   * - carregar collaborator/documentType mesmo se soft-deleted (histórico).
   * O filtro de status do requisito é aplicado explicitamente pelos callers.
   */
  private createBaseQuery(): SelectQueryBuilder<DocumentRequirement> {
    return this.repository
      .createQueryBuilder('requirement')
      .withDeleted()
      .leftJoinAndSelect('requirement.collaborator', 'collaborator')
      .leftJoinAndSelect('requirement.documentType', 'documentType');
  }
}
