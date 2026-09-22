import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UserMeResponseDto } from './dto/user-me-response.dto';
import { parseDurationMs } from './duration.util';
import type { AuthenticatedUser } from './types/authenticated-user';

const TOKEN_COOKIE = 'token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  // Policy in AuthModule; see docs/design-notes.md.
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @ApiOperation({ summary: 'Log in, receiving the session as an httpOnly cookie' })
  @ApiOkResponse({ type: UserMeResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserMeResponseDto> {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const token = this.authService.issueToken(user);

    res.cookie(TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('nodeEnv') === 'production',
      path: '/',
      maxAge: parseDurationMs(this.config.getOrThrow<string>('jwt.expiresIn')),
    });

    return UserMeResponseDto.fromAuthenticatedUser({
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out, clearing the session cookie' })
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(TOKEN_COOKIE, { path: '/' });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current user' })
  @ApiOkResponse({ type: UserMeResponseDto })
  me(@CurrentUser() user: AuthenticatedUser): UserMeResponseDto {
    return UserMeResponseDto.fromAuthenticatedUser(user);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change the current user's password" })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
