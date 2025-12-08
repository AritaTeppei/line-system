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

    // 開発者 / 管理者 / クライアントいずれかであればOK
    // （ここではまだロール別制限はかけない）
    // リクエストに載せて、あとでコントローラから参照できるようにする
    (req as any).authUser = payload;

    return true;
  }
}
