import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CollaboratorsModule } from './collaborators/collaborators.module';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DocumentRequirementsModule } from './document-requirements/document-requirements.module';
import { DocumentTypesModule } from './document-types/document-types.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    HealthModule,
    CollaboratorsModule,
    DocumentTypesModule,
    DocumentRequirementsModule,
  ],
})
export class AppModule {}
