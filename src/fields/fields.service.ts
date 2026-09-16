import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { Field } from './entities/field.entity';
import { getCurrentTenantId } from 'src/common/tenancy/tenant-context';

@Injectable() // makes class a provider, meaning it can be used by DI
export class FieldsService {
  private readonly logger = new Logger(FieldsService.name);

  constructor(
    @InjectRepository(Field)
    private readonly fields: Repository<Field>,
  ) {}

  async create(dto: CreateFieldDto): Promise<Field> {
    // cascade: ['insert'] on Field.pitches means this one save() writes the field
    // and its pitches together, in a single transaction.
    const field = this.fields.create({
      name: dto.name,
      pitches: dto.pitches.map((name) => ({ name })),
    });

    const saved = await this.fields.save(field);
    this.logger.log(`Created field ${saved.id} with ${saved.pitches.length} pitch(es)`);

    return saved;
  }

  async findOne(id: string): Promise<Field> {
    const field = await this.fields.findOne({
      where: { id, tenantId: getCurrentTenantId() },
      relations: { pitches: true },
      order: { pitches: { name: 'ASC' } },
    });

    if (!field) {
      this.logger.warn(`Field ${id} not found`);
      throw new NotFoundException(`Field ${id} not found`);
    }

    return field;
  }

  findAll(): Promise<Field[]> {
    return this.fields.find({
      where: { tenantId: getCurrentTenantId() },
      relations: { pitches: true },
      order: { name: 'ASC' },
    });
  }
}
