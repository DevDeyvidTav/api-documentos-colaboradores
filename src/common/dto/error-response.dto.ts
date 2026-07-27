import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';


export class ErrorResponseDto {
  @ApiProperty({ example: 400, description: 'Código HTTP da resposta.' })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request', description: 'Rótulo curto do erro.' })
  error: string;

  @ApiProperty({
    description: 'Mensagem de erro ou lista de mensagens (validação).',
    oneOf: [
      { type: 'string', example: 'Colaborador não encontrado.' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['email must be an email', 'name should not be empty'],
      },
    ],
  })
  message: string | string[];

  @ApiPropertyOptional({
    description: 'Detalhes adicionais (ex.: campos rejeitados na validação).',
  })
  details?: unknown;

  @ApiProperty({
    example: '2026-07-27T19:00:00.000Z',
    description: 'Timestamp ISO 8601 do momento do erro.',
  })
  timestamp: string;

  @ApiProperty({
    example: '/collaborators',
    description: 'Path da requisição que originou o erro.',
  })
  path: string;
}
