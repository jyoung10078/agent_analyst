import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { findDocumentByS3Key, updateDocumentStatus } from '../../shared/dynamodb';
import { startIngestionJob } from '../../shared/bedrock';

const s3Client = new S3Client({ region: process.env.REGION });
const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET!;
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID!;
const DATA_SOURCE_ID = process.env.DATA_SOURCE_ID!;

async function getS3Object(bucket: string, key: string): Promise<Buffer> {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function processExcel(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid issues at module load time
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const lines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    lines.push(`## Sheet: ${sheetName}\n`);

    if (jsonData.length === 0) continue;

    const rows = jsonData as unknown[][];
    const headers = rows[0] as string[];
    lines.push('| ' + headers.join(' | ') + ' |');
    lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      lines.push('| ' + row.map((cell) => String(cell ?? '')).join(' | ') + ' |');
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function processCsv(buffer: Buffer): Promise<string> {
  const { parse } = await import('csv-parse/sync');
  const records = parse(buffer.toString('utf-8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  if (records.length === 0) return '';

  const headers = Object.keys(records[0]);
  const lines: string[] = [];
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');

  for (const record of records) {
    lines.push('| ' + headers.map((h) => record[h] ?? '').join(' | ') + ' |');
  }

  return lines.join('\n');
}

export async function handler(event: S3Event): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing S3 event: ${bucket}/${key}`);

    // Only process files in the uploads/ prefix
    if (!key.startsWith('uploads/')) {
      console.log('Skipping non-upload file:', key);
      continue;
    }

    const extension = key.split('.').pop()?.toLowerCase() ?? '';

    // Find document record
    const docRecord = await findDocumentByS3Key(key);
    if (!docRecord) {
      console.error('Document record not found for key:', key);
      continue;
    }

    const { userId, documentId } = docRecord;

    try {
      await updateDocumentStatus(userId, documentId, 'PROCESSING');

      // For Excel and CSV files, convert to text/markdown and re-upload
      if (['xlsx', 'xls'].includes(extension)) {
        const buffer = await getS3Object(bucket, key);
        const markdown = await processExcel(buffer);
        const processedKey = key.replace('uploads/', 'processed/').replace(/\.(xlsx|xls)$/, '.txt');

        await s3Client.send(new PutObjectCommand({
          Bucket: DOCUMENTS_BUCKET,
          Key: processedKey,
          Body: markdown,
          ContentType: 'text/plain',
        }));

        console.log(`Converted Excel to markdown: ${processedKey}`);
      } else if (extension === 'csv') {
        const buffer = await getS3Object(bucket, key);
        const markdown = await processCsv(buffer);
        const processedKey = key.replace('uploads/', 'processed/').replace(/\.csv$/, '.txt');

        await s3Client.send(new PutObjectCommand({
          Bucket: DOCUMENTS_BUCKET,
          Key: processedKey,
          Body: markdown,
          ContentType: 'text/plain',
        }));

        console.log(`Converted CSV to markdown: ${processedKey}`);
      }
      // PDF, DOCX — Bedrock KB handles natively from uploads/ prefix

      // Start KB ingestion
      const jobId = await startIngestionJob(KNOWLEDGE_BASE_ID, DATA_SOURCE_ID);
      console.log(`Started ingestion job: ${jobId}`);

      await updateDocumentStatus(userId, documentId, 'READY');
    } catch (err) {
      console.error(`Failed to process document ${documentId}:`, err);
      await updateDocumentStatus(userId, documentId, 'FAILED');
    }
  }
}
