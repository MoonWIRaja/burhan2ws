import fs from "fs/promises";
import path from "path";

export class StorageService {
  private baseDataPath: string;

  constructor() {
    this.baseDataPath = process.env.DATA_PATH || "./data";
  }

  // Create user folder structure on registration
  async initUserFolder(userId: string): Promise<string> {
    const userPath = path.join(this.baseDataPath, userId);

    await fs.mkdir(path.join(userPath, "uploads"), { recursive: true });
    await fs.mkdir(path.join(userPath, "sessions"), { recursive: true });
    await fs.mkdir(path.join(userPath, "knowledge"), { recursive: true });
    await fs.mkdir(path.join(userPath, "exports"), { recursive: true });

    return userPath;
  }

  // Get user-specific paths
  getUserPaths(userId: string) {
    const userPath = path.join(this.baseDataPath, userId);
    return {
      base: userPath,
      uploads: path.join(userPath, "uploads"),
      sessions: path.join(userPath, "sessions"),
      knowledge: path.join(userPath, "knowledge"),
      exports: path.join(userPath, "exports"),
    };
  }

  // Save uploaded file to user's folder
  async saveUpload(
    userId: string,
    file: Buffer,
    filename: string
  ): Promise<string> {
    const uploadPath = path.join(this.getUserPaths(userId).uploads, filename);
    await fs.writeFile(uploadPath, file);
    return `/data/${userId}/uploads/${filename}`;
  }

  // Save knowledge file
  async saveKnowledge(
    userId: string,
    file: Buffer,
    filename: string
  ): Promise<string> {
    const knowledgePath = path.join(
      this.getUserPaths(userId).knowledge,
      filename
    );
    await fs.writeFile(knowledgePath, file);
    return `/data/${userId}/knowledge/${filename}`;
  }

  // Get file from user's folder
  async getFile(userId: string, folder: string, filename: string): Promise<Buffer> {
    const filePath = path.join(this.baseDataPath, userId, folder, filename);
    return fs.readFile(filePath);
  }

  // Delete file from user's folder
  async deleteFile(userId: string, folder: string, filename: string): Promise<void> {
    const filePath = path.join(this.baseDataPath, userId, folder, filename);
    await fs.unlink(filePath);
  }

  // List files in user's folder
  async listFiles(userId: string, folder: string): Promise<string[]> {
    const folderPath = path.join(this.baseDataPath, userId, folder);
    try {
      return await fs.readdir(folderPath);
    } catch {
      return [];
    }
  }

  // Clean up user data on account deletion
  async deleteUserFolder(userId: string): Promise<void> {
    const userPath = path.join(this.baseDataPath, userId);
    await fs.rm(userPath, { recursive: true, force: true });
  }

  // Export contacts to CSV
  async exportContactsToCsv(userId: string, data: string): Promise<string> {
    const filename = `contacts-${Date.now()}.csv`;
    const exportPath = path.join(this.getUserPaths(userId).exports, filename);
    await fs.writeFile(exportPath, data);
    return `/data/${userId}/exports/${filename}`;
  }
}

// Singleton instance
export const storageService = new StorageService();
