const express = require('express');
const router = express.Router();
const {
  getExercises,
  getExercise,
  createExercise,
  updateExercise,
  deleteExercise,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  uploadQuestionImage,
  getExercisesByLesson,
  getAvailableExams,
} = require('../controllers/exercise.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');


// Todas las rutas requieren autenticación
router.use(protect);

// IMPORTANTE: Rutas específicas ANTES de rutas con parámetros
// Rutas públicas (estudiantes) - DEBEN IR PRIMERO
router.get('/available', getAvailableExams);
router.get('/lesson/:lessonId', getExercisesByLesson);

// Rutas de administración - colección
router.route('/')
  .get(getExercises)
  .post(authorize('admin'), createExercise);

// Gestión de preguntas - DEBEN IR ANTES de /:id
router.post('/:id/questions', authorize('admin'), addQuestion);
router.put('/:id/questions/:questionId', authorize('admin'), updateQuestion);
router.delete('/:id/questions/:questionId', authorize('admin'), deleteQuestion);
router.post(
  '/:id/questions/:questionId/image',
  authorize('admin'),
  uploadSingle,
  uploadQuestionImage
);

// Rutas con :id - DEBEN IR AL FINAL
router.route('/:id')
  .get(getExercise)
  .put(authorize('admin'), updateExercise)
  .delete(authorize('admin'), deleteExercise);

module.exports = router;