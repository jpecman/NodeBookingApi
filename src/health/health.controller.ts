import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MikroOrmHealthIndicator } from '@nestjs/terminus';
import { MikroORM } from '@mikro-orm/core';
import { InjectMikroORM } from '@mikro-orm/nestjs';
import { Public } from '../auth/decorators/public.decorator';
import { BOOKING_CONTEXT } from '../database/mikro-orm.options';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: MikroOrmHealthIndicator,
    @InjectMikroORM(BOOKING_CONTEXT) private readonly orm: MikroORM,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    // The indicator only finds an unnamed context on its own, so hand it the connection.
    return this.health.check([
      () => this.database.pingCheck('database', { connection: this.orm.em.getConnection() }),
    ]);
  }
}
