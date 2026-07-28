import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { DocumentVersionsService } from './document-versions.service';
import { CreateDocumentVersionDto } from './dto/create-document-version.dto';
import { DocumentVersionResponseDto } from './dto/document-version-response.dto';
import { DocumentVersionMapper } from './mappers/document-version.mapper';

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
      'Cria a versão 1 no primeiro envio. Em reenvios, desativa a versão ativa anterior e cria a próxima em uma única transação.',
  })
  @ApiCreatedResponse({
    type: DocumentVersionResponseDto,
    description: 'Versão criada e marcada como ativa.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Payload inválido: referência vazia, UUID malformado, campos extras ou tipos incorretos.',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description:
      'Requisito, colaborador ou tipo de documento inexistente ou soft-deleted.',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Conflito de versão ou violação de unicidade no banco.',
  })
  async submit(
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body() dto: CreateDocumentVersionDto,
  ): Promise<DocumentVersionResponseDto> {
    const version = await this.documentVersionsService.submit(
      requirementId,
      dto,
    );
    return DocumentVersionMapper.toResponse(version);
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
}
