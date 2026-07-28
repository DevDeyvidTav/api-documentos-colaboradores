import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUniqueViolation } from '../common/database/database-errors.util';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { DocumentTypesRepository } from './document-types.repository';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { DocumentTypeListStatus } from './dto/document-type-list-status.enum';
import { ListDocumentTypesQueryDto } from './dto/list-document-types-query.dto';
import { DocumentType } from './entities/document-type.entity';

const NAME_IN_USE_MESSAGE =
  'Já existe um tipo de documento ativo cadastrado com este nome.';
const NOT_FOUND_MESSAGE = 'Tipo de documento não encontrado.';

@Injectable()
export class DocumentTypesService {
  constructor(
    private readonly documentTypesRepository: DocumentTypesRepository,
  ) {}

  async create(dto: CreateDocumentTypeDto): Promise<DocumentType> {
    const existing = await this.documentTypesRepository.findActiveByName(
      dto.name,
    );
    if (existing) {
      throw new ConflictException(NAME_IN_USE_MESSAGE);
    }

    const documentType = this.documentTypesRepository.create({
      name: dto.name,
      description: dto.description ?? null,
    });

    try {
      return await this.documentTypesRepository.save(documentType);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(NAME_IN_USE_MESSAGE);
      }
      throw error;
    }
  }

  async findAll(
    query: ListDocumentTypesQueryDto,
  ): Promise<PaginatedResponseDto<DocumentType>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const status = query.status ?? DocumentTypeListStatus.Active;

    const [items, total] = await this.documentTypesRepository.paginate({
      page,
      limit,
      status,
      name: query.name,
    });

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<DocumentType> {
    const documentType = await this.documentTypesRepository.findActiveById(id);
    if (!documentType) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return documentType;
  }

  async remove(id: string): Promise<void> {
    const wasDeleted = await this.documentTypesRepository.softDeleteActive(id);
    if (!wasDeleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }
}
