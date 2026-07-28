import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { DocumentRequirementsService } from './document-requirements.service';
import { CreateDocumentRequirementDto } from './dto/create-document-requirement.dto';
import { DocumentRequirementResponseDto } from './dto/document-requirement-response.dto';
import { DocumentRequirementsPaginatedResponseDto } from './dto/document-requirements-paginated-response.dto';
import { ListDocumentRequirementsQueryDto } from './dto/list-document-requirements-query.dto';
import { ListPendingDocumentRequirementsQueryDto } from './dto/list-pending-document-requirements-query.dto';
import { PendingDocumentRequirementsPaginatedResponseDto } from './dto/pending-document-requirement-response.dto';
import { DocumentRequirementMapper } from './mappers/document-requirement.mapper';
import { PendingDocumentRequirementMapper } from './mappers/pending-document-requirement.mapper';

@ApiTags('document-requirements')
@Controller('document-requirements')
export class DocumentRequirementsController {
  constructor(
    private readonly documentRequirementsService: DocumentRequirementsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Cria um requisito documental.',
    description:
      'Vincula um colaborador ativo a um tipo de documento ativo. Não permite vínculos ativos duplicados.',
  })
  @ApiCreatedResponse({
    type: DocumentRequirementResponseDto,
    description: 'Requisito documental criado com sucesso.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Payload inválido: UUIDs malformados, campos extras ou tipos incorretos.',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description:
      'Colaborador ou tipo de documento inexistente ou soft-deleted.',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description:
      'Já existe um requisito ativo para o mesmo colaborador e tipo de documento.',
  })
  async create(
    @Body() dto: CreateDocumentRequirementDto,
  ): Promise<DocumentRequirementResponseDto> {
    const requirement = await this.documentRequirementsService.create(dto);
    return DocumentRequirementMapper.toResponse(requirement);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista requisitos documentais com paginação e filtros.',
    description:
      'Por padrão retorna apenas ativos (`status=active`). Use `status=deleted` ou `status=all` para incluir removidos.',
  })
  @ApiOkResponse({
    type: DocumentRequirementsPaginatedResponseDto,
    description: 'Listagem paginada de requisitos documentais.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Query params inválidos: `page`/`limit` fora do intervalo, `limit` > 100, `status` inválido, UUID malformado ou campos não permitidos.',
  })
  async findAll(
    @Query() query: ListDocumentRequirementsQueryDto,
  ): Promise<DocumentRequirementsPaginatedResponseDto> {
    const result = await this.documentRequirementsService.findAll(query);
    return {
      items: DocumentRequirementMapper.toResponseList(result.items),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get('pending')
  @ApiOperation({
    summary: 'Lista documentos pendentes (requisitos sem versão ativa).',
    description:
      'Um documento é pendente quando existe um requisito ativo **sem** `DocumentVersion` ativa. ' +
      'O status PENDING **não** é persistido — é derivado via `LEFT JOIN` na consulta.\n\n' +
      'Por padrão retorna apenas requisitos ativos. Ordenação: `createdAt DESC`, `id DESC`.',
  })
  @ApiOkResponse({
    type: PendingDocumentRequirementsPaginatedResponseDto,
    description: 'Listagem paginada de requisitos pendentes.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Query params inválidos: `page`/`limit` fora do intervalo, `status` inválido, UUID malformado, datas inválidas ou campos não permitidos.',
  })
  async findPending(
    @Query() query: ListPendingDocumentRequirementsQueryDto,
  ): Promise<PendingDocumentRequirementsPaginatedResponseDto> {
    const result = await this.documentRequirementsService.findPending(query);
    return {
      items: PendingDocumentRequirementMapper.toResponseList(result.items),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca requisito documental ativo por ID.' })
  @ApiOkResponse({
    type: DocumentRequirementResponseDto,
    description: 'Requisito documental encontrado.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'ID malformado (não é UUID válido).',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Requisito documental inexistente ou soft-deleted.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DocumentRequirementResponseDto> {
    const requirement = await this.documentRequirementsService.findOne(id);
    return DocumentRequirementMapper.toResponse(requirement);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove requisito documental (soft delete / desvínculo).',
  })
  @ApiNoContentResponse({
    description: 'Requisito documental removido com sucesso.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'ID malformado (não é UUID válido).',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Requisito documental inexistente ou já removido.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.documentRequirementsService.remove(id);
  }
}
