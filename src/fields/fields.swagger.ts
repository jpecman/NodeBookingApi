import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { FieldResponseDto } from './dto/field-response.dto';

export const ApiCreateField = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a field' }),
    ApiCreatedResponse({ type: FieldResponseDto }),
  );

export const ApiListFields = () =>
  applyDecorators(
    ApiOperation({ summary: 'List all fields' }),
    ApiOkResponse({ type: [FieldResponseDto] }),
  );

export const ApiUpdateField = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update a field',
      description:
        'Partial bodies are accepted. Only the name can change; pitches are not edited here.',
    }),
    ApiOkResponse({ type: FieldResponseDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto }),
  );
