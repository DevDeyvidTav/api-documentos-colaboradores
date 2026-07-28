import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { DocumentVersionsService } from './document-versions.service';
import { CreateDocumentVersionDto } from './dto/create-document-version.dto';
import { DocumentVersionResponseDto } from './dto/document-version-response.dto';
import { DocumentVersionMapper } from './mappers/document-version.mapper';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('document-versions')
@Controller()
export class DocumentVersionsController {
  constructor(
    private readonly documentVersionsService: DocumentVersionsService,
  ) {}

  @Post('document-requirements/:requirementId/versions')
  @ApiOperation({
    summary: 'Envia um documento (cria nova versão) para um requisito.',
    description:
      'Cria a versão 1 no primeiro envio. Em reenvios, desativa a versão ativa anterior e cria a próxima em uma única transação.\n\n' +
      'Envios **distintos** concorrentes para o mesmo requisito são serializados (lock pessimista), gerando versões distintas e ordenadas.\n\n' +
      'Retries da **mesma** operação devem reutilizar o header obrigatório `Idempotency-Key`: mesmo payload → **200** com a versão já criada; payload diferente → **409**.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Chave UUID que identifica a operação lógica. Retries devem reenviar a mesma chave.',
    example: '7b8d4d8e-f7af-46d3-a2fc-fc93bba0d96e',
  })
  @ApiCreatedResponse({
    type: DocumentVersionResponseDto,
    description: 'Nova versão criada (primeira execução da Idempotency-Key).',
  })
  @ApiOkResponse({
    type: DocumentVersionResponseDto,
    description:
      'Replay idempotente: mesma Idempotency-Key e mesmo payload — retorna a versão já existente sem criar registro novo.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Payload inválido, Idempotency-Key ausente/inválida, UUID malformado ou campos extras.',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description:
      'Requisito, colaborador ou tipo de documento inexistente ou soft-deleted.',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description:
      'Idempotency-Key reutilizada com payload diferente, conflito de versão ou violação de unicidade.',
  })
  async submit(
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body() dto: CreateDocumentVersionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DocumentVersionResponseDto> {
    const key = this.requireIdempotencyKey(idempotencyKey);
    const result = await this.documentVersionsService.submit(
      requirementId,
      dto,
      key,
    );

    res.status(result.replay ? HttpStatus.OK : HttpStatus.CREATED);
    return DocumentVersionMapper.toResponse(result.version);
  }

  @Get('document-requirements/:requirementId/versions')
  @ApiOperation({
    summary: 'Lista o histórico de versões de um requisito.',
    description:
      'Retorna todas as versões ordenadas por `versionNumber` DESC, indicando qual está ativa.',
  })
  @ApiOkResponse({
    type: [DocumentVersionResponseDto],
    description: 'Histórico de versões do requisito.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'UUID do requisito malformado.',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Requisito inexistente ou soft-deleted.',
  })
  async findByRequirement(
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ): Promise<DocumentVersionResponseDto[]> {
    const versions =
      await this.documentVersionsService.findByRequirementId(requirementId);
    return DocumentVersionMapper.toResponseList(versions);
  }

  @Get('document-versions/:id')
  @ApiOperation({ summary: 'Busca uma versão de documento por ID.' })
  @ApiOkResponse({
    type: DocumentVersionResponseDto,
    description: 'Versão encontrada.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'ID malformado (não é UUID válido).',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Versão inexistente.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DocumentVersionResponseDto> {
    const version = await this.documentVersionsService.findOne(id);
    return DocumentVersionMapper.toResponse(version);
  }

  private requireIdempotencyKey(value: string | undefined): string {
    if (value == null || value.trim() === '') {
      throw new BadRequestException(
        'Header Idempotency-Key é obrigatório no envio de documentos.',
      );
    }

    const key = value.trim();
    if (!UUID_REGEX.test(key)) {
      throw new BadRequestException(
        'Header Idempotency-Key deve ser um UUID válido.',
      );
    }

    return key;
  }
}
