import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaboratorsModule } from '../collaborators/collaborators.module';
import { DocumentTypesModule } from '../document-types/document-types.module';
import { DocumentRequirementsController }  from './document-requirements.controller';
import { DocumentRequirementsRepository } from './document-requirements.repository';
import { DocumentRequirementsService } from './document-requirements.service';
import { DocumentRequirement } from './entities/document-requirement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentRequirement]),
    CollaboratorsModule,
    DocumentTypesModule,
  ],
  controllers: [DocumentRequirementsController],
  providers: [DocumentRequirementsService, DocumentRequirementsRepository],
  exports: [DocumentRequirementsService],
})
export class DocumentRequirementsModule {}
