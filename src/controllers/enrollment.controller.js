const Enrollment = require('../models/Enrollment');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');

// @desc    Get all enrollments
// @route   GET /api/enrollments
// @access  Private
exports.getEnrollments = async (req, res) => {
  try {
    const { studentId, courseId, status } = req.query;
    
    let query = {};
    
    // Filter by admin's enrollments only
    if (req.user.role === 'admin') {
      query.enrolledBy = req.user._id;
    }
    
    if (studentId) query.student = studentId;
    if (courseId) query.course = courseId;
    if (status) query.status = status;

    const enrollments = await Enrollment.find(query)
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'firstName lastName email avatar' }
      })
      .populate('course', 'name thumbnail category')
      .sort({ enrollDate: -1 });

    res.status(200).json({
      success: true,
      count: enrollments.length,
      data: enrollments,
    });
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener inscripciones',
    });
  }
};

// @desc    Get single enrollment
// @route   GET /api/enrollments/:id
// @access  Private
exports.getEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate({
        path: 'student',
        populate: { path: 'user' }
      })
      .populate('course')
      .populate('completedLessons.lesson')
      .populate('lastAccessedLesson');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Inscripción no encontrada',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        enrollment.enrolledBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver esta inscripción',
      });
    }

    res.status(200).json({
      success: true,
      data: enrollment,
    });
  } catch (error) {
    console.error('Get enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener inscripción',
    });
  }
};

// @desc    Create new enrollment (enroll student in course)
// @route   POST /api/enrollments
// @access  Private (Admin)
exports.createEnrollment = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    // Verify student exists
    const student = await Student.findById(studentId).populate('user');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado',
      });
    }

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado',
      });
    }

    // Check if student is already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId,
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'El estudiante ya está inscrito en este curso',
      });
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      student: studentId,
      course: courseId,
      enrolledBy: req.user._id,
    });

    // Add course to student's enrolledCourses
    if (!student.enrolledCourses.includes(courseId)) {
      student.enrolledCourses.push(courseId);
      await student.save();
    }

    // Update course totalStudents
    await Course.findByIdAndUpdate(courseId, {
      $inc: { totalStudents: 1 }
    });

    const populatedEnrollment = await Enrollment.findById(enrollment._id)
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'firstName lastName email' }
      })
      .populate('course', 'name thumbnail');

    res.status(201).json({
      success: true,
      data: populatedEnrollment,
    });
  } catch (error) {
    console.error('Create enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al inscribir estudiante',
    });
  }
};

// @desc    Update enrollment
// @route   PUT /api/enrollments/:id
// @access  Private (Admin)
exports.updateEnrollment = async (req, res) => {
  try {
    let enrollment = await Enrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Inscripción no encontrada',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        enrollment.enrolledBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar esta inscripción',
      });
    }

    enrollment = await Enrollment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('student').populate('course');

    res.status(200).json({
      success: true,
      data: enrollment,
    });
  } catch (error) {
    console.error('Update enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar inscripción',
    });
  }
};

// @desc    Delete enrollment (unenroll student)
// @route   DELETE /api/enrollments/:id
// @access  Private (Admin)
exports.deleteEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Inscripción no encontrada',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        enrollment.enrolledBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar esta inscripción',
      });
    }

    // Remove course from student's enrolledCourses
    await Student.findByIdAndUpdate(enrollment.student, {
      $pull: { enrolledCourses: enrollment.course }
    });

    // Update course totalStudents
    await Course.findByIdAndUpdate(enrollment.course, {
      $inc: { totalStudents: -1 }
    });

    await enrollment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Inscripción eliminada exitosamente',
    });
  } catch (error) {
    console.error('Delete enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar inscripción',
    });
  }
};

// @desc    Mark lesson as completed
// @route   POST /api/enrollments/:id/complete-lesson
// @access  Private (Student)
exports.completeLesson = async (req, res) => {
  try {
    const { lessonId, watchTime } = req.body;

    const enrollment = await Enrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Inscripción no encontrada',
      });
    }

    // Verify lesson exists
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lección no encontrada',
      });
    }

    // Mark lesson as completed
    await enrollment.markLessonComplete(lessonId, watchTime || 0);

    const updatedEnrollment = await Enrollment.findById(enrollment._id)
      .populate('completedLessons.lesson')
      .populate('lastAccessedLesson');

    res.status(200).json({
      success: true,
      data: updatedEnrollment,
    });
  } catch (error) {
    console.error('Complete lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar lección como completada',
    });
  }
};

// @desc    Get enrollment by student and course
// @route   GET /api/enrollments/student/:studentId/course/:courseId
// @access  Private
exports.getEnrollmentByStudentAndCourse = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId,
    })
      .populate({
        path: 'student',
        populate: { path: 'user' }
      })
      .populate('course')
      .populate('completedLessons.lesson')
      .populate('lastAccessedLesson');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró inscripción para este estudiante en este curso',
      });
    }

    res.status(200).json({
      success: true,
      data: enrollment,
    });
  } catch (error) {
    console.error('Get enrollment by student and course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener inscripción',
    });
  }
};

// @desc    Get student's progress in a course
// @route   GET /api/enrollments/:id/progress
// @access  Private
exports.getProgress = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate('course')
      .populate('completedLessons.lesson');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Inscripción no encontrada',
      });
    }

    // Recalculate progress
    await enrollment.calculateProgress();

    const course = enrollment.course;
    const totalLessons = course.totalLessons;
    const completedLessons = enrollment.completedLessons.length;
    const progress = enrollment.progress;

    const progressData = {
      enrollmentId: enrollment._id,
      courseId: course._id,
      courseName: course.name,
      totalLessons,
      completedLessons,
      progress,
      status: enrollment.status,
      lastAccessDate: enrollment.lastAccessDate,
      completionDate: enrollment.completionDate,
      certificateIssued: enrollment.certificateIssued,
    };

    res.status(200).json({
      success: true,
      data: progressData,
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener progreso',
    });
  }
};