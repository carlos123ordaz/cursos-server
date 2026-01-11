const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Tutor = require('../models/Tutor');
const { uploadToGCS, deleteFromGCS } = require('../config/googleStorage');

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private
exports.getCourses = async (req, res) => {
  try {
    const { category, status, search } = req.query;
    
    let query = {};
    
    // Filter by admin's courses only
    if (req.user.role === 'admin') {
      query.createdBy = req.user._id;
    }
    
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$text = { $search: search };
    }

    const courses = await Course.find(query)
      .populate({
        path: 'tutor',
        populate: { path: 'user', select: 'firstName lastName avatar' }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cursos',
    });
  }
};

// @desc    Get single course with modules and lessons
// @route   GET /api/courses/:id
// @access  Private
exports.getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate({
        path: 'tutor',
        populate: { path: 'user', select: 'firstName lastName avatar' }
      });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado',
      });
    }

    // Check ownership for admins
    if (req.user.role === 'admin' && 
        course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este curso',
      });
    }

    // Get modules with lessons
    const modules = await Module.find({ course: course._id })
      .sort({ order: 1 });

    const modulesWithLessons = await Promise.all(
      modules.map(async (module) => {
        const lessons = await Lesson.find({ module: module._id })
          .populate('tutor')
          .sort({ order: 1 });
        return {
          ...module.toObject(),
          lessons,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        ...course.toObject(),
        modules: modulesWithLessons,
      },
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener curso',
    });
  }
};

// @desc    Create new course
// @route   POST /api/courses
// @access  Private (Admin)
exports.createCourse = async (req, res) => {
  try {
    req.body.createdBy = req.user._id;

    const course = await Course.create(req.body);

    // Update tutor's totalCourses
    await Tutor.findByIdAndUpdate(req.body.tutor, {
      $inc: { totalCourses: 1 }
    });

    const populatedCourse = await Course.findById(course._id)
      .populate({
        path: 'tutor',
        populate: { path: 'user', select: 'firstName lastName' }
      });

    res.status(201).json({
      success: true,
      data: populatedCourse,
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear curso',
    });
  }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private (Admin)
exports.updateCourse = async (req, res) => {
  try {
    let course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado',
      });
    }

    // Check ownership
    if (course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar este curso',
      });
    }

    course = await Course.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate({
      path: 'tutor',
      populate: { path: 'user' }
    });

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar curso',
    });
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private (Admin)
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado',
      });
    }

    // Check ownership
    if (course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este curso',
      });
    }

    // Delete thumbnail from GCS if exists
    if (course.thumbnail) {
      await deleteFromGCS(course.thumbnail);
    }

    // Delete all modules and lessons
    const modules = await Module.find({ course: course._id });
    for (const module of modules) {
      await Lesson.deleteMany({ module: module._id });
    }
    await Module.deleteMany({ course: course._id });

    await course.deleteOne();

    // Update tutor's totalCourses
    await Tutor.findByIdAndUpdate(course.tutor, {
      $inc: { totalCourses: -1 }
    });

    res.status(200).json({
      success: true,
      message: 'Curso eliminado exitosamente',
    });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar curso',
    });
  }
};

// @desc    Upload course thumbnail
// @route   POST /api/courses/:id/thumbnail
// @access  Private (Admin)
exports.uploadThumbnail = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado',
      });
    }

    // Check ownership
    if (course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Por favor sube una imagen',
      });
    }

    // Delete old thumbnail if exists
    if (course.thumbnail) {
      await deleteFromGCS(course.thumbnail);
    }

    // Upload new thumbnail
    const url = await uploadToGCS(
      req.file.buffer,
      req.file.originalname,
      'courses/thumbnails',
      req.file.mimetype
    );

    course.thumbnail = url;
    await course.save();

    res.status(200).json({
      success: true,
      data: { thumbnail: url },
    });
  } catch (error) {
    console.error('Upload thumbnail error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir imagen',
    });
  }
};

// @desc    Get course modules
// @route   GET /api/courses/:id/modules
// @access  Private
exports.getCourseModules = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado',
      });
    }

    const modules = await Module.find({ course: course._id })
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      count: modules.length,
      data: modules,
    });
  } catch (error) {
    console.error('Get course modules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener módulos',
    });
  }
};