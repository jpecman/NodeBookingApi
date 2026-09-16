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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { ApiBookingsController, ApiCreateBooking, ApiSearchBookings } from './bookings.swagger';
import { BookingResponseDto } from './dto/booking-response.dto';
import { SearchBookingsDto } from './dto/search-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@ApiTags('bookings')
@ApiBookingsController()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiSearchBookings()
  async findAll(@Query() search: SearchBookingsDto): Promise<BookingResponseDto[]> {
    const bookings = await this.bookingsService.findAll(search);
    return bookings.map(BookingResponseDto.fromEntity);
  }

  @Post()
  @ApiCreateBooking()
  async create(@Body() dto: CreateBookingDto): Promise<BookingResponseDto> {
    return BookingResponseDto.fromEntity(await this.bookingsService.create(dto));
  }
}
