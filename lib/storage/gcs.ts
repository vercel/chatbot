import { Storage } from '@google-cloud/storage';

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const bucketName = process.env.GCS_BUCKET_NAME || 'nava-storage-dev';
const bucket = storage.bucket(bucketName);

export interface UploadResult {
  url: string;
  downloadUrl: string;
  pathname: string;
  size: number;
}

export async function uploadFile(
  filename: string,
  fileBuffer: ArrayBuffer,
  contentType: string
): Promise<UploadResult> {
  try {
    // Generate a unique filename to avoid conflicts
    const timestamp = Date.now();
    const uniqueFilename = `chat-uploads/${timestamp}-${filename}`;
    
    const file = bucket.file(uniqueFilename);
    
    // Upload the file
    await file.save(Buffer.from(fileBuffer), {
      metadata: {
        contentType,
      },
      public: true, // Make file publicly accessible
    });

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${uniqueFilename}`;
    
    return {
      url: publicUrl,
      downloadUrl: publicUrl,
      pathname: uniqueFilename,
      size: fileBuffer.byteLength,
    };
  } catch (error) {
    console.error('Error uploading file to GCS:', error);
    throw new Error('Failed to upload file to Google Cloud Storage');
  }
}

export async function deleteFile(pathname: string): Promise<void> {
  try {
    await bucket.file(pathname).delete();
  } catch (error) {
    console.error('Error deleting file from GCS:', error);
    throw new Error('Failed to delete file from Google Cloud Storage');
  }
}

export async function getFileUrl(pathname: string): Promise<string> {
  return `https://storage.googleapis.com/${bucketName}/${pathname}`;
}
