const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const tutorController = require('../controllers/tutor.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router
  .route('/')
  .get(tutorController.getTutors)
  .post(
    authorize('admin'),
    [
      body('firstName').notEmpty().withMessage('El nombre es requerido'),
      body('lastName').notEmpty().withMessage('El apellido es requerido'),
      body('email').isEmail().withMessage('Email inválido'),
      body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
      body('documentType').isIn(['DNI', 'CE', 'PASAPORTE']).withMessage('Tipo de documento inválido'),
      body('documentNumber').notEmpty().withMessage('El número de documento es requerido'),
      body('specialty').notEmpty().withMessage('La especialidad es requerida'),
    ],
    tutorController.createTutor
  );

router
  .route('/:id')
  .get(tutorController.getTutor)
  .put(authorize('admin'), tutorController.updateTutor)
  .delete(authorize('admin'), tutorController.deleteTutor);

router
  .route('/:id/courses')
  .get(tutorController.getTutorCourses);

router
  .route('/:id/stats')
  .get(tutorController.getTutorStats);

module.exports = router;