import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentRequirementsModule } from '../document-requirements/document-requirements.module';
import { DocumentVersionsController } from './document-versions.controller';
import { DocumentVersionsRepository } from './document-versions.repository';
import { DocumentVersionsService } from './document-versions.service';
import { DocumentVersion } from './entities/document-version.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentVersion]),
    DocumentRequirementsModule,
  ],
  controllers: [DocumentVersionsController],
  providers: [DocumentVersionsService, DocumentVersionsRepository],
  exports: [DocumentVersionsService],
})
export class DocumentVersionsModule {}
