import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Collaborator } from '../../collaborators/entities/collaborator.entity';
import { DocumentType } from '../../document-types/entities/document-type.entity';

@Entity('document_requirement')
@Index(
  'uq_document_requirement_collaborator_document_type_active',
  ['collaboratorId', 'documentTypeId'],
  {
    unique: true,
    where: 'deleted_at IS NULL',
  },
)
@Index('idx_document_requirement_collaborator_id', ['collaboratorId'])
@Index('idx_document_requirement_document_type_id', ['documentTypeId'])
@Index('idx_document_requirement_deleted_at', ['deletedAt'])
export class DocumentRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collaborator_id', type: 'uuid' })
  collaboratorId: string;

  @Column({ name: 'document_type_id', type: 'uuid' })
  documentTypeId: string;

  @ManyToOne(() => Collaborator, { nullable: false })
  @JoinColumn({ name: 'collaborator_id' })
  collaborator: Collaborator;

  @ManyToOne(() => DocumentType, { nullable: false })
  @JoinColumn({ name: 'document_type_id' })
  documentType: DocumentType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;
}
