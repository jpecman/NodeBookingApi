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
import { ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import {
  ApiCreateContact,
  ApiDeleteContact,
  ApiGetContact,
  ApiListContacts,
  ApiUpdateContact,
} from './contacts.swagger';
import { ContactResponseDto } from './dto/contact-response.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @ApiCreateContact()
  async create(@Body() dto: CreateContactDto): Promise<ContactResponseDto> {
    return ContactResponseDto.fromEntity(await this.contactsService.create(dto));
  }

  @Get()
  @ApiListContacts()
  async findAll(): Promise<ContactResponseDto[]> {
    const contacts = await this.contactsService.findAll();
    return contacts.map(ContactResponseDto.fromEntity);
  }

  @Get(':id')
  @ApiGetContact()
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ContactResponseDto> {
    return ContactResponseDto.fromEntity(await this.contactsService.findOne(id));
  }

  @Put(':id')
  @ApiUpdateContact()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<ContactResponseDto> {
    return ContactResponseDto.fromEntity(await this.contactsService.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteContact()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.contactsService.remove(id);
  }
}
