import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContactBookingResponseDto } from './dto/contact-booking-response.dto';
import { SearchReportsDto } from './dto/search-report.dto';
import { ReportsService } from './reports.service';
import { ApiContactBookingsReport, ApiReportsController } from './reports.swagger';

@ApiTags('reports')
@ApiReportsController()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** No .map(fromEntity) here: an aggregate has no entity, so the service builds the DTOs. */
  @Get('contact-bookings')
  @ApiContactBookingsReport()
  async contactBookings(@Query() search: SearchReportsDto): Promise<ContactBookingResponseDto[]> {
    return this.reportsService.contactBookings(search);
  }
}
