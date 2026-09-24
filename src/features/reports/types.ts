export type ReportReason = 'SCAM' | 'MISLEADING' | 'PROHIBITED_ITEM' | 'SPAM' | 'OTHER';

export interface CreateReportInput {
  reason: ReportReason;
  description?: string;
}
