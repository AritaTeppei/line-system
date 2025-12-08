// backend/src/reminders/dto/preview-month.dto.ts

export interface DaySummaryDto {
  date: string; // "YYYY-MM-DD"
  birthdayCount: number;
  shakenTwoMonthsCount: number;
  shakenOneWeekCount: number;
  inspectionOneMonthCount: number;
  customCount: number;
  totalCount: number;
}

export type MonthReminderCategory =
  | 'birthday'
  | 'shakenTwoMonths'
  | 'shakenOneWeek'
  | 'inspectionOneMonth'
  | 'custom';

export interface MonthReminderItemDto {
  id: number;
  date: string; // "YYYY-MM-DD"
  category: MonthReminderCategory;
  customerName: string;
  carName?: string | null;
  plateNumber?: string | null;

    // ★ ここからフロントのモーダル用に追加
  customerPhone?: string | null;
  customerAddress?: string | null;

  shakenDate?: string | null;
  inspectionDate?: string | null;
  // ★ ここまで
  
}

export interface PreviewMonthResponseDto {
  month: string; // "YYYY-MM"
  tenantId: number;
  days: DaySummaryDto[];
  items: MonthReminderItemDto[];
}
