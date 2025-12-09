// src/customers/customers.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload } from '../auth/auth.service';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { CreateCustomerDto } from './dto/create-customer.dto';

type ImportStrategy = 'skip' | 'rollback';

type CsvImportError = {
  rowNumber: number; // CSV上の行番号（ヘッダー1行目として）
  messages: string[]; // その行のエラー内容
  raw: Record<string, string>; // 生の値（デバッグ＆画面表示用）
};

type NormalizedCustomerRow = {
  rowNumber: number;
  raw: Record<string, string>;
  lastName: string;
  firstName: string;
  postalCode: string | null;
  address1: string | null;
  address2: string | null;
  phoneNumber: string | null;
  lineUid: string | null;
  birthday: Date | null;
};

// ★追加：携帯番号を数字だけに正規化するヘルパー
function normalizePhone(phoneRaw: string | null | undefined): string | null {
  if (!phoneRaw) return null;
  const digits = phoneRaw.replace(/\D/g, '');
  return digits || null;
}

function parseJapaneseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  const ymd = v.replace(/\./g, '/');
  const ymdMatch = ymd.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const y = Number(ymdMatch[1]);
    const m = Number(ymdMatch[2]);
    const d = Number(ymdMatch[3]);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const eraMatch = v.match(/(令和|平成|昭和)\s*(\d+)年\s*(\d+)月\s*(\d+)日/);
  if (eraMatch) {
    const era = eraMatch[1];
    const yearInEra = Number(eraMatch[2]);
    const m = Number(eraMatch[3]);
    const d = Number(eraMatch[4]);

    let baseYear = 0;
    if (era === '令和') baseYear = 2018;
    if (era === '平成') baseYear = 1988;
    if (era === '昭和') baseYear = 1925;

    const y = baseYear + yearInEra;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // 顧客CSVインポート本体
  async importFromCsv(
    user: AuthPayload,
    file: any,
    strategy: ImportStrategy = 'skip',
  ) {
    if (!file) {
      return {
        totalRows: 0,
        importedCount: 0,
        skippedCount: 0,
        errors: [
          {
            rowNumber: 0,
            messages: ['CSVファイルがアップロードされていません。'],
            raw: {},
          },
        ] as CsvImportError[],
      };
    }

    if (!user.tenantId) {
      return {
        totalRows: 0,
        importedCount: 0,
        skippedCount: 0,
        errors: [
          {
            rowNumber: 0,
            messages: [
              'tenantId が取得できません。ログイン状態を確認してください。',
            ],
            raw: {},
          },
        ] as CsvImportError[],
      };
    }

    const tenantId = user.tenantId;

    // 1. CSVファイルの中身を文字列で取得
    let csvText: string;
    if (file.buffer) {
      csvText = file.buffer.toString('utf8');
    } else if (file.path) {
      csvText = fs.readFileSync(file.path, 'utf8');
    } else {
      return {
        totalRows: 0,
        importedCount: 0,
        skippedCount: 0,
        errors: [
          {
            rowNumber: 0,
            messages: ['CSVファイルの内容を読み取れませんでした。'],
            raw: {},
          },
        ] as CsvImportError[],
      };
    }

    // 2. CSVをパース（1行目ヘッダー前提）
const records = parse(csvText, {
  columns: true, // 1行目をヘッダーとして扱う
  skip_empty_lines: true, // 完全に空の行は飛ばす
  bom: true, // BOM 付きUTF-8対応
  trim: true, // 前後の空白除去
}) as Record<string, string>[];


    const errors: CsvImportError[] = [];
    const validRows: NormalizedCustomerRow[] = [];
    const lineUidSeenInFile = new Map<string, number>(); // 同一CSV内のLINE UID重複チェック

    let totalRows = 0;

records.forEach((raw: Record<string, string>, index) => {
  const rowNumber = index + 2; // 1行目がヘッダーなので +2

  // 全カラムが空っぽっぽい行は無視（末尾の空行対策）
  const allEmpty = Object.values(raw).every(
    (v) => !v || String(v).trim().length === 0,
  );
      if (allEmpty) {
        return;
      }

      totalRows++;

      const rowErrors: string[] = [];

      // --- 氏名の処理 -------------------------
      // ① まずは従来どおり、姓・名カラムがあればそれを使う
      let lastName = (raw['姓'] || '').trim();
      let firstName = (raw['名'] || '').trim();

      // ② 姓・名が両方とも空なら、氏名まとめカラムから分解を試す
      if (!lastName && !firstName) {
        const fullName = (
          raw['氏名'] ||
          raw['名前'] ||
          raw['顧客名'] ||
          raw['お客様名'] ||
          ''
        ) // 必要に応じてヘッダー名追加
          .trim();

        if (fullName) {
          // まずは「ハイフン系」で区切ってみる
          const hyphenParts = fullName
            .split(/[-ー−‐-]/) // 半角/全角/見た目ハイフンっぽいやつ全部
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          if (hyphenParts.length >= 2) {
            // 「山田-太郎」「山田－太郎」など
            lastName = hyphenParts[0];
            firstName = hyphenParts.slice(1).join(' ');
          } else {
            // ハイフンが無いときは、スペース / 全角スペースで区切る
            const spaceParts = fullName
              .split(/\s+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            if (spaceParts.length >= 2) {
              // 「山田 太郎」「山田　太郎」など
              lastName = spaceParts[0];
              firstName = spaceParts.slice(1).join(' ');
            } else {
              // どうしても分けられない → ぜんぶ姓に入れる（会社名もここ）
              lastName = fullName;
            }
          }
        }
      }

      // ★姓（=個人の苗字 or 会社名）は必須
      if (!lastName) {
        rowErrors.push('姓（会社名を含む）は必須です。');
      }
      // 名は任意なのでバリデーションしない

      // --- 住所・電話などのカラム -------------------------
      const postalCodeRaw = (raw['郵便番号'] || '').trim();

      // まずは既存仕様（住所（番地まで）/住所（建物名など））を見る
      let address1 = (raw['住所（番地まで）'] || '').trim() || null;
      const address2 = (raw['住所（建物名など）'] || '').trim() || null;

      // ★ 両方空っぽなら、単一の住所カラムから全部 address1 に入れる
      if (!address1 && !address2) {
        const singleAddress = (raw['住所'] || raw['所在地'] || '').trim(); // 必要ならヘッダー追加
        if (singleAddress) {
          address1 = singleAddress;
        }
      }

      // 携帯番号カラム名を2パターン見て、数字だけに正規化
      const phoneRaw = (raw['携帯番号'] || raw['携帯電話番号'] || '').trim();
      const lineUidRaw = (raw['LINE UID'] || '').trim();
      const birthdayRaw = (raw['誕生日'] || '').trim();

      // ★ 郵便番号の整形（数字だけ抽出 → 7桁なら 123-4567 に整形）
      let postalCode: string | null = null;
      if (postalCodeRaw) {
        const digits = postalCodeRaw.replace(/\D/g, '');
        if (digits.length !== 7) {
          rowErrors.push('郵便番号は7桁で入力してください（例：8100001）。');
        } else {
          postalCode = `${digits.slice(0, 3)}-${digits.slice(3)}`;
        }
      }

      // ★ 携帯番号は normalizePhone で「数字のみ」に
      const phoneNumber = normalizePhone(phoneRaw);

      // LINE UID：CSV内での重複チェック（空はスキップ）
      let lineUid: string | null = null;
      if (lineUidRaw) {
        lineUid = lineUidRaw;
        const existed = lineUidSeenInFile.get(lineUidRaw);
        if (existed) {
          rowErrors.push(
            `LINE UID が同じCSV内で重複しています（${existed}行目と重複）。`,
          );
        } else {
          lineUidSeenInFile.set(lineUidRaw, rowNumber);
        }
      }

      // 誕生日のパース（YYYY-MM-DD / YYYY/M/D あたりを想定）※UTCで固定
      let birthday: Date | null = null;
      if (birthdayRaw) {
        const normalized = birthdayRaw.replace(/\./g, '/').replace(/-/g, '/');
        const parts = normalized.split(/[\/]/);

        if (parts.length === 3) {
          const [y, m, d] = parts.map((p) => parseInt(p, 10));
          if (!y || !m || !d) {
            rowErrors.push('誕生日の形式が不正です。（例：1985-04-01）');
          } else {
            const utcMs = Date.UTC(y, m - 1, d);
            const date = new Date(utcMs);

            if (
              date.getUTCFullYear() !== y ||
              date.getUTCMonth() !== m - 1 ||
              date.getUTCDate() !== d
            ) {
              rowErrors.push('誕生日の日付が存在しません。');
            } else {
              birthday = date;
            }
          }
        } else {
          rowErrors.push('誕生日の形式が不正です。（例：1985-04-01）');
        }
      }

      // --- 行ごとのエラー判定 -------------------------
      if (rowErrors.length > 0) {
        errors.push({
          rowNumber,
          messages: rowErrors,
          raw,
        });
        return;
      }

      // バリデーションOKの行を溜める
      validRows.push({
        rowNumber,
        raw,
        lastName,
        firstName,
        postalCode,
        address1,
        address2,
        phoneNumber,
        lineUid,
        birthday,
      });
    });

    // 3. strategy='rollback' で、バリデーションエラーが1件でもあれば中止
    if (strategy === 'rollback' && errors.length > 0) {
      return {
        totalRows,
        importedCount: 0,
        skippedCount: totalRows,
        errors,
      };
    }

    // 4. DB登録
    let importedCount = 0;
    const allErrors: CsvImportError[] = [...errors];

    if (strategy === 'rollback') {
      // 4-1. 全ロールバックモード
      try {
        await this.prisma.$transaction(async (tx) => {
          for (const row of validRows) {
            await tx.customer.create({
              data: {
                tenantId,
                lastName: row.lastName,
                firstName: row.firstName,
                postalCode: row.postalCode,
                address1: row.address1,
                address2: row.address2,
                mobilePhone: row.phoneNumber,
                lineUid: row.lineUid,
                birthday: row.birthday,
              },
            });
          }
        });

        importedCount = validRows.length;

        return {
          totalRows,
          importedCount,
          skippedCount: totalRows - importedCount,
          errors: allErrors,
        };
      } catch (e: any) {
        // どこか1件でもDBエラーが出たら全ロールバック
        allErrors.push({
          rowNumber: 0,
          messages: [
            'データベース登録中にエラーが発生したため、全件ロールバックしました。',
          ],
          raw: {},
        });

        return {
          totalRows,
          importedCount: 0,
          skippedCount: totalRows,
          errors: allErrors,
        };
      }
    } else {
      // 4-2. エラー行だけスキップモード（デフォルト）

      // ★携帯番号ごとに 1 顧客にまとめるためのキャッシュ
      const phoneToCustomerId = new Map<string, number>();

      for (const row of validRows) {
        try {
          const phone = row.phoneNumber;
          let customerId: number;

          if (!phone) {
            // 携帯番号が無い行は毎回新規で作成
            const created = await this.prisma.customer.create({
              data: {
                tenantId,
                lastName: row.lastName,
                firstName: row.firstName,
                postalCode: row.postalCode,
                address1: row.address1,
                address2: row.address2,
                mobilePhone: row.phoneNumber,
                lineUid: row.lineUid,
                birthday: row.birthday,
              },
            });
            customerId = created.id;
          } else {
            // 携帯番号あり：同一CSV内で一度作った顧客を再利用
            const cached = phoneToCustomerId.get(phone);
            if (cached) {
              customerId = cached;
            } else {
              // 既にDBに同じ携帯番号の顧客がいればそれを使う
              const existed = await this.prisma.customer.findFirst({
                where: {
                  tenantId,
                  mobilePhone: phone,
                },
                select: { id: true },
              });

              if (existed) {
                customerId = existed.id;
              } else {
                const created = await this.prisma.customer.create({
                  data: {
                    tenantId,
                    lastName: row.lastName,
                    firstName: row.firstName,
                    postalCode: row.postalCode,
                    address1: row.address1,
                    address2: row.address2,
                    mobilePhone: row.phoneNumber,
                    lineUid: row.lineUid,
                    birthday: row.birthday,
                  },
                });
                customerId = created.id;
              }

              phoneToCustomerId.set(phone, customerId);
            }
          }

          // ★このあとで車両登録を行う
          // CSV に車両情報があれば car を作成
          const raw = row.raw;
          const registrationNumber = (raw['登録番号'] || '').trim();
          const carName = (raw['車両名'] || '').trim();
          const chassisNumber = (raw['車台番号'] || '').trim();
          const shakenRaw = (raw['車検日'] || '').trim();

          if (registrationNumber || carName || chassisNumber || shakenRaw) {
            const shakenDate = parseJapaneseDate(shakenRaw);

            await this.prisma.car.create({
              data: {
                tenantId,
                customerId,
                // ★ Prisma 側が string 必須なので、空なら "" にする
                registrationNumber: registrationNumber || '',
                carName: carName || '',
                chassisNumber: chassisNumber || '',
                shakenDate,
              },
            });
          }

          importedCount++;
        } catch (e: any) {
          allErrors.push({
            rowNumber: row.rowNumber,
            messages: [
              'DB登録時にエラーが発生したため、この行はスキップしました。',
            ],
            raw: row.raw,
          });
        }
      }

      const skippedCount = totalRows - importedCount;

      return {
        totalRows,
        importedCount,
        skippedCount,
        errors: allErrors,
      };
    }
  }

  /**
   * テナントIDを取り出すヘルパー
   * - DEVELOPER はここでは禁止（顧客操作はテナントで行う想定）
   * - MANAGER / CLIENT は tenantId 必須
   */
  private ensureTenant(user: AuthPayload): number {
    if (user.role === 'DEVELOPER') {
      throw new ForbiddenException(
        '顧客の操作はテナントユーザーで行ってください',
      );
    }
    if (!user.tenantId) {
      throw new ForbiddenException('テナントが特定できません');
    }
    return user.tenantId;
  }

  /**
   * ログインユーザーに紐づく顧客一覧
   */
  async findAllForUser(user: AuthPayload) {
    const tenantId = this.ensureTenant(user);

    // 顧客と一緒に「cars の件数」も取る
    const rows = await this.prisma.customer.findMany({
      where: { tenantId },
      orderBy: { id: 'asc' }, // ここは今使ってる orderBy に合わせてOK
      include: {
        _count: {
          select: { cars: true },
        },
      },
    });

    // フロントで扱いやすいように hasVehicle を付けて返す
    return rows.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      lastName: c.lastName,
      firstName: c.firstName,
      postalCode: c.postalCode,
      address1: c.address1,
      address2: c.address2,
      mobilePhone: c.mobilePhone,
      lineUid: c.lineUid,
      birthday: c.birthday,
      // ★ ここがタグの元ネタ
      hasVehicle: c._count.cars > 0,
    }));
  }

  /**
   * 顧客新規作成
   * - tenantId はログインユーザーから決定
   * - mobilePhone / lineUid の一意制約違反時は分かりやすいメッセージに変換
   * - birthday は "YYYY-MM-DD" 文字列で受け取り Date に変換
   */
  async createForUser(user: AuthPayload, data: CreateCustomerDto) {
    if (!user.tenantId) {
      throw new Error('テナント情報が取得できませんでした。');
    }

    return this.prisma.customer.create({
      data: {
        tenantId: user.tenantId,
        lastName: data.lastName,
        // ★ firstName は任意なので、undefined/null のときは空文字で保存
        firstName: data.firstName ?? '',
        postalCode: data.postalCode ?? null,
        address1: data.address1 ?? null,
        address2: data.address2 ?? null,
        mobilePhone: data.mobilePhone ?? null,
        lineUid: data.lineUid ?? null,
        birthday: data.birthday ? new Date(data.birthday) : null,
      },
    });
  }

  /**
   * 単一顧客の取得（テナントチェック付き）
   */
  async findOneForUser(user: AuthPayload, id: number) {
    const tenantId = this.ensureTenant(user);

    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      throw new NotFoundException('顧客が見つかりません');
    }

    return customer;
  }

  /**
   * 顧客更新
   * - テナントチェック
   * - 一意制約違反も create と同様にハンドリング
   * - birthday があれば Date に変換して保存
   */
  async updateForUser(
    user: AuthPayload,
    id: number,
    data: {
      lastName?: string;
      firstName?: string;
      postalCode?: string;
      address1?: string;
      address2?: string;
      mobilePhone?: string;
      lineUid?: string;
      birthday?: string;
    },
  ) {
    const tenantId = this.ensureTenant(user);

    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('顧客が見つかりません');
    }

    // birthday だけ Date に変換した updateData を組み立てる
    const updateData: any = { ...data };
    if (data.birthday !== undefined) {
      updateData.birthday = data.birthday ? new Date(data.birthday) : null;
    }

    try {
      return await this.prisma.customer.update({
        where: { id },
        data: updateData,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const rawTarget = e.meta?.target as string[] | string | undefined;
        const targets =
          typeof rawTarget === 'string' ? [rawTarget] : (rawTarget ?? []);

        if (targets.some((t) => t.includes('mobilePhone'))) {
          throw new BadRequestException('この携帯番号は既に登録されています');
        }

        if (targets.some((t) => t.includes('lineUid'))) {
          throw new BadRequestException('このLINE UIDは既に登録されています');
        }

        throw new BadRequestException('顧客情報の一意制約エラーが発生しました');
      }

      throw e;
    }
  }

  /**
   * LINE からの登録／更新用
   * - tenantId + mobilePhone で既存顧客を探す
   * - 見つかればその顧客に lineUid を紐づけて情報を上書き／補完
   * - 見つからなければ新規顧客として作成
   *
   * ※ AuthPayload は使わず、LINE 側などから直接 tenantId をもらって使う想定
   */

  /**
   * LINE からの登録／更新用
   * - tenantId + mobilePhone で既存顧客を探す
   * - 見つかればその顧客に lineUid を紐づけて情報を上書き／補完
   * - 見つからなければ新規顧客として作成
   *
   * ※ 既存の create/update API は一切触らない
   */
  async upsertFromLineByMobilePhone(
    tenantId: number,
    data: {
      mobilePhone: string;
      lineUid: string;
      lastName?: string;
      firstName?: string;
      postalCode?: string;
      address1?: string;
      address2?: string;
      birthday?: string; // "2025-12-02" みたいな文字列想定
    },
  ) {
    try {
      // 1. 既存顧客を検索（このテナント内で、電話番号が一致するもの）
      const existing = await this.prisma.customer.findFirst({
        where: {
          tenantId,
          mobilePhone: data.mobilePhone,
        },
      });

      if (existing) {
        // 2-A. 既存顧客がいる場合 → その顧客を更新
        //     - lineUid は常に上書き
        //     - 他の項目は「undefined のときはそのまま」「指定があれば上書き」
        const updateData: any = {
          lineUid: data.lineUid,
        };

        if (data.lastName !== undefined) {
          updateData.lastName = data.lastName;
        }
        if (data.firstName !== undefined) {
          updateData.firstName = data.firstName;
        }
        if (data.postalCode !== undefined) {
          updateData.postalCode = data.postalCode;
        }
        if (data.address1 !== undefined) {
          updateData.address1 = data.address1;
        }
        if (data.address2 !== undefined) {
          updateData.address2 = data.address2;
        }
        if (data.birthday !== undefined) {
          updateData.birthday = data.birthday ? new Date(data.birthday) : null;
        }

        return await this.prisma.customer.update({
          where: { id: existing.id },
          data: updateData,
        });
      }

      // 2-B. 見つからなければ新規作成
      return await this.prisma.customer.create({
        data: {
          tenantId,
          lastName: data.lastName ?? '',
          firstName: data.firstName ?? '',
          postalCode: data.postalCode,
          address1: data.address1,
          address2: data.address2,
          mobilePhone: data.mobilePhone,
          lineUid: data.lineUid,
          birthday: data.birthday ? new Date(data.birthday) : undefined,
        },
      });
    } catch (e) {
      // create/update と同じノリの一意制約エラーハンドリング
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const rawTarget = e.meta?.target as string[] | string | undefined;
        const targets =
          typeof rawTarget === 'string' ? [rawTarget] : (rawTarget ?? []);

        if (targets.some((t) => t.includes('mobilePhone'))) {
          throw new BadRequestException('この携帯番号は既に登録されています');
        }

        if (targets.some((t) => t.includes('lineUid'))) {
          throw new BadRequestException('このLINE UIDは既に登録されています');
        }

        throw new BadRequestException('顧客情報の一意制約エラーが発生しました');
      }

      throw e;
    }
  }

  /**
   * 顧客削除
   * - 自テナントの顧客かチェック
   * - 車両・予約がある場合は削除不可
   * - ログ系（メッセージログ・リマインドログ・一括送信ログ）は自動的に削除してから顧客を削除
   */
  async removeForUser(user: AuthPayload, id: number) {
    const tenantId = this.ensureTenant(user);

    // 1. 自テナントの顧客か確認
    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('顧客が見つかりません');
    }

    // 2. 関連データの有無をチェック
    const [
      carsCount,
      bookingsCount,
      messageLogsCount,
      reminderLogsCount,
      broadcastLogCustomersCount,
    ] = await this.prisma.$transaction([
      // 車両
      this.prisma.car.count({
        where: { tenantId, customerId: id },
      }),
      // 予約
      this.prisma.booking.count({
        where: { tenantId, customerId: id },
      }),
      // メッセージログ
      this.prisma.messageLog.count({
        where: { tenantId, customerId: id },
      }),
      // リマインド送信ログ
      this.prisma.reminderSentLog.count({
        where: { tenantId, customerId: id },
      }),
      // 一括送信ログ（中間テーブル）
      this.prisma.broadcastLogCustomer.count({
        where: {
          customerId: id,
          broadcastLog: {
            tenantId,
          },
        },
      }),
    ]);

    // 3. 車両 or 予約がある場合は削除禁止
    if (carsCount > 0 || bookingsCount > 0) {
      throw new BadRequestException(
        'この顧客には車両または予約が紐づいているため削除できません。先に車両や予約を削除してください。',
      );
    }

    // 4. ログ系は自動で削除してから顧客を削除
    try {
      await this.prisma.$transaction([
        // 一括送信ログとの紐づけ
        this.prisma.broadcastLogCustomer.deleteMany({
          where: {
            customerId: id,
            broadcastLog: {
              tenantId,
            },
          },
        }),
        // メッセージログ
        this.prisma.messageLog.deleteMany({
          where: { tenantId, customerId: id },
        }),
        // リマインド送信ログ
        this.prisma.reminderSentLog.deleteMany({
          where: { tenantId, customerId: id },
        }),
        // 顧客本体
        this.prisma.customer.delete({
          where: { id },
        }),
      ]);

      return { success: true };
    } catch (e) {
      // 念のため外部キー制約はここでも拾っておく
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new BadRequestException(
          '関連データが残っているため顧客を削除できません。',
        );
      }
      throw e;
    }
  }
}
