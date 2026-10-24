import { PassThrough } from 'stream';
import archiver from 'archiver';

export const normalizeBuffer = (value: Buffer | ArrayBuffer | Uint8Array): Buffer => {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  return Buffer.from(value);
};

export const createZipBuffer = async (
  files: Array<{ name: string; buffer: Buffer }>
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    archive.on('error', reject);

    archive.pipe(stream);
    files.forEach((file) => archive.append(file.buffer, { name: file.name }));
    archive.finalize();
  });
};
