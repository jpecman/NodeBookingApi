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
import { FieldsService } from './fields.service';
import { ApiCreateField, ApiListFields } from './fields.swagger';
import { CreateFieldDto } from './dto/create-field.dto';
import { ContactResponseDto } from 'src/contacts/dto/contact-response.dto';
import { FieldResponseDto } from './dto/field-response.dto';

@ApiTags('fields') // documentation
@Controller('fields') // functional
export class FieldsController {
  constructor(private readonly fieldsService: FieldsService) {}

  @Post()
  @ApiCreateField()
  async create(@Body() dto: CreateFieldDto): Promise<FieldResponseDto> {
    return FieldResponseDto.fromEntity(await this.fieldsService.create(dto));
  }

  @Get()
  @ApiListFields()
  async findAll(): Promise<FieldResponseDto[]> {
    const fields = await this.fieldsService.findAll();
    return fields.map(FieldResponseDto.fromEntity);
  }
}
