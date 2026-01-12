const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const { startExam, submitExam, getResults, getStudentSubmissions, getStudentHistory, checkExamEligibility, getAllSubmissions } = require('../controllers/examsubmission.controller');

router.use(protect);

// Student routes
router.post('/start', startExam);
router.post('/:id/submit', submitExam);
router.get('/:id/results', getResults);
router.get('/exercise/:exerciseId', getStudentSubmissions);
router.get('/student/history', getStudentHistory);
router.get('/check/:exerciseId', checkExamEligibility);

// Admin routes
router.get('/exercise/:exerciseId/all', authorize('admin'), getAllSubmissions);

module.exports = router;