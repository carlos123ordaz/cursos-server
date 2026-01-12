const ExamSubmission = require('../models/ExamSubmission');
const Exercise = require('../models/Exercise');
const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');

// @desc    Start an exam (create submission)
// @route   POST /api/exam-submissions/start
// @access  Private (Student)
exports.startExam = async (req, res) => {
  try {
    const { exerciseId, enrollmentId } = req.body;

    // Verificar que el ejercicio existe
    const exercise = await Exercise.findById(exerciseId);
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado',
      });
    }

    // Verificar disponibilidad
    if (!exercise.isAvailable()) {
      return res.status(400).json({
        success: false,
        message: 'Este examen no está disponible en este momento',
      });
    }

    // Obtener estudiante
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de estudiante no encontrado',
      });
    }

    // Verificar enrollment
    const enrollment = await Enrollment.findById(enrollmentId);
    if (!enrollment || enrollment.student.toString() !== student._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este curso',
      });
    }

    // Para ejercicios de lección, verificar si ya lo hizo (solo 1 intento)
    if (exercise.type === 'lesson') {
      const existingSubmission = await ExamSubmission.findOne({
        exercise: exerciseId,
        student: student._id,
        status: { $in: ['submitted', 'graded'] },
      });

      if (existingSubmission) {
        return res.status(400).json({
          success: false,
          message: 'Ya has completado este ejercicio',
        });
      }
    }

    // Para exámenes generales, verificar si permite reintentos
    if (exercise.type === 'general' && !exercise.allowRetake) {
      const existingSubmission = await ExamSubmission.findOne({
        exercise: exerciseId,
        student: student._id,
        status: { $in: ['submitted', 'graded'] },
      });

      if (existingSubmission) {
        return res.status(400).json({
          success: false,
          message: 'Ya has completado este examen y no se permiten reintentos',
        });
      }
    }

    // Calcular número de intento
    const previousAttempts = await ExamSubmission.countDocuments({
      exercise: exerciseId,
      student: student._id,
    });

    // Crear nueva submission
    const submission = await ExamSubmission.create({
      exercise: exerciseId,
      student: student._id,
      enrollment: enrollmentId,
      attemptNumber: previousAttempts + 1,
      startedAt: new Date(),
      status: 'in_progress',
    });

    // Retornar ejercicio con preguntas (sin respuestas correctas)
    const exerciseWithQuestions = await Exercise.findById(exerciseId)
      .select('-questions.options.isCorrect -questions.explanation');

    res.status(201).json({
      success: true,
      data: {
        submission: submission,
        exercise: exerciseWithQuestions,
      },
    });
  } catch (error) {
    console.error('Start exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar examen',
    });
  }
};

// @desc    Submit exam answers
// @route   POST /api/exam-submissions/:id/submit
// @access  Private (Student)
exports.submitExam = async (req, res) => {
  try {
    const { answers } = req.body; // Array de { questionId, selectedOptionIndex }

    let submission = await ExamSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Envío no encontrado',
      });
    }

    // Verificar que pertenece al estudiante
    const student = await Student.findOne({ user: req.user._id });
    if (submission.student.toString() !== student._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso',
      });
    }

    // Verificar que no se haya enviado ya
    if (submission.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Este examen ya fue enviado',
      });
    }

    // Obtener el ejercicio
    const exercise = await Exercise.findById(submission.exercise);

    // Guardar respuestas
    submission.answers = answers;
    submission.submittedAt = new Date();
    submission.calculateTimeSpent();

    // Calcular calificación
    submission.calculateScore(exercise);
    await submission.save();

    // Populate submission
    await submission.populate('exercise');

    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar examen',
    });
  }
};

// @desc    Get submission results
// @route   GET /api/exam-submissions/:id/results
// @access  Private (Student)
exports.getResults = async (req, res) => {
  try {
    const submission = await ExamSubmission.findById(req.params.id)
      .populate({
        path: 'exercise',
        populate: { path: 'course', select: 'name' }
      });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Envío no encontrado',
      });
    }

    // Verificar que pertenece al estudiante
    const student = await Student.findOne({ user: req.user._id });
    if (submission.student.toString() !== student._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso',
      });
    }

    // Verificar si se muestran resultados
    if (!submission.exercise.showResults && submission.status !== 'graded') {
      return res.status(403).json({
        success: false,
        message: 'Los resultados no están disponibles aún',
      });
    }

    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resultados',
    });
  }
};

// @desc    Get student's submissions for an exercise
// @route   GET /api/exam-submissions/exercise/:exerciseId
// @access  Private (Student)
exports.getStudentSubmissions = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    
    const submissions = await ExamSubmission.find({
      exercise: req.params.exerciseId,
      student: student._id,
    })
    .populate('exercise', 'title type')
    .sort({ attemptNumber: -1 });

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
    });
  } catch (error) {
    console.error('Get student submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener envíos',
    });
  }
};

// @desc    Get all submissions for an exercise (Admin)
// @route   GET /api/exam-submissions/exercise/:exerciseId/all
// @access  Private (Admin)
exports.getAllSubmissions = async (req, res) => {
  try {
    const submissions = await ExamSubmission.find({
      exercise: req.params.exerciseId,
      status: { $in: ['submitted', 'graded'] },
    })
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'firstName lastName email' }
    })
    .sort({ submittedAt: -1 });

    // Calcular estadísticas
    const stats = {
      totalSubmissions: submissions.length,
      averageScore: submissions.length > 0
        ? submissions.reduce((sum, s) => sum + s.percentage, 0) / submissions.length
        : 0,
      passed: submissions.filter(s => s.passed).length,
      failed: submissions.filter(s => !s.passed).length,
    };

    res.status(200).json({
      success: true,
      count: submissions.length,
      stats,
      data: submissions,
    });
  } catch (error) {
    console.error('Get all submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener envíos',
    });
  }
};

// @desc    Get student's exam history
// @route   GET /api/exam-submissions/student/history
// @access  Private (Student)
exports.getStudentHistory = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    
    const submissions = await ExamSubmission.find({
      student: student._id,
      status: { $in: ['submitted', 'graded'] },
    })
    .populate({
      path: 'exercise',
      populate: { path: 'course', select: 'name' }
    })
    .sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
    });
  } catch (error) {
    console.error('Get student history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
    });
  }
};

// @desc    Check if student can take exam
// @route   GET /api/exam-submissions/check/:exerciseId
// @access  Private (Student)
exports.checkExamEligibility = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.exerciseId);
    
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado',
      });
    }

    const student = await Student.findOne({ user: req.user._id });
    
    // Verificar disponibilidad
    const isAvailable = exercise.isAvailable();

    // Verificar intentos previos
    const previousAttempts = await ExamSubmission.find({
      exercise: req.params.exerciseId,
      student: student._id,
      status: { $in: ['submitted', 'graded'] },
    });

    let canTake = true;
    let reason = '';

    if (!isAvailable) {
      canTake = false;
      reason = 'El examen no está disponible en este momento';
    } else if (exercise.type === 'lesson' && previousAttempts.length > 0) {
      canTake = false;
      reason = 'Ya has completado este ejercicio';
    } else if (exercise.type === 'general' && !exercise.allowRetake && previousAttempts.length > 0) {
      canTake = false;
      reason = 'Ya has completado este examen y no se permiten reintentos';
    }

    res.status(200).json({
      success: true,
      data: {
        canTake,
        reason,
        previousAttempts: previousAttempts.length,
        latestScore: previousAttempts.length > 0 ? previousAttempts[0].percentage : null,
      },
    });
  } catch (error) {
    console.error('Check exam eligibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar elegibilidad',
    });
  }
};