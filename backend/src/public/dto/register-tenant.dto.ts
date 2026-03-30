export class RegisterTenantDto {
  companyName?: string | null;
  adminName: string;         // 代表者名
  email: string;
  password: string;
  phone: string;             // 代表の電話（必須）

  phoneVerificationToken: string; // SMS認証で取得したトークン（必須）

  tenantName?: string | null;

  companyAddress1?: string | null;
  companyAddress2?: string | null;
  representativeName?: string | null;
  contactPhone?: string | null;
  contactMobile?: string | null;
}
