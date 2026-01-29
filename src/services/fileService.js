import { readFileSync } from 'fs';
import pdf from 'pdf-parse';
import xlsx from 'xlsx';

/**
 * Process uploaded file
 */
export async function processFile(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();

  try {
    switch (ext) {
      case 'pdf':
        return await processPDF(filePath);
      case 'xlsx':
      case 'xls':
        return await processExcel(filePath);
      case 'csv':
        return await processCSV(filePath);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Process PDF file
 */
async function processPDF(filePath) {
  const dataBuffer = readFileSync(filePath);
  const data = await pdf(dataBuffer);

  return {
    type: 'pdf',
    text: data.text,
    pages: data.numpages,
    metadata: {
      title: data.info?.Title,
      author: data.info?.Author,
      subject: data.info?.Subject,
      creator: data.info?.Creator
    }
  };
}

/**
 * Process Excel file
 */
async function processExcel(filePath) {
  const workbook = xlsx.readFile(filePath);
  const result = {};

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    result[sheetName] = {
      rows: data,
      rowCount: data.length,
      columnCount: data[0]?.length || 0
    };
  });

  return {
    type: 'excel',
    sheets: result,
    sheetCount: workbook.SheetNames.length
  };
}

/**
 * Process CSV file
 */
async function processCSV(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  return {
    type: 'csv',
    data,
    rowCount: data.length
  };
}

/**
 * Get file statistics
 */
export async function getFileStats(fileId) {
  const { getPrisma } = await import('../config/database.js');
  const file = await getPrisma().file.findUnique({
    where: { id: fileId }
  });

  if (!file) {
    throw new Error(`File ${fileId} not found`);
  }

  // Try to process the file to get additional stats
  if (file.uploadStatus === 'completed' && !file.processedAt) {
    const result = await processFile(file.filePath);
    return {
      file,
      stats: result
    };
  }

  return { file };
}
