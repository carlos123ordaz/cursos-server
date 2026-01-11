const Tutor = require('../models/Tutor');
const User = require('../models/User');
const Course = require('../models/Course');

// @desc    Get all tutors
// @route   GET /api/tutors
// @access  Private
exports.getTutors = async (req, res) => {
  try {
    const { specialty, status, search } = req.query;
    
    // Build user query
    let userQuery = { role: 'tutor' };
    
    // If admin, only show their created tutors
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

    // Build tutor query
    let tutorQuery = { user: { $in: userIds } };
    if (specialty) tutorQuery.specialty = specialty;

    const tutors = await Tutor.find(tutorQuery)
      .populate('user', '-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tutors.length,
      data: tutors,
    });
  } catch (error) {
    console.error('Get tutors error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tutores',
    });
  }
};

// @desc    Get single tutor
// @route   GET /api/tutors/:id
// @access  Private
exports.getTutor = async (req, res) => {
  try {
    const tutor = await Tutor.findById(req.params.id)
      .populate('user', '-password');

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor no encontrado',
      });
    }

    // Check ownership for admin
    if (req.user.role === 'admin' && 
        tutor.user.createdBy && 
        tutor.user.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este tutor',
      });
    }

    res.status(200).json({
      success: true,
      data: tutor,
    });
  } catch (error) {
    console.error('Get tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tutor',
    });
  }
};

// @desc    Create new tutor
// @route   POST /api/tutors
// @access  Private (Admin)
exports.createTutor = async (req, res) => {
  try {
    const { email, documentNumber, specialty, bio, password, ...userData } = req.body;

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
      role: 'tutor',
      createdBy: req.user._id,
    });

    // Create tutor profile
    const tutor = await Tutor.create({
      user: user._id,
      specialty,
      bio: bio || '',
    });

    const populatedTutor = await Tutor.findById(tutor._id)
      .populate('user', '-password');

    res.status(201).json({
      success: true,
      data: populatedTutor,
    });
  } catch (error) {
    console.error('Create tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear tutor',
    });
  }
};

// @desc    Update tutor
// @route   PUT /api/tutors/:id
// @access  Private (Admin)
exports.updateTutor = async (req, res) => {
  try {
    let tutor = await Tutor.findById(req.params.id).populate('user');

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor no encontrado',
      });
    }

    // Check ownership
    if (tutor.user.createdBy && 
        tutor.user.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar este tutor',
      });
    }

    const { specialty, bio, ...userData } = req.body;

    // Update user data
    if (Object.keys(userData).length > 0) {
      delete userData.password; // Don't allow password update here
      delete userData.role; // Don't allow role change
      
      await User.findByIdAndUpdate(
        tutor.user._id,
        userData,
        { runValidators: true }
      );
    }

    // Update tutor data
    const tutorData = {};
    if (specialty) tutorData.specialty = specialty;
    if (bio !== undefined) tutorData.bio = bio;

    tutor = await Tutor.findByIdAndUpdate(
      req.params.id,
      tutorData,
      { new: true, runValidators: true }
    ).populate('user', '-password');

    res.status(200).json({
      success: true,
      data: tutor,
    });
  } catch (error) {
    console.error('Update tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar tutor',
    });
  }
};

// @desc    Delete tutor
// @route   DELETE /api/tutors/:id
// @access  Private (Admin)
exports.deleteTutor = async (req, res) => {
  try {
    const tutor = await Tutor.findById(req.params.id).populate('user');

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor no encontrado',
      });
    }

    // Check ownership
    if (tutor.user.createdBy && 
        tutor.user.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este tutor',
      });
    }

    // Check if tutor has courses
    const courseCount = await Course.countDocuments({ tutor: tutor._id });
    if (courseCount > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar. El tutor tiene ${courseCount} curso(s) asignado(s)`,
      });
    }

    await tutor.deleteOne();
    await User.findByIdAndDelete(tutor.user._id);

    res.status(200).json({
      success: true,
      message: 'Tutor eliminado exitosamente',
    });
  } catch (error) {
    console.error('Delete tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar tutor',
    });
  }
};

// @desc    Get tutor's courses
// @route   GET /api/tutors/:id/courses
// @access  Private
exports.getTutorCourses = async (req, res) => {
  try {
    const tutor = await Tutor.findById(req.params.id);

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor no encontrado',
      });
    }

    const courses = await Course.find({ tutor: tutor._id })
      .populate('tutor')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error('Get tutor courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cursos del tutor',
    });
  }
};

// @desc    Get tutor statistics
// @route   GET /api/tutors/:id/stats
// @access  Private
exports.getTutorStats = async (req, res) => {
  try {
    const tutor = await Tutor.findById(req.params.id).populate('user', '-password');

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor no encontrado',
      });
    }

    const courses = await Course.find({ tutor: tutor._id });
    const totalStudents = courses.reduce((sum, course) => sum + course.totalStudents, 0);

    const stats = {
      tutor: tutor,
      totalCourses: courses.length,
      totalStudents: totalStudents,
      averageRating: tutor.rating,
      courses: courses,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get tutor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
    });
  }
};