const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const enrollmentController = require('../controllers/enrollment.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router
  .route('/')
  .get(enrollmentController.getEnrollments)
  .post(
    authorize('admin'),
    [
      body('studentId').notEmpty().withMessage('El estudiante es requerido'),
      body('courseId').notEmpty().withMessage('El curso es requerido'),
    ],
    enrollmentController.createEnrollment
  );

router
  .route('/:id')
  .get(enrollmentController.getEnrollment)
  .put( enrollmentController.updateEnrollment)
  .delete(authorize('admin'), enrollmentController.deleteEnrollment);

router
  .route('/:id/complete-lesson')
  .post(
    [
      body('lessonId').notEmpty().withMessage('La lección es requerida'),
    ],
    enrollmentController.completeLesson
  );

router
  .route('/:id/progress')
  .get(enrollmentController.getProgress);

router
  .route('/student/:studentId/course/:courseId')
  .get(enrollmentController.getEnrollmentByStudentAndCourse);

module.exports = router;