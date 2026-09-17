import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FieldsService } from './fields.service';
import { ApiCreateField, ApiListFields, ApiUpdateField } from './fields.swagger';
import { CreateFieldDto } from './dto/create-field.dto';
import { FieldResponseDto } from './dto/field-response.dto';
import { UpdateFieldDto } from './dto/update-field.dto';

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

  @Put(':id')
  @ApiUpdateField()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFieldDto,
  ): Promise<FieldResponseDto> {
    return FieldResponseDto.fromEntity(await this.fieldsService.update(id, dto));
  }
}
