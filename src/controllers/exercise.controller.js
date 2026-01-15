const Exercise = require('../models/Exercise');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const ExamSubmission = require('../models/ExamSubmission');
const { uploadToGCS, deleteFromGCS } = require('../config/googleStorage');

// @desc    Get all exercises
// @route   GET /api/exercises
// @access  Private
exports.getExercises = async (req, res) => {
  try {
    const { courseId, lessonId, type, status } = req.query;
    
    let query = {};
    
    // Filter by admin's exercises only
    if (req.user.role === 'admin') {
      query.createdBy = req.user._id;
    }
    
    if (courseId) query.course = courseId;
    if (lessonId) query.lesson = lessonId;
    if (type) query.type = type;
    if (status) query.status = status;

    const exercises = await Exercise.find(query)
      .populate('course', 'name')
      .populate('lesson', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: exercises.length,
      data: exercises,
    });
  } catch (error) {
    console.error('Get exercises error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ejercicios',
    });
  }
};

// @desc    Get single exercise
// @route   GET /api/exercises/:id
// @access  Private
exports.getExercise = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar que el ID sea válido
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({
        success: false,
        message: 'ID de ejercicio inválido',
      });
    }

    // Validar formato de ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de ID inválido',
      });
    }

    const exercise = await Exercise.findById(id)
      .populate('course')
      .populate('lesson');

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado',
      });
    }

    res.status(200).json({
      success: true,
      data: exercise,
    });
  } catch (error) {
    console.error('Get exercise error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ejercicio',
    });
  }
};

// @desc    Create new exercise
// @route   POST /api/exercises
// @access  Private (Admin)
exports.createExercise = async (req, res) => {
  try {
    req.body.createdBy = req.user._id;

    // Verificar que el curso existe
    const course = await Course.findById(req.body.course);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado',
      });
    }

    // Si es de tipo lesson, verificar que la lección existe
    if (req.body.type === 'lesson' && req.body.lesson) {
      const lesson = await Lesson.findById(req.body.lesson);
      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: 'Lección no encontrada',
        });
      }
    }

    // Crear el ejercicio
    const exercise = await Exercise.create(req.body);

    // Log para debug
    console.log('Exercise created with ID:', exercise._id);

    // Populate el ejercicio creado
    const populatedExercise = await Exercise.findById(exercise._id)
      .populate('course', 'name')
      .populate('lesson', 'title');

    // Asegurar que el _id está presente en la respuesta
    const responseData = populatedExercise.toObject();
    
    // Log para debug
    console.log('Response data:', {
      _id: responseData._id,
      title: responseData.title,
      type: responseData.type,
    });

    res.status(201).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Create exercise error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear ejercicio',
    });
  }
};

// @desc    Update exercise
// @route   PUT /api/exercises/:id
// @access  Private (Admin)
exports.updateExercise = async (req, res) => {
  try {
    let exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        exercise.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar este ejercicio',
      });
    }

    exercise = await Exercise.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('course').populate('lesson');

    res.status(200).json({
      success: true,
      data: exercise,
    });
  } catch (error) {
    console.error('Update exercise error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar ejercicio',
    });
  }
};

// @desc    Delete exercise
// @route   DELETE /api/exercises/:id
// @access  Private (Admin)
exports.deleteExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        exercise.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este ejercicio',
      });
    }

    // Delete question images from GCS
    for (const question of exercise.questions) {
      if (question.questionImage) {
        await deleteFromGCS(question.questionImage);
      }
    }

    // Delete all submissions
    await ExamSubmission.deleteMany({ exercise: exercise._id });

    await exercise.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Ejercicio eliminado exitosamente',
    });
  } catch (error) {
    console.error('Delete exercise error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar ejercicio',
    });
  }
};

// @desc    Add question to exercise
// @route   POST /api/exercises/:id/questions
// @access  Private (Admin)
exports.addQuestion = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        exercise.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso',
      });
    }

    const { questionText, options, points, explanation, questionImage } = req.body;

    const question = {
      questionText,
      questionImage: questionImage || null,
      options,
      points: points || 1,
      explanation: explanation || '',
      order: exercise.questions.length,
    };

    exercise.questions.push(question);
    await exercise.save();

    res.status(200).json({
      success: true,
      data: exercise.questions,
    });
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar pregunta',
    });
  }
};

// @desc    Update question
// @route   PUT /api/exercises/:id/questions/:questionId
// @access  Private (Admin)
exports.updateQuestion = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado',
      });
    }

    const question = exercise.questions.id(req.params.questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Pregunta no encontrada',
      });
    }

    // Update question fields
    Object.assign(question, req.body);
    await exercise.save();

    res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar pregunta',
    });
  }
};

// @desc    Delete question
// @route   DELETE /api/exercises/:id/questions/:questionId
// @access  Private (Admin)
exports.deleteQuestion = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado',
      });
    }

    const question = exercise.questions.id(req.params.questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Pregunta no encontrada',
      });
    }

    // Delete question image if exists
    if (question.questionImage) {
      await deleteFromGCS(question.questionImage);
    }

    exercise.questions.pull(req.params.questionId);
    await exercise.save();

    res.status(200).json({
      success: true,
      message: 'Pregunta eliminada exitosamente',
    });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar pregunta',
    });
  }
};

// @desc    Upload question image
// @route   POST /api/exercises/:id/questions/:questionId/image
// @access  Private (Admin)
exports.uploadQuestionImage = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado',
      });
    }

    const question = exercise.questions.id(req.params.questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Pregunta no encontrada',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Por favor sube una imagen',
      });
    }

    // Delete old image if exists
    if (question.questionImage) {
      await deleteFromGCS(question.questionImage);
    }

    // Upload new image
    const url = await uploadToGCS(
      req.file.buffer,
      req.file.originalname,
      'exercises/questions',
      req.file.mimetype
    );

    question.questionImage = url;
    await exercise.save();

    res.status(200).json({
      success: true,
      data: { imageUrl: url },
    });
  } catch (error) {
    console.error('Upload question image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir imagen',
    });
  }
};

// @desc    Get exercises by lesson (for students)
// @route   GET /api/exercises/lesson/:lessonId
// @access  Private (Student)
exports.getExercisesByLesson = async (req, res) => {
  try {
    console.log(req.params.lessonId)
    const exercises = await Exercise.find({
      lesson: req.params.lessonId,
      type: 'lesson',
      status: 'Activo',
    }).select('-questions.options.isCorrect'); // No enviar respuestas correctas
    console.log('ejercicios: ',exercises)
    res.status(200).json({
      success: true,
      count: exercises.length,
      data: exercises,
    });
  } catch (error) {
    console.error('Get exercises by lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ejercicios',
    });
  }
};

// @desc    Get available general exams (for students)
// @route   GET /api/exercises/available
// @access  Private (Student)
exports.getAvailableExams = async (req, res) => {
  try {
    const { courseId } = req.query;
    
    const query = {
      type: 'general',
      status: 'Activo',
    };

    if (courseId) {
      query.course = courseId;
    }

    const exercises = await Exercise.find(query)
      .populate('course', 'name')
      .select('-questions'); // No enviar preguntas aún

    // Filter by availability
    const availableExercises = exercises.filter(ex => ex.isAvailable());

    res.status(200).json({
      success: true,
      count: availableExercises.length,
      data: availableExercises,
    });
  } catch (error) {
    console.error('Get available exams error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener exámenes',
    });
  }
};