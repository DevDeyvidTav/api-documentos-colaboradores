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
import { DocumentTypesService } from './document-types.service';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { DocumentTypeResponseDto } from './dto/document-type-response.dto';
import { DocumentTypesPaginatedResponseDto } from './dto/document-types-paginated-response.dto';
import { ListDocumentTypesQueryDto } from './dto/list-document-types-query.dto';
import { DocumentTypeMapper } from './mappers/document-type.mapper';

@ApiTags('document-types')
@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly documentTypesService: DocumentTypesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um tipo de documento.' })
  @ApiCreatedResponse({
    type: DocumentTypeResponseDto,
    description: 'Tipo de documento criado com sucesso.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Payload inválido: nome vazio, description acima do limite, campos extras ou tipos incorretos.',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Nome já cadastrado para um tipo de documento ativo.',
  })
  async create(
    @Body() dto: CreateDocumentTypeDto,
  ): Promise<DocumentTypeResponseDto> {
    const documentType = await this.documentTypesService.create(dto);
    return DocumentTypeMapper.toResponse(documentType);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista tipos de documento com paginação e filtros.',
    description:
      'Por padrão retorna apenas ativos (`status=active`). Use `status=deleted` ou `status=all` para incluir removidos.',
  })
  @ApiOkResponse({
    type: DocumentTypesPaginatedResponseDto,
    description: 'Listagem paginada de tipos de documento.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Query params inválidos: `page`/`limit` fora do intervalo, `limit` > 100, `status` inválido ou campos não permitidos.',
  })
  async findAll(
    @Query() query: ListDocumentTypesQueryDto,
  ): Promise<DocumentTypesPaginatedResponseDto> {
    const result = await this.documentTypesService.findAll(query);
    return {
      items: DocumentTypeMapper.toResponseList(result.items),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca tipo de documento ativo por ID.' })
  @ApiOkResponse({
    type: DocumentTypeResponseDto,
    description: 'Tipo de documento encontrado.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'ID malformado (não é UUID válido).',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Tipo de documento inexistente ou soft-deleted.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DocumentTypeResponseDto> {
    const documentType = await this.documentTypesService.findOne(id);
    return DocumentTypeMapper.toResponse(documentType);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove tipo de documento (soft delete).' })
  @ApiNoContentResponse({
    description: 'Tipo de documento removido com sucesso.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'ID malformado (não é UUID válido).',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Tipo de documento inexistente ou já removido.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.documentTypesService.remove(id);
  }
}
