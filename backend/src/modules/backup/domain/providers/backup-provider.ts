export type BackupProvider = 'local' | 'aws' | 'azure' | 'gcp';

export interface BackupResult {
  success: boolean;
  provider: BackupProvider;
  path: string;
  size: number;
  timestamp: Date;
  error?: string;
}

export interface BackupProviderAdapter {
  name: BackupProvider;
  upload(filename: string, data: Buffer): Promise<BackupResult>;
  list(): Promise<string[]>;
  delete(filename: string): Promise<boolean>;
  download(filename: string): Promise<Buffer>;
}
