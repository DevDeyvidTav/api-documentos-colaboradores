import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaboratorListStatus } from './dto/collaborator-list-status.enum';
import { Collaborator } from './entities/collaborator.entity';

export interface PaginateCollaboratorsOptions {
  page: number;
  limit: number;
  status?: CollaboratorListStatus;
  name?: string;
  email?: string;
}

@Injectable()
export class CollaboratorsRepository {
  constructor(
    @InjectRepository(Collaborator)
    private readonly repository: Repository<Collaborator>,
  ) {}

  create(data: Pick<Collaborator, 'name' | 'email'>): Collaborator {
    return this.repository.create(data);
  }

  save(collaborator: Collaborator): Promise<Collaborator> {
    return this.repository.save(collaborator);
  }

  findActiveByEmail(email: string): Promise<Collaborator | null> {
    return this.repository
      .createQueryBuilder('collaborator')
      .where('collaborator.email = :email', { email })
      .andWhere('collaborator.deletedAt IS NULL')
      .getOne();
  }

  findActiveById(id: string): Promise<Collaborator | null> {
    return this.repository
      .createQueryBuilder('collaborator')
      .where('collaborator.id = :id', { id })
      .andWhere('collaborator.deletedAt IS NULL')
      .getOne();
  }

  async paginate(
    options: PaginateCollaboratorsOptions,
  ): Promise<[Collaborator[], number]> {
    const status = options.status ?? CollaboratorListStatus.Active;
    const query = this.repository.createQueryBuilder('collaborator');

    if (status !== CollaboratorListStatus.Active) {
      query.withDeleted();
    }

    if (status === CollaboratorListStatus.Active) {
      query.where('collaborator.deletedAt IS NULL');
    } else if (status === CollaboratorListStatus.Deleted) {
      query.where('collaborator.deletedAt IS NOT NULL');
    }

    if (options.name) {
      query.andWhere('collaborator.name ILIKE :name', {
        name: `%${options.name}%`,
      });
    }

    if (options.email) {
      query.andWhere('collaborator.email ILIKE :email', {
        email: `%${options.email}%`,
      });
    }

    if (status === CollaboratorListStatus.Deleted) {
      query
        .orderBy('collaborator.deletedAt', 'DESC')
        .addOrderBy('collaborator.id', 'DESC');
    } else {
      query
        .orderBy('collaborator.createdAt', 'DESC')
        .addOrderBy('collaborator.id', 'DESC');
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
