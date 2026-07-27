import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUniqueViolation } from '../common/database/database-errors.util';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CollaboratorsRepository } from './collaborators.repository';
import { CreateCollaboratorDto } from './dto/create-collaborator.dto';
import { CollaboratorListStatus } from './dto/collaborator-list-status.enum';
import { ListCollaboratorsQueryDto } from './dto/list-collaborators-query.dto';
import { Collaborator } from './entities/collaborator.entity';

const EMAIL_IN_USE_MESSAGE =
  'Já existe um colaborador ativo cadastrado com este e-mail.';
const NOT_FOUND_MESSAGE = 'Colaborador não encontrado.';

@Injectable()
export class CollaboratorsService {
  constructor(
    private readonly collaboratorsRepository: CollaboratorsRepository,
  ) {}

  async create(dto: CreateCollaboratorDto): Promise<Collaborator> {
    const existing = await this.collaboratorsRepository.findActiveByEmail(
      dto.email,
    );
    if (existing) {
      throw new ConflictException(EMAIL_IN_USE_MESSAGE);
    }

    const collaborator = this.collaboratorsRepository.create({
      name: dto.name,
      email: dto.email,
    });

    try {
      return await this.collaboratorsRepository.save(collaborator);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(EMAIL_IN_USE_MESSAGE);
      }
      throw error;
    }
  }

  async findAll(
    query: ListCollaboratorsQueryDto,
  ): Promise<PaginatedResponseDto<Collaborator>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const status = query.status ?? CollaboratorListStatus.Active;

    const [items, total] = await this.collaboratorsRepository.paginate({
      page,
      limit,
      status,
      name: query.name,
      email: query.email,
    });

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Collaborator> {
    const collaborator = await this.collaboratorsRepository.findActiveById(id);
    if (!collaborator) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return collaborator;
  }

  async remove(id: string): Promise<void> {
    const wasDeleted = await this.collaboratorsRepository.softDeleteActive(id);
    if (!wasDeleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }
}
