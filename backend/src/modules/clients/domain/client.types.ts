export interface IClient {
  id: number;
  name: string;
  code: string;
  lockDay: number | null;
  paysOvertime: boolean;
  /** PRJ-01: quando true, lançamentos exigem projectId (flow projects). */
  requireProjectOnEntries: boolean;
  isActive: boolean;
  historicalOnly?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
