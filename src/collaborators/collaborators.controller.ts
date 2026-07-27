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
import { CollaboratorsService } from './collaborators.service';
import { CollaboratorResponseDto } from './dto/collaborator-response.dto';
import { CollaboratorsPaginatedResponseDto } from './dto/collaborators-paginated-response.dto';
import { CreateCollaboratorDto } from './dto/create-collaborator.dto';
import { ListCollaboratorsQueryDto } from './dto/list-collaborators-query.dto';
import { CollaboratorMapper } from './mappers/collaborator.mapper';

@ApiTags('collaborators')
@Controller('collaborators')
export class CollaboratorsController {
  constructor(private readonly collaboratorsService: CollaboratorsService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um colaborador.' })
  @ApiCreatedResponse({
    type: CollaboratorResponseDto,
    description: 'Colaborador criado com sucesso.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Payload inválido: e-mail malformado, nome vazio, campos extras ou tipos incorretos.',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'E-mail já cadastrado para um colaborador ativo.',
  })
  async create(
    @Body() dto: CreateCollaboratorDto,
  ): Promise<CollaboratorResponseDto> {
    const collaborator = await this.collaboratorsService.create(dto);
    return CollaboratorMapper.toResponse(collaborator);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista colaboradores com paginação e filtros.',
    description:
      'Por padrão retorna apenas ativos (`status=active`). Use `status=deleted` ou `status=all` para incluir removidos.',
  })
  @ApiOkResponse({
    type: CollaboratorsPaginatedResponseDto,
    description: 'Listagem paginada de colaboradores.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Query params inválidos: `page`/`limit` fora do intervalo, `limit` > 100, `status` inválido ou campos não permitidos.',
  })
  async findAll(
    @Query() query: ListCollaboratorsQueryDto,
  ): Promise<CollaboratorsPaginatedResponseDto> {
    const result = await this.collaboratorsService.findAll(query);
    return {
      items: CollaboratorMapper.toResponseList(result.items),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca colaborador ativo por ID.' })
  @ApiOkResponse({
    type: CollaboratorResponseDto,
    description: 'Colaborador encontrado.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'ID malformado (não é UUID válido).',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Colaborador inexistente ou soft-deleted.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CollaboratorResponseDto> {
    const collaborator = await this.collaboratorsService.findOne(id);
    return CollaboratorMapper.toResponse(collaborator);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove colaborador (soft delete).' })
  @ApiNoContentResponse({ description: 'Colaborador removido com sucesso.' })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'ID malformado (não é UUID válido).',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Colaborador inexistente ou já removido.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.collaboratorsService.remove(id);
  }
}
