import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'uploads');

export async function ensureStorageDir() {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

export async function saveFile(file: File): Promise<{ filePath: string, fileSize: number, fileType: string }> {
  await ensureStorageDir();
  
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || '';
  
  // Security: Generate random filename to prevent path traversal and overwrite
  const randomName = crypto.randomBytes(16).toString('hex') + ext;
  const filePath = path.join(STORAGE_DIR, randomName);
  
  await fs.writeFile(filePath, buffer);
  
  return {
    filePath: randomName, // Store only the random filename in DB
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream'
  };
}

export async function getFileBuffer(filename: string): Promise<Buffer | null> {
  const filePath = path.join(STORAGE_DIR, path.basename(filename)); // basename ensures no directory traversal
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.error(error);
    return null;
  }
}
