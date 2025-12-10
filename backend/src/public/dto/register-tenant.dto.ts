export class RegisterTenantDto {
  companyName?: string | null;
  adminName: string;         // 代表者名
  email: string;
  password: string;
  phone: string;             // 代表の電話（必須）

  tenantName?: string | null;

  companyAddress1?: string | null;
  companyAddress2?: string | null;
  representativeName?: string | null; // adminName と同じでもOK
  contactPhone?: string | null;       // phone と同じでもOK
  contactMobile?: string | null;
}
