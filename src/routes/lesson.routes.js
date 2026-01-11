const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const lessonController = require('../controllers/lesson.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle, handleMulterError } = require('../middleware/upload');

// All routes require authentication
router.use(protect);

router
  .route('/')
  .get(lessonController.getLessons)
  .post(
    authorize('admin'),
    [
      body('module').notEmpty().withMessage('El módulo es requerido'),
      body('course').notEmpty().withMessage('El curso es requerido'),
      body('title').notEmpty().withMessage('El título es requerido'),
    ],
    lessonController.createLesson
  );

router
  .route('/:id')
  .get(lessonController.getLesson)
  .put(authorize('admin'), lessonController.updateLesson)
  .delete(authorize('admin'), lessonController.deleteLesson);

router
  .route('/:id/video')
  .post(
    authorize('admin'),
    uploadSingle('video'),
    handleMulterError,
    lessonController.uploadVideo
  );

router
  .route('/:id/resources')
  .post(
    authorize('admin'),
    uploadSingle('resource'),
    handleMulterError,
    lessonController.addResource
  );

router
  .route('/:id/resources/:resourceId')
  .delete(authorize('admin'), lessonController.deleteResource);

module.exports = router;