import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../../../config.js';
import { logger } from '../../../../shared/infrastructure/logger/logger.js';
import type {
  BackupProvider,
  BackupProviderAdapter,
  BackupResult,
} from '../../domain/providers/backup-provider.js';

export class LocalBackupProvider implements BackupProviderAdapter {
  name: BackupProvider = 'local';
  private readonly basePath = path.resolve(config.backup.local.path);

  constructor() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async upload(filename: string, data: Buffer): Promise<BackupResult> {
    const filePath = path.join(this.basePath, filename);
    try {
      fs.writeFileSync(filePath, data);
      const stats = fs.statSync(filePath);
      return {
        success: true,
        provider: this.name,
        path: filePath,
        size: stats.size,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        path: filePath,
        size: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async list(): Promise<string[]> {
    try {
      return fs
        .readdirSync(this.basePath)
        .filter((file) => file.endsWith('.sql') || file.endsWith('.sql.gz'));
    } catch {
      return [];
    }
  }

  async delete(filename: string): Promise<boolean> {
    try {
      fs.unlinkSync(path.join(this.basePath, filename));
      return true;
    } catch {
      return false;
    }
  }

  async download(filename: string): Promise<Buffer> {
    return fs.readFileSync(path.join(this.basePath, filename));
  }
}

export class AwsS3BackupProvider implements BackupProviderAdapter {
  name: BackupProvider = 'aws';
  private readonly bucket = config.backup.aws.bucket;
  private readonly region = config.backup.aws.region;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private s3Client: any = null;
  private initialized = false;

  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return this.s3Client !== null;
    this.initialized = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s3Module = await (eval('import("@aws-sdk/client-s3")') as Promise<any>);
      this.s3Client = new s3Module.S3Client({
        region: this.region,
        credentials: {
          accessKeyId: config.backup.aws.accessKeyId,
          secretAccessKey: config.backup.aws.secretAccessKey,
        },
      });
      return true;
    } catch {
      logger.warn('[BACKUP] AWS SDK not installed. Run: npm install @aws-sdk/client-s3');
      return false;
    }
  }

  async upload(filename: string, data: Buffer): Promise<BackupResult> {
    const resultPath = `s3://${this.bucket}/backups/${filename}`;
    try {
      if (!(await this.ensureInitialized())) throw new Error('AWS SDK not available');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s3Module = await (eval('import("@aws-sdk/client-s3")') as Promise<any>);
      await this.s3Client.send(
        new s3Module.PutObjectCommand({
          Bucket: this.bucket,
          Key: `backups/${filename}`,
          Body: data,
          ContentType: 'application/gzip',
        })
      );
      return {
        success: true,
        provider: this.name,
        path: resultPath,
        size: data.length,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        path: resultPath,
        size: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async list(): Promise<string[]> {
    try {
      if (!(await this.ensureInitialized())) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s3Module = await (eval('import("@aws-sdk/client-s3")') as Promise<any>);
      const response = await this.s3Client.send(
        new s3Module.ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: 'backups/',
        })
      );
      return (
        (response.Contents || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => item.Key?.replace('backups/', '') || '')
          .filter((key: string) => key)
      );
    } catch {
      return [];
    }
  }

  async delete(filename: string): Promise<boolean> {
    try {
      if (!(await this.ensureInitialized())) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s3Module = await (eval('import("@aws-sdk/client-s3")') as Promise<any>);
      await this.s3Client.send(
        new s3Module.DeleteObjectCommand({
          Bucket: this.bucket,
          Key: `backups/${filename}`,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async download(filename: string): Promise<Buffer> {
    if (!(await this.ensureInitialized())) throw new Error('AWS SDK not available');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s3Module = await (eval('import("@aws-sdk/client-s3")') as Promise<any>);
    const response = await this.s3Client.send(
      new s3Module.GetObjectCommand({
        Bucket: this.bucket,
        Key: `backups/${filename}`,
      })
    );
    const bytes = await response.Body?.transformToByteArray();
    return Buffer.from(bytes || []);
  }
}

export class AzureBlobBackupProvider implements BackupProviderAdapter {
  name: BackupProvider = 'azure';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private containerClient: any = null;
  private initialized = false;

  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return this.containerClient !== null;
    this.initialized = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const azureModule = await (eval('import("@azure/storage-blob")') as Promise<any>);
      const blobServiceClient = azureModule.BlobServiceClient.fromConnectionString(
        config.backup.azure.connectionString
      );
      this.containerClient = blobServiceClient.getContainerClient(
        config.backup.azure.containerName
      );
      return true;
    } catch {
      logger.warn('[BACKUP] Azure SDK not installed. Run: npm install @azure/storage-blob');
      return false;
    }
  }

  async upload(filename: string, data: Buffer): Promise<BackupResult> {
    try {
      if (!(await this.ensureInitialized())) throw new Error('Azure SDK not available');
      const blockBlobClient = this.containerClient.getBlockBlobClient(filename);
      await blockBlobClient.upload(data, data.length);
      return {
        success: true,
        provider: this.name,
        path: blockBlobClient.url,
        size: data.length,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        path: filename,
        size: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async list(): Promise<string[]> {
    try {
      if (!(await this.ensureInitialized())) return [];
      const blobs: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const blob of this.containerClient.listBlobsFlat() as AsyncIterable<any>) {
        blobs.push(blob.name);
      }
      return blobs;
    } catch {
      return [];
    }
  }

  async delete(filename: string): Promise<boolean> {
    try {
      if (!(await this.ensureInitialized())) return false;
      await this.containerClient.getBlockBlobClient(filename).delete();
      return true;
    } catch {
      return false;
    }
  }

  async download(filename: string): Promise<Buffer> {
    if (!(await this.ensureInitialized())) throw new Error('Azure SDK not available');
    return this.containerClient.getBlockBlobClient(filename).downloadToBuffer();
  }
}

export class GcpStorageBackupProvider implements BackupProviderAdapter {
  name: BackupProvider = 'gcp';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private bucket: any = null;
  private initialized = false;

  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return this.bucket !== null;
    this.initialized = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gcpModule = await (eval('import("@google-cloud/storage")') as Promise<any>);
      const storage = new gcpModule.Storage({
        projectId: config.backup.gcp.projectId,
        keyFilename: config.backup.gcp.keyFile || undefined,
      });
      this.bucket = storage.bucket(config.backup.gcp.bucket);
      return true;
    } catch {
      logger.warn('[BACKUP] GCP SDK not installed. Run: npm install @google-cloud/storage');
      return false;
    }
  }

  async upload(filename: string, data: Buffer): Promise<BackupResult> {
    try {
      if (!(await this.ensureInitialized())) throw new Error('GCP SDK not available');
      const file = this.bucket.file(filename);
      await file.save(data);
      return {
        success: true,
        provider: this.name,
        path: `gs://${config.backup.gcp.bucket}/${filename}`,
        size: data.length,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        path: filename,
        size: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async list(): Promise<string[]> {
    try {
      if (!(await this.ensureInitialized())) return [];
      const [files] = await this.bucket.getFiles();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return files.map((file: any) => file.name);
    } catch {
      return [];
    }
  }

  async delete(filename: string): Promise<boolean> {
    try {
      if (!(await this.ensureInitialized())) return false;
      await this.bucket.file(filename).delete();
      return true;
    } catch {
      return false;
    }
  }

  async download(filename: string): Promise<Buffer> {
    if (!(await this.ensureInitialized())) throw new Error('GCP SDK not available');
    const [contents] = await this.bucket.file(filename).download();
    return contents;
  }
}

export const createBackupProviders = (): BackupProviderAdapter[] => {
  const providers: BackupProviderAdapter[] = [];
  for (const providerName of config.backup.providers) {
    switch (providerName) {
      case 'local':
        providers.push(new LocalBackupProvider());
        break;
      case 'aws':
        providers.push(new AwsS3BackupProvider());
        break;
      case 'azure':
        providers.push(new AzureBlobBackupProvider());
        break;
      case 'gcp':
        providers.push(new GcpStorageBackupProvider());
        break;
    }
  }
  if (providers.length === 0) {
    providers.push(new LocalBackupProvider());
  }
  return providers;
};
