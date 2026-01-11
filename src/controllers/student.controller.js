const Student = require('../models/Student');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');

// @desc    Get all students
// @route   GET /api/students
// @access  Private
exports.getStudents = async (req, res) => {
  try {
    const { status, search } = req.query;
    
    // Build user query
    let userQuery = { role: 'student' };
    
    // If admin, only show their created students
    if (req.user.role === 'admin') {
      userQuery.createdBy = req.user._id;
    }
    
    if (status) userQuery.status = status;
    if (search) {
      userQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Find users that match criteria
    const users = await User.find(userQuery).select('-password');
    const userIds = users.map(u => u._id);

    const students = await Student.find({ user: { $in: userIds } })
      .populate('user', '-password')
      .populate('enrolledCourses', 'name thumbnail')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estudiantes',
    });
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user', '-password')
      .populate('enrolledCourses');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado',
      });
    }

    // Check ownership for admin
    if (req.user.role === 'admin' && 
        student.user.createdBy && 
        student.user.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este estudiante',
      });
    }

    res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estudiante',
    });
  }
};

// @desc    Create new student
// @route   POST /api/students
// @access  Private (Admin)
exports.createStudent = async (req, res) => {
  try {
    const { email, documentNumber, password, ...userData } = req.body;

    // Check if email exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado',
      });
    }

    // Check if document exists
    const existingDoc = await User.findOne({ documentNumber });
    if (existingDoc) {
      return res.status(400).json({
        success: false,
        message: 'El número de documento ya está registrado',
      });
    }

    // Create user
    const user = await User.create({
      ...userData,
      email,
      documentNumber,
      password,
      role: 'student',
      createdBy: req.user._id,
    });

    // Create student profile
    const student = await Student.create({
      user: user._id,
    });

    const populatedStudent = await Student.findById(student._id)
      .populate('user', '-password');

    res.status(201).json({
      success: true,
      data: populatedStudent,
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear estudiante',
    });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private (Admin)
exports.updateStudent = async (req, res) => {
  try {
    let student = await Student.findById(req.params.id).populate('user');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado',
      });
    }

    // Check ownership
    if (student.user.createdBy && 
        student.user.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar este estudiante',
      });
    }

    // Update user data
    if (Object.keys(req.body).length > 0) {
      const userData = { ...req.body };
      delete userData.password; // Don't allow password update here
      delete userData.role; // Don't allow role change
      
      await User.findByIdAndUpdate(
        student.user._id,
        userData,
        { runValidators: true }
      );
    }

    student = await Student.findById(req.params.id)
      .populate('user', '-password')
      .populate('enrolledCourses');

    res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estudiante',
    });
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private (Admin)
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('user');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado',
      });
    }

    // Check ownership
    if (student.user.createdBy && 
        student.user.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este estudiante',
      });
    }

    // Delete all enrollments
    await Enrollment.deleteMany({ student: student._id });

    await student.deleteOne();
    await User.findByIdAndDelete(student.user._id);

    res.status(200).json({
      success: true,
      message: 'Estudiante eliminado exitosamente',
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar estudiante',
    });
  }
};

// @desc    Get student's enrolled courses
// @route   GET /api/students/:id/courses
// @access  Private
exports.getStudentCourses = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado',
      });
    }

    const enrollments = await Enrollment.find({ student: student._id })
      .populate({
        path: 'course',
        populate: {
          path: 'tutor',
          populate: { path: 'user', select: 'firstName lastName' }
        }
      })
      .sort({ enrollDate: -1 });

    res.status(200).json({
      success: true,
      count: enrollments.length,
      data: enrollments,
    });
  } catch (error) {
    console.error('Get student courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cursos del estudiante',
    });
  }
};

// @desc    Get student progress
// @route   GET /api/students/:id/progress
// @access  Private
exports.getStudentProgress = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user', '-password');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado',
      });
    }

    const enrollments = await Enrollment.find({ student: student._id })
      .populate('course', 'name thumbnail totalLessons');

    const totalCourses = enrollments.length;
    const completedCourses = enrollments.filter(e => e.status === 'Completado').length;
    const activeCourses = enrollments.filter(e => e.status === 'Activo').length;
    const averageProgress = totalCourses > 0 
      ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / totalCourses)
      : 0;

    const progress = {
      student: student,
      totalCourses,
      activeCourses,
      completedCourses,
      averageProgress,
      enrollments,
    };

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener progreso',
    });
  }
};