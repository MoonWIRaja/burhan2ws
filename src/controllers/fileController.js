import prisma from '../config/database.js';
import path from 'path';

// Get files for a session
export async function getFiles(req, res) {
  try {
    const { sessionId } = req.params;
    const { limit = 20, offset = 0, status } = req.query;

    const where = { sessionId };
    if (status) {
      where.uploadStatus = status;
    }

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.file.count({ where })
    ]);

    res.json({
      success: true,
      data: files,
      meta: { total, limit, offset }
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get file by ID
export async function getFileById(req, res) {
  try {
    const { id } = req.params;

    const file = await prisma.file.findUnique({
      where: { id }
    });

    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    res.json({ success: true, data: file });
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Delete file
export async function deleteFileById(req, res) {
  try {
    const { id } = req.params;

    const file = await prisma.file.findUnique({
      where: { id }
    });

    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Delete file from database
    await prisma.file.delete({
      where: { id }
    });

    // TODO: Delete file from filesystem
    // fs.unlinkSync(file.filePath);

    res.json({ success: true, data: { message: 'File deleted successfully' } });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
