import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentRequirement } from '../document-requirements/entities/document-requirement.entity';
import { DocumentVersion } from '../document-versions/entities/document-version.entity';
import { StatisticsController } from './statistics.controller';
import { StatisticsRepository } from './statistics.repository';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentRequirement, DocumentVersion])],
  controllers: [StatisticsController],
  providers: [StatisticsService, StatisticsRepository],
})
export class StatisticsModule {}
