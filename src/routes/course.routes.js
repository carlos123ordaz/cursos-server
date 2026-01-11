const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const courseController = require('../controllers/course.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle, handleMulterError } = require('../middleware/upload');

// All routes require authentication
router.use(protect);

router
  .route('/')
  .get(courseController.getCourses)
  .post(
    authorize('admin'),
    [
      body('name').notEmpty().withMessage('El nombre del curso es requerido'),
      body('tutor').notEmpty().withMessage('El tutor es requerido'),
      body('category').notEmpty().withMessage('La categoría es requerida'),
    ],
    courseController.createCourse
  );

router
  .route('/:id')
  .get(courseController.getCourse)
  .put(authorize('admin'), courseController.updateCourse)
  .delete(authorize('admin'), courseController.deleteCourse);

router
  .route('/:id/thumbnail')
  .post(
    authorize('admin'),
    uploadSingle('thumbnail'),
    handleMulterError,
    courseController.uploadThumbnail
  );

router
  .route('/:id/modules')
  .get(courseController.getCourseModules);

module.exports = router;