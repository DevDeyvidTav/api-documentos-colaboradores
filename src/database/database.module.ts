import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.getOrThrow<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_DATABASE'),
        logging: configService.get<boolean>('DB_LOGGING', false),
        autoLoadEntities: true,
        uuidExtension: 'pgcrypto',
        synchronize: false,
        migrationsRun: false,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        poolSize: configService.get<number>('DB_POOL_SIZE', 10),
        connectTimeoutMS: configService.get<number>(
          'DB_CONNECTION_TIMEOUT_MS',
          5000,
        ),
        extra: {
          idleTimeoutMillis: configService.get<number>(
            'DB_POOL_IDLE_TIMEOUT_MS',
            30000,
          ),
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
