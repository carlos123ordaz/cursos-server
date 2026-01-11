const Lesson = require('../models/Lesson');
const Module = require('../models/Module');
const Course = require('../models/Course');
const { uploadToGCS, deleteFromGCS } = require('../config/googleStorage');
const { createVideo, uploadVideo, deleteVideo, getEmbedUrl, getHlsUrl, getThumbnailUrl } = require('../config/bunny');

// @desc    Get all lessons
// @route   GET /api/lessons
// @access  Private
exports.getLessons = async (req, res) => {
  try {
    const { moduleId, courseId } = req.query;
    
    let query = {};
    if (moduleId) query.module = moduleId;
    if (courseId) query.course = courseId;

    const lessons = await Lesson.find(query)
      .populate('module', 'title')
      .populate('tutor')
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      count: lessons.length,
      data: lessons,
    });
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener lecciones',
    });
  }
};

// @desc    Get single lesson
// @route   GET /api/lessons/:id
// @access  Private
exports.getLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id)
      .populate('module')
      .populate('course')
      .populate('tutor');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lección no encontrada',
      });
    }

    res.status(200).json({
      success: true,
      data: lesson,
    });
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener lección',
    });
  }
};

// @desc    Create new lesson
// @route   POST /api/lessons
// @access  Private (Admin)
exports.createLesson = async (req, res) => {
  try {
    const { module: moduleId, course: courseId } = req.body;

    // Verify module and course exist
    const module = await Module.findById(moduleId).populate('course');
    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Módulo no encontrado',
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para agregar lecciones a este curso',
      });
    }

    // Set order if not provided
    if (!req.body.order) {
      const lastLesson = await Lesson.findOne({ module: moduleId })
        .sort({ order: -1 });
      req.body.order = lastLesson ? lastLesson.order + 1 : 0;
    }

    const lesson = await Lesson.create(req.body);

    // Update module and course totals
    await updateModuleAndCourseTotals(moduleId, courseId);

    const populatedLesson = await Lesson.findById(lesson._id)
      .populate('module')
      .populate('tutor');

    res.status(201).json({
      success: true,
      data: populatedLesson,
    });
  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear lección',
    });
  }
};

// @desc    Update lesson
// @route   PUT /api/lessons/:id
// @access  Private (Admin)
exports.updateLesson = async (req, res) => {
  try {
    let lesson = await Lesson.findById(req.params.id).populate('course');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lección no encontrada',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        lesson.course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar esta lección',
      });
    }

    lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('module').populate('tutor');

    // Update totals
    await updateModuleAndCourseTotals(lesson.module._id, lesson.course);

    res.status(200).json({
      success: true,
      data: lesson,
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar lección',
    });
  }
};

// @desc    Delete lesson
// @route   DELETE /api/lessons/:id
// @access  Private (Admin)
exports.deleteLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate('course');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lección no encontrada',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        lesson.course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar esta lección',
      });
    }

    // Delete video from Bunny.net if exists
    if (lesson.videoId) {
      await deleteVideo(lesson.videoId);
    }

    // Delete resources from GCS
    for (const resource of lesson.resources) {
      await deleteFromGCS(resource.url);
    }

    const moduleId = lesson.module;
    const courseId = lesson.course._id;

    await lesson.deleteOne();

    // Update totals
    await updateModuleAndCourseTotals(moduleId, courseId);

    res.status(200).json({
      success: true,
      message: 'Lección eliminada exitosamente',
    });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar lección',
    });
  }
};

// @desc    Upload video to Bunny.net
// @route   POST /api/lessons/:id/video
// @access  Private (Admin)
exports.uploadVideo = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate('course');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lección no encontrada',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        lesson.course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Por favor sube un video',
      });
    }

    // Delete old video if exists
    if (lesson.videoId) {
      await deleteVideo(lesson.videoId);
    }

    // Create video in Bunny.net
    const videoTitle = `${lesson.course.name} - ${lesson.title}`;
    const bunnyVideo = await createVideo(videoTitle);

    // Upload video file
    await uploadVideo(bunnyVideo.guid, req.file.buffer);

    // Update lesson with video info
    lesson.videoProvider = 'bunny';
    lesson.videoId = bunnyVideo.guid;
    lesson.videoUrl = getEmbedUrl(bunnyVideo.guid);
    await lesson.save();

    res.status(200).json({
      success: true,
      data: {
        videoId: bunnyVideo.guid,
        embedUrl: getEmbedUrl(bunnyVideo.guid),
        hlsUrl: getHlsUrl(bunnyVideo.guid),
        thumbnailUrl: getThumbnailUrl(bunnyVideo.guid),
      },
    });
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir video',
    });
  }
};

// @desc    Add resource to lesson
// @route   POST /api/lessons/:id/resources
// @access  Private (Admin)
exports.addResource = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate('course');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lección no encontrada',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        lesson.course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Por favor sube un archivo',
      });
    }

    const { name, type } = req.body;

    // Upload to GCS
    const url = await uploadToGCS(
      req.file.buffer,
      req.file.originalname,
      'lessons/resources',
      req.file.mimetype
    );

    // Calculate file size
    const sizeInMB = (req.file.size / (1024 * 1024)).toFixed(2);

    const resource = {
      name: name || req.file.originalname,
      type: type || 'pdf',
      url,
      size: `${sizeInMB} MB`,
    };

    lesson.resources.push(resource);
    await lesson.save();

    res.status(200).json({
      success: true,
      data: lesson.resources,
    });
  } catch (error) {
    console.error('Add resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar recurso',
    });
  }
};

// @desc    Delete resource from lesson
// @route   DELETE /api/lessons/:id/resources/:resourceId
// @access  Private (Admin)
exports.deleteResource = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate('course');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lección no encontrada',
      });
    }

    // Check ownership
    if (req.user.role === 'admin' && 
        lesson.course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso',
      });
    }

    const resource = lesson.resources.id(req.params.resourceId);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Recurso no encontrado',
      });
    }

    // Delete from GCS
    await deleteFromGCS(resource.url);

    // Remove from array
    lesson.resources.pull(req.params.resourceId);
    await lesson.save();

    res.status(200).json({
      success: true,
      message: 'Recurso eliminado exitosamente',
    });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar recurso',
    });
  }
};

// Helper function to update module and course totals
async function updateModuleAndCourseTotals(moduleId, courseId) {
  const lessons = await Lesson.find({ module: moduleId });
  const totalLessons = lessons.length;
  const totalDuration = lessons.reduce((sum, lesson) => sum + lesson.duration, 0);

  // Update module
  await Module.findByIdAndUpdate(moduleId, {
    totalLessons,
    totalDuration,
  });

  // Update course
  const allLessons = await Lesson.find({ course: courseId });
  const courseTotalLessons = allLessons.length;
  const courseTotalDuration = allLessons.reduce((sum, l) => sum + l.duration, 0);

  await Course.findByIdAndUpdate(courseId, {
    totalLessons: courseTotalLessons,
    totalDuration: courseTotalDuration,
  });
}