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
  Put,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ContactsService } from './contacts.service';
import { ContactResponseDto } from './dto/contact-response.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a contact' })
  @ApiCreatedResponse({ type: ContactResponseDto })
  @ApiConflictResponse({ description: 'Email already in use', type: ErrorResponseDto })
  async create(@Body() dto: CreateContactDto): Promise<ContactResponseDto> {
    return ContactResponseDto.fromEntity(await this.contactsService.create(dto));
  }

  @Get()
  @ApiOperation({ summary: 'List all contacts' })
  @ApiOkResponse({ type: [ContactResponseDto] })
async findAll(): Promise<ContactResponseDto[]> {
    const contacts = await this.contactsService.findAll();
    return contacts.map(ContactResponseDto.fromEntity);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single contact' })
  @ApiOkResponse({ type: ContactResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ContactResponseDto> {
    return ContactResponseDto.fromEntity(await this.contactsService.findOne(id));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contact', description: 'Partial bodies are accepted.' })
  @ApiOkResponse({ type: ContactResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ description: 'Email already in use', type: ErrorResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<ContactResponseDto> {
    return ContactResponseDto.fromEntity(await this.contactsService.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.contactsService.remove(id);
  }
}
