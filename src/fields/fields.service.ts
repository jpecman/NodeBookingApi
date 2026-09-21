import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { Field } from './entities/field.entity';

@Injectable() // makes class a provider, meaning it can be used by DI
export class FieldsService {
  private readonly logger = new Logger(FieldsService.name);

  constructor(
    @InjectRepository(Field)
    private readonly fields: EntityRepository<Field>,
    private readonly em: EntityManager,
  ) {}

  async create(dto: CreateFieldDto): Promise<Field> {
    // Pitches given inline become entities too, and the default persist cascade means
    // one flush inserts the field and its pitches together, in a single transaction.
    // Ids come from the entities' initializers.
    const field = this.fields.create({
      name: dto.name,
      pitches: dto.pitches.map((name) => ({ name })),
    });

    await this.em.flush();
    this.logger.log(`Created field ${field.id} with ${field.pitches.length} pitch(es)`);

    return field;
  }

  /** Tenant scoping comes from TENANT_FILTER on Field and Pitch. */
  async findOne(id: string): Promise<Field> {
    const field = await this.fields.findOne(
      { id },
      { populate: ['pitches'], orderBy: { pitches: { name: 'asc' } } },
    );

    if (!field) {
      this.logger.warn(`Field ${id} not found`);
      throw new NotFoundException(`Field ${id} not found`);
    }

    return field;
  }

  async update(id: string, dto: UpdateFieldDto): Promise<Field> {
    // Throws NotFoundException if there's no such field. Otherwise the returned field is
    // tracked by the EntityManager (so flush() below sees the changes) and has its
    // pitches loaded for the response.
    const field = await this.findOne(id);

    // Only assign what the caller actually sent — an absent key must not clear a column.
    Object.assign(field, dto);

    // No save(): flush() issues an UPDATE for exactly the columns that changed.
    await this.em.flush();
    this.logger.log(`Updated field ${id}`);

    return field;
  }

  findAll(): Promise<Field[]> {
    return this.fields.findAll({
      populate: ['pitches'],
      orderBy: { name: 'asc' },
    });
  }
}
