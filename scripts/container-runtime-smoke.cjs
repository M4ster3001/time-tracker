const { createRequire } = require('node:module');
const load = createRequire('/app/backend/package.json');
const { createCanvas } = load('canvas');
const ExcelJS = load('exceljs');
const { PrismaClient } = load('@prisma/client');
(async () => {
  if (process.getuid() === 0) throw new Error('Runtime must not run as root');
  if (createCanvas(8, 8).toBuffer('image/png').length === 0)
    throw new Error('Native canvas failed');
  const book = new ExcelJS.Workbook();
  book.addWorksheet('Test').addRow(['Client', 31]);
  if ((await book.xlsx.writeBuffer()).byteLength === 0) throw new Error('XLSX runtime failed');
  if (typeof PrismaClient !== 'function') throw new Error('Generated Prisma client missing');
  console.log(
    'Container non-root runtime, native canvas, XLSX and generated Prisma client passed.'
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
