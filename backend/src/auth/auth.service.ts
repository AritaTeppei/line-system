// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// JWT に入れる型
export interface AuthPayload {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;  // 開発者は null
  role: UserRole;           // 'DEVELOPER' | 'MANAGER' | 'CLIENT'
}

@Injectable()
export class AuthService {
  // 本番では必ず環境変数に逃がすこと！
  private readonly JWT_SECRET =
    process.env.JWT_SECRET ?? 'development-only-secret';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * メールアドレスとパスワードからユーザーを1件取得して検証
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('メールアドレスまたはパスワードが違います');
    }

    // 既存（平文）と新規（ハッシュ済み）の両方に対応したパスワードチェック
    const { ok, hashed } = await this.verifyPassword(password, user.password);

    if (!ok) {
      throw new UnauthorizedException('メールアドレスまたはパスワードが違います');
    }

    // 旧データ（平文保存）の場合は、このタイミングでハッシュ化に移行する
    if (!hashed) {
      const newHash = await bcrypt.hash(password, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: newHash },
      });
    }

    return user;
  }

  /**
   * JWT を発行する
   */
  issueToken(payload: AuthPayload): string {
    const token = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: '7d', // とりあえず7日有効
    });
    return token;
  }

  /**
   * JWT を検証して payload を取り出す
   */
  verifyToken(token: string): AuthPayload | null {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      return decoded as AuthPayload;
    } catch (e) {
      return null;
    }
  }

  /**
   * Request から Authorization ヘッダーを読み取る
   */
  getPayloadFromRequest(req: Request): AuthPayload | null {
    const header = req.headers['authorization'];
    if (!header || typeof header !== 'string') return null;

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return null;

    return this.verifyToken(token);
  }

  /**
   * 既存（平文）パスワードと、新しいハッシュ済みパスワードの両方に対応した比較
   */
  private async verifyPassword(
    plainPassword: string,
    storedPassword: string,
  ): Promise<{ ok: boolean; hashed: boolean }> {
    if (!storedPassword) {
      return { ok: false, hashed: false };
    }

    // bcrypt っぽい文字列ならハッシュとみなす
    const looksHashed =
      storedPassword.startsWith('$2b$') ||
      storedPassword.startsWith('$2a$') ||
      storedPassword.startsWith('$2y$');

    if (looksHashed) {
      const ok = await bcrypt.compare(plainPassword, storedPassword);
      return { ok, hashed: true };
    }

    // それ以外は「昔の平文保存」とみなして、そのまま比較
    const ok = plainPassword === storedPassword;
    return { ok, hashed: false };
  }

    /**
   * /auth/me 用：
   * - JWT を検証して payload を取り出す
   * - MANAGER / CLIENT の場合はテナントの有効状態もチェックする
   * - DEVELOPER はテナント状態に関係なく通す
   */
  async getPayloadFromRequestWithTenantCheck(req: Request): Promise<AuthPayload> {
    const payload = this.getPayloadFromRequest(req);

    if (!payload) {
      throw new UnauthorizedException(
        '認証情報が無効です。再度ログインしてください。',
      );
    }

    // テナント状態チェック（MANAGER / CLIENT のみ）
    await this.ensureTenantActive(payload);

    return payload;
  }

    private async ensureTenantActive(payload: AuthPayload): Promise<void> {
    // 開発者はテナント状態に関係なく通す
    if (payload.role === 'DEVELOPER') {
      return;
    }

    // tenantId が無いのはそもそもおかしい
    if (payload.tenantId == null) {
      throw new UnauthorizedException(
        'テナント情報が不正です。管理者にお問い合わせください。',
      );
    }

    // DB からテナントを取得
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: payload.tenantId },
    });

    if (!tenant) {
      throw new UnauthorizedException(
        'テナント情報が見つかりません。管理者にお問い合わせください。',
      );
    }

    // 有効フラグ
    if (!tenant.isActive) {
      throw new UnauthorizedException(
        'テナントが無効になっています。管理者にお問い合わせください。',
      );
    }

    // 有効期限（validUntil が設定されている場合のみチェック）
    if (tenant.validUntil) {
      const now = new Date();
      if (tenant.validUntil.getTime() < now.getTime()) {
        throw new UnauthorizedException(
          'テナントの有効期限が切れています。管理者にお問い合わせください。',
        );
      }
    }

    // すべてOKなら、これまで通りの payload を返す
    //
  }
}
