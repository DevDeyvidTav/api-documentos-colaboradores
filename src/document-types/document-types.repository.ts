import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentTypeListStatus } from './dto/document-type-list-status.enum';
import { DocumentType } from './entities/document-type.entity';

export interface PaginateDocumentTypesOptions {
  page: number;
  limit: number;
  status?: DocumentTypeListStatus;
  name?: string;
}

@Injectable()
export class DocumentTypesRepository {
  constructor(
    @InjectRepository(DocumentType)
    private readonly repository: Repository<DocumentType>,
  ) {}

  create(
    data: Pick<DocumentType, 'name'> & { description?: string | null },
  ): DocumentType {
    return this.repository.create(data);
  }

  save(documentType: DocumentType): Promise<DocumentType> {
    return this.repository.save(documentType);
  }

  findActiveByName(name: string): Promise<DocumentType | null> {
    return this.repository
      .createQueryBuilder('documentType')
      .where('documentType.name = :name', { name })
      .andWhere('documentType.deletedAt IS NULL')
      .getOne();
  }

  findActiveById(id: string): Promise<DocumentType | null> {
    return this.repository
      .createQueryBuilder('documentType')
      .where('documentType.id = :id', { id })
      .andWhere('documentType.deletedAt IS NULL')
      .getOne();
  }

  async paginate(
    options: PaginateDocumentTypesOptions,
  ): Promise<[DocumentType[], number]> {
    const status = options.status ?? DocumentTypeListStatus.Active;
    const query = this.repository.createQueryBuilder('documentType');

    if (status !== DocumentTypeListStatus.Active) {
      query.withDeleted();
    }

    if (status === DocumentTypeListStatus.Active) {
      query.where('documentType.deletedAt IS NULL');
    } else if (status === DocumentTypeListStatus.Deleted) {
      query.where('documentType.deletedAt IS NOT NULL');
    }

    if (options.name) {
      query.andWhere('documentType.name ILIKE :name', {
        name: `%${options.name}%`,
      });
    }

    if (status === DocumentTypeListStatus.Deleted) {
      query
        .orderBy('documentType.deletedAt', 'DESC')
        .addOrderBy('documentType.id', 'DESC');
    } else {
      query
        .orderBy('documentType.createdAt', 'DESC')
        .addOrderBy('documentType.id', 'DESC');
    }

    query.skip((options.page - 1) * options.limit).take(options.limit);

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
}
