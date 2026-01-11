const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// All routes are admin only
router.use(authorize('admin'));

router
  .route('/')
  .get(userController.getUsers)
  .post(
    [
      body('firstName').notEmpty().withMessage('El nombre es requerido'),
      body('lastName').notEmpty().withMessage('El apellido es requerido'),
      body('email').isEmail().withMessage('Email inválido'),
      body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
      body('documentType').isIn(['DNI', 'CE', 'PASAPORTE']).withMessage('Tipo de documento inválido'),
      body('documentNumber').notEmpty().withMessage('El número de documento es requerido'),
      body('role').isIn(['admin', 'tutor', 'student']).withMessage('Rol inválido'),
    ],
    userController.createUser
  );

router
  .route('/:id')
  .get(userController.getUser)
  .put(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;