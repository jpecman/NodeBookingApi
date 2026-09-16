import { applyDecorators } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
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
