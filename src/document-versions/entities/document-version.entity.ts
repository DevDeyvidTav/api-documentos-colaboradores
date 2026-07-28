import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocumentRequirement } from '../../document-requirements/entities/document-requirement.entity';

@Entity('document_version')
@Index(
  'uq_document_version_requirement_version_number',
  ['requirementId', 'versionNumber'],
  { unique: true },
)
@Index('uq_document_version_requirement_active', ['requirementId'], {
  unique: true,
  where: 'is_active = true',
})
@Index(
  'uq_document_version_requirement_idempotency_key',
  ['requirementId', 'idempotencyKey'],
  { unique: true },
)
@Index('idx_document_version_requirement_id', ['requirementId'])
@Index('idx_document_version_submitted_at', ['submittedAt'])
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'requirement_id', type: 'uuid' })
  requirementId: string;

  @ManyToOne(() => DocumentRequirement, { nullable: false })
  @JoinColumn({ name: 'requirement_id' })
  requirement: DocumentRequirement;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ name: 'is_active', type: 'boolean' })
  isActive: boolean;

  @Column({ name: 'document_reference', type: 'varchar', length: 500 })
  documentReference: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey: string;

  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash: string;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
