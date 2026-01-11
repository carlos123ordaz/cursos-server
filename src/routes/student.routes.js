const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const studentController = require('../controllers/student.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router
  .route('/')
  .get(studentController.getStudents)
  .post(
    authorize('admin'),
    [
      body('firstName').notEmpty().withMessage('El nombre es requerido'),
      body('lastName').notEmpty().withMessage('El apellido es requerido'),
      body('email').isEmail().withMessage('Email inválido'),
      body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
      body('documentType').isIn(['DNI', 'CE', 'PASAPORTE']).withMessage('Tipo de documento inválido'),
      body('documentNumber').notEmpty().withMessage('El número de documento es requerido'),
    ],
    studentController.createStudent
  );

router
  .route('/:id')
  .get(studentController.getStudent)
  .put(authorize('admin'), studentController.updateStudent)
  .delete(authorize('admin'), studentController.deleteStudent);

router
  .route('/:id/courses')
  .get(studentController.getStudentCourses);

router
  .route('/:id/progress')
  .get(studentController.getStudentProgress);

module.exports = router;