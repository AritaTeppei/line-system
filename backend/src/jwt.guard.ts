// src/jwt.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, AuthPayload } from './auth/auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const payload = this.authService.getPayloadFromRequest(req);

    if (!payload) {
      throw new UnauthorizedException('認証情報がありません');
    }

    // セッション有効性チェック＋スライディング延長（10分無操作で失効）
    await this.authService.validateAndRefreshSession(payload);

    (req as any).authUser = payload;
    return true;
  }
}
