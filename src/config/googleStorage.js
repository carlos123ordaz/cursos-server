const { Storage } = require('@google-cloud/storage');
const path = require('path');

let storage;

try {
  const credentials = JSON.parse(process.env.GCS_KEY_FILE);
  storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials: credentials,
  });
  console.log('✅ Google Cloud Storage initialized');
} catch (error) {
  console.error('❌ Error initializing Google Cloud Storage:', error.message);
  storage = null;
}

const bucket = storage ? storage.bucket(process.env.GCS_BUCKET_NAME) : null;


const uploadToGCS = async (fileBuffer, filename, folder = '', mimetype) => {
  if (!bucket) {
    throw new Error('Google Cloud Storage is not configured');
  }

  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const finalFilename = `${timestamp}-${sanitizedFilename}`;

  const gcsFolder = process.env.GCS_FOLDER;
  const fullPath = folder
    ? `${gcsFolder}/${folder}/${finalFilename}`
    : `${gcsFolder}/${finalFilename}`;

  const blob = bucket.file(fullPath);

  const blobStream = blob.createWriteStream({
    resumable: false,
    metadata: {
      contentType: mimetype,
    },
  });

  return new Promise((resolve, reject) => {
    blobStream.on('error', (err) => {
      console.error('GCS Upload Error:', err);
      reject(err);
    });

    blobStream.on('finish', async () => {
      await blob.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.end(fileBuffer);
  });
};

const deleteFromGCS = async (fileUrl) => {
  if (!bucket) {
    throw new Error('Google Cloud Storage is not configured');
  }

  try {
    const urlParts = fileUrl.split(`${bucket.name}/`);
    if (urlParts.length < 2) {
      throw new Error('Invalid GCS URL');
    }

    const filename = urlParts[1];
    await bucket.file(filename).delete();
    console.log(`✅ Deleted file: ${filename}`);
    return true;
  } catch (error) {
    console.error('Error deleting file from GCS:', error.message);
    return false;
  }
};

module.exports = {
  storage,
  bucket,
  uploadToGCS,
  deleteFromGCS,
};