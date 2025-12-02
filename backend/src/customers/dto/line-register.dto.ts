// src/customers/dto/line-register.dto.ts
export class LineRegisterDto {
  tenantId!: number;      // ひとまず素直に受け取る（あとでトークン化もできる）
  lineUid!: string;
  mobilePhone!: string;

  lastName?: string;
  firstName?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
  birthday?: string;      // "2025-12-02" 形式の文字列想定
}
