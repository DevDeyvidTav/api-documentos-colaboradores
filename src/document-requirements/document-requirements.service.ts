import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CollaboratorsService } from '../collaborators/collaborators.service';
import { isUniqueViolation } from '../common/database/database-errors.util';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { DocumentTypesService } from '../document-types/document-types.service';
import { DocumentRequirementsRepository } from './document-requirements.repository';
import { CreateDocumentRequirementDto } from './dto/create-document-requirement.dto';
import { DocumentRequirementListStatus } from './dto/document-requirement-list-status.enum';
import { ListDocumentRequirementsQueryDto } from './dto/list-document-requirements-query.dto';
import { ListPendingDocumentRequirementsQueryDto } from './dto/list-pending-document-requirements-query.dto';
import { DocumentRequirement } from './entities/document-requirement.entity';

const DUPLICATE_REQUIREMENT_MESSAGE =
  'Já existe um requisito ativo para este colaborador e tipo de documento.';
const NOT_FOUND_MESSAGE = 'Requisito documental não encontrado.';

export interface PendingDocumentRequirementsPage {
  items: DocumentRequirement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class DocumentRequirementsService {
  constructor(
    private readonly documentRequirementsRepository: DocumentRequirementsRepository,
    private readonly collaboratorsService: CollaboratorsService,
    private readonly documentTypesService: DocumentTypesService,
  ) {}

  async create(
    dto: CreateDocumentRequirementDto,
  ): Promise<DocumentRequirement> {
    await this.collaboratorsService.findOne(dto.collaboratorId);
    await this.documentTypesService.findOne(dto.documentTypeId);

    const existing =
      await this.documentRequirementsRepository.findActiveByCollaboratorAndDocumentType(
        dto.collaboratorId,
        dto.documentTypeId,
      );
    if (existing) {
      throw new ConflictException(DUPLICATE_REQUIREMENT_MESSAGE);
    }

    const requirement = this.documentRequirementsRepository.create({
      collaboratorId: dto.collaboratorId,
      documentTypeId: dto.documentTypeId,
    });

    try {
      const saved = await this.documentRequirementsRepository.save(requirement);
      const loaded = await this.documentRequirementsRepository.findActiveById(
        saved.id,
      );
      if (!loaded) {
        throw new NotFoundException(NOT_FOUND_MESSAGE);
      }
      return loaded;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_REQUIREMENT_MESSAGE);
      }
      throw error;
    }
  }

  async findAll(
    query: ListDocumentRequirementsQueryDto,
  ): Promise<PaginatedResponseDto<DocumentRequirement>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const status = query.status ?? DocumentRequirementListStatus.Active;

    const [items, total] = await this.documentRequirementsRepository.paginate({
      page,
      limit,
      status,
      collaboratorId: query.collaboratorId,
      documentTypeId: query.documentTypeId,
    });

    return { items, total, page, limit };
  }

  async findPending(
    query: ListPendingDocumentRequirementsQueryDto,
  ): Promise<PendingDocumentRequirementsPage> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const status = query.status ?? DocumentRequirementListStatus.Active;

    const [items, total] =
      await this.documentRequirementsRepository.paginatePending({
        page,
        limit,
        status,
        collaboratorId: query.collaboratorId,
        documentTypeId: query.documentTypeId,
        name: query.name,
        createdAfter: query.createdAfter,
        createdBefore: query.createdBefore,
      });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return { items, total, page, limit, totalPages };
  }

  async findOne(id: string): Promise<DocumentRequirement> {
    const requirement =
      await this.documentRequirementsRepository.findActiveById(id);
    if (!requirement) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return requirement;
  }

  async remove(id: string): Promise<void> {
    const wasDeleted =
      await this.documentRequirementsRepository.softDeleteActive(id);
    if (!wasDeleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }
}
