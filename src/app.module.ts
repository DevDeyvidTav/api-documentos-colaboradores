import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CollaboratorsModule } from './collaborators/collaborators.module';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
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
  ],
})
export class AppModule {}
