// backend/src/public/dto/register-tenant.dto.ts
export class RegisterTenantDto {
  companyName: string;
  adminName?: string;
  email: string;
  password: string;
  phone?: string;
}
