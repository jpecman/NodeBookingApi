import { applyDecorators } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ContactResponseDto } from './dto/contact-response.dto';

export const ApiCreateContact = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a contact' }),
    ApiCreatedResponse({ type: ContactResponseDto }),
    ApiConflictResponse({ description: 'Email already in use', type: ErrorResponseDto }),
  );

export const ApiListContacts = () =>
  applyDecorators(
    ApiOperation({ summary: 'List all contacts' }),
    ApiOkResponse({ type: [ContactResponseDto] }),
  );

export const ApiGetContact = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get a single contact' }),
    ApiOkResponse({ type: ContactResponseDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto }),
  );

export const ApiUpdateContact = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update a contact', description: 'Partial bodies are accepted.' }),
    ApiOkResponse({ type: ContactResponseDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto }),
    ApiConflictResponse({ description: 'Email already in use', type: ErrorResponseDto }),
  );

export const ApiDeleteContact = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a contact' }),
    ApiNoContentResponse(),
    ApiNotFoundResponse({ type: ErrorResponseDto }),
  );
