const axios = require('axios');

const bunnyClient = axios.create({
  baseURL: 'https://video.bunnycdn.com',
  headers: {
    'AccessKey': process.env.BUNNY_API_KEY,
    'Content-Type': 'application/json',
  },
});

/**
 * Get video info from Bunny.net
 * @param {string} videoId - Bunny video ID (GUID)
 * @returns {Promise<object>}
 */
const getVideoInfo = async (videoId) => {
  try {
    const response = await bunnyClient.get(
      `/library/${process.env.BUNNY_LIBRARY_ID}/videos/${videoId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error getting video info from Bunny:', error.message);
    throw error;
  }
};

/**
 * Create video in Bunny.net library
 * @param {string} title - Video title
 * @returns {Promise<object>} - Video object with videoId
 */
const createVideo = async (title) => {
  try {
    const response = await bunnyClient.post(
      `/library/${process.env.BUNNY_LIBRARY_ID}/videos`,
      { title }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating video in Bunny:', error.message);
    throw error;
  }
};

/**
 * Upload video file to Bunny.net
 * @param {string} videoId - Bunny video ID
 * @param {Buffer} fileBuffer - Video file buffer
 * @returns {Promise<boolean>}
 */
const uploadVideo = async (videoId, fileBuffer) => {
  try {
    const uploadUrl = `https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/videos/${videoId}`;
    
    await axios.put(uploadUrl, fileBuffer, {
      headers: {
        'AccessKey': process.env.BUNNY_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return true;
  } catch (error) {
    console.error('Error uploading video to Bunny:', error.message);
    throw error;
  }
};

/**
 * Delete video from Bunny.net
 * @param {string} videoId - Bunny video ID
 * @returns {Promise<boolean>}
 */
const deleteVideo = async (videoId) => {
  try {
    await bunnyClient.delete(
      `/library/${process.env.BUNNY_LIBRARY_ID}/videos/${videoId}`
    );
    return true;
  } catch (error) {
    console.error('Error deleting video from Bunny:', error.message);
    return false;
  }
};

/**
 * Get video embed URL
 * @param {string} videoId - Bunny video ID
 * @returns {string}
 */
const getEmbedUrl = (videoId) => {
  return `https://iframe.mediadelivery.net/play/${process.env.BUNNY_LIBRARY_ID}/${videoId}`;
};

/**
 * Get video HLS playlist URL
 * @param {string} videoId - Bunny video ID
 * @returns {string}
 */
const getHlsUrl = (videoId) => {
  return `https://${process.env.BUNNY_CDN_HOSTNAME}/${videoId}/playlist.m3u8`;
};

/**
 * Get video thumbnail URL
 * @param {string} videoId - Bunny video ID
 * @returns {string}
 */
const getThumbnailUrl = (videoId) => {
  return `https://${process.env.BUNNY_CDN_HOSTNAME}/${videoId}/thumbnail.jpg`;
};

module.exports = {
  bunnyClient,
  getVideoInfo,
  createVideo,
  uploadVideo,
  deleteVideo,
  getEmbedUrl,
  getHlsUrl,
  getThumbnailUrl,
};