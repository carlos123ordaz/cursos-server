const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle, uploadMultiple, handleMulterError } = require('../middleware/upload');

// All routes require authentication
router.use(protect);

// Upload image to Google Cloud Storage
router
  .route('/image')
  .post(
    uploadSingle('image'),
    handleMulterError,
    uploadController.uploadImage
  );

// Upload document to Google Cloud Storage
router
  .route('/document')
  .post(
    uploadSingle('document'),
    handleMulterError,
    uploadController.uploadDocument
  );

// Upload video to Bunny.net (Admin only)
router
  .route('/video')
  .post(
    authorize('admin'),
    uploadSingle('video'),
    handleMulterError,
    uploadController.uploadVideoToBunny
  );

// Upload multiple files
router
  .route('/multiple')
  .post(
    uploadMultiple('files', 10),
    handleMulterError,
    uploadController.uploadMultiple
  );

// Delete file from Google Cloud Storage
router
  .route('/')
  .delete(uploadController.deleteFile);

module.exports = router;