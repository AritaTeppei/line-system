// backend/src/billing/dto/create-checkout-session.dto.ts
export class CreateCheckoutSessionDto {
  tenantId: number; // とりあえず明示的に受け取る（あとで認証から取るようにしてもOK）
  plan: string; // 'BASIC' / 'STANDARD' / 'PRO' など
  fromLogin?: boolean; // ログイン後のリダイレクトかどうか
}
