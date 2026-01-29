import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../config/database.js';
import * as XLSX from 'xlsx';
import * as pdfParse from 'pdf-parse';

const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined
});

// File Queue
export class FileQueue {
  constructor() {
    this.queue = new Queue('files', { connection: redis });
  }

  // Add process file job
  async addProcessJob(data) {
    return await this.queue.add('process-file', data, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 }
    });
  }
}

// File Worker
export class FileWorker {
  constructor(io) {
    this.worker = new Worker(
      'files',
      async (job) => {
        return await this.processJob(job, io);
      },
      { connection: redis, concurrency: 3 }
    );

    this.worker.on('completed', (job) => {
      console.log(`✅ File job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ File job ${job?.id} failed: ${err.message}`);
    });
  }

  async processJob(job, io) {
    const { fileId, sessionId, filePath, fileType } = job.data;

    try {
      let result;

      // Process based on file type
      if (fileType.includes('pdf')) {
        result = await this.processPDF(fileId, filePath);
      } else if (fileType.includes('sheet') || fileType.includes('excel')) {
        result = await this.processExcel(fileId, filePath);
      } else if (fileType.includes('csv')) {
        result = await this.processCSV(fileId, filePath);
      } else {
        // Just acknowledge other file types
        result = { message: 'File acknowledged' };
      }

      // Update file status
      await prisma.file.update({
        where: { id: fileId },
        data: {
          uploadStatus: 'completed',
          processedAt: new Date()
        }
      });

      // Emit via WebSocket
      io.emit('file:processed', { sessionId, fileId, result });
      io.to(`session:${sessionId}`).emit('file:processed', { sessionId, fileId, result });

      return { success: true, result };
    } catch (error) {
      // Update file status to failed
      await prisma.file.update({
        where: { id: fileId },
        data: {
          uploadStatus: 'failed'
        }
      });

      throw error;
    }
  }

  async processPDF(fileId, filePath) {
    const fs = await import('fs');
    const dataBuffer = fs.readFileSync(filePath);

    const data = await pdfParse(dataBuffer);

    return {
      type: 'pdf',
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  }

  async processExcel(fileId, filePath) {
    const fs = await import('fs');
    const workbook = XLSX.readFile(filePath);

    const result = {
      type: 'excel',
      sheets: [],
      data: {}
    };

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      result.sheets.push(sheetName);
      result.data[sheetName] = jsonData;
    });

    return result;
  }

  async processCSV(fileId, filePath) {
    const fs = await import('fs');
    const workbook = XLSX.readFile(filePath);
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    return {
      type: 'csv',
      data: jsonData
    };
  }
}

export default FileWorker;
