// src/customers/dto/create-customer.dto.ts
export class CreateCustomerDto {
  lastName!: string;
  firstName?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
  mobilePhone?: string;
  lineUid?: string;
  birthday?: string;
}
