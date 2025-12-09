// src/cars/dto/create-car.dto.ts
export class CreateCarDto {
  customerId!: number;
  registrationNumber!: string;
  chassisNumber!: string;
  carName!: string;
  shakenDate?: string; // 車検日
  inspectionDate?: string; // 点検日
  customReminderDate?: string; // 任意日付
  customDaysBefore?: number; // 任意何日前
}
