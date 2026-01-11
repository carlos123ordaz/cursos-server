const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const moduleController = require('../controllers/module.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router
  .route('/')
  .get(moduleController.getModules)
  .post(
    authorize('admin'),
    [
      body('course').notEmpty().withMessage('El curso es requerido'),
      body('title').notEmpty().withMessage('El título es requerido'),
    ],
    moduleController.createModule
  );

router
  .route('/reorder')
  .put(authorize('admin'), moduleController.reorderModules);

router
  .route('/:id')
  .get(moduleController.getModule)
  .put(authorize('admin'), moduleController.updateModule)
  .delete(authorize('admin'), moduleController.deleteModule);

module.exports = router;