import type { getExportData } from '../../application/export.service.js';

export interface ExportPeriod {
  year: number;
  month: number;
}

export type AdminExportFormat = 'executive' | 'detailed';
export type ExportEntry = Awaited<ReturnType<typeof getExportData>>[number];

export interface ExportRequestParams {
  periods: ExportPeriod[];
  month?: number;
  year?: number;
  consultantId?: number;
  clientId?: number;
  mode?: string;
  requestedFormat?: AdminExportFormat | null;
}

export interface ExportFile {
  name: string;
  buffer: Buffer;
}

export interface ExportArtifact {
  contentType: string;
  contentDisposition: string;
  buffer: Buffer;
}
