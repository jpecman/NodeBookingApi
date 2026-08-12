import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Contact 6f9d… not found' })
  message: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Field-level validation failures, when the request body was rejected.',
    example: ['firstName should not be empty'],
  })
  errors?: string[];

  @ApiProperty({ example: '2026-08-04T09:12:33.421Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/contacts/6f9d…' })
  path: string;
}
