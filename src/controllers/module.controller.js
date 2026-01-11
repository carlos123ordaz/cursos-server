const Module = require('../models/Module');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');

exports.getModules = async (req, res) => {
  try {
    const { courseId } = req.query;
    
    let query = {};
    if (courseId) query.course = courseId;

    const modules = await Module.find(query)
      .populate('course', 'name')
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      count: modules.length,
      data: modules,
    });
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener módulos',
    });
  }
};


exports.getModule = async (req, res) => {
  try {
    const module = await Module.findById(req.params.id)
      .populate('course');

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Módulo no encontrado',
      });
    }


    const lessons = await Lesson.find({ module: module._id })
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: {
        ...module.toObject(),
        lessons,
      },
    });
  } catch (error) {
    console.error('Get module error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener módulo',
    });
  }
};

exports.createModule = async (req, res) => {
  try {
    const { course: courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado',
      });
    }

    if (req.user.role === 'admin' && 
        course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para agregar módulos a este curso',
      });
    }

    if (!req.body.order) {
      const lastModule = await Module.findOne({ course: courseId })
        .sort({ order: -1 });
      req.body.order = lastModule ? lastModule.order + 1 : 0;
    }

    const module = await Module.create(req.body);

    res.status(201).json({
      success: true,
      data: module,
    });
  } catch (error) {
    console.error('Create module error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear módulo',
    });
  }
};

exports.updateModule = async (req, res) => {
  try {
    let module = await Module.findById(req.params.id).populate('course');

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Módulo no encontrado',
      });
    }

    if (req.user.role === 'admin' && 
        module.course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar este módulo',
      });
    }

    module = await Module.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('course');

    await updateCourseTotals(module.course._id);

    res.status(200).json({
      success: true,
      data: module,
    });
  } catch (error) {
    console.error('Update module error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar módulo',
    });
  }
};

exports.deleteModule = async (req, res) => {
  try {
    const module = await Module.findById(req.params.id).populate('course');

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Módulo no encontrado',
      });
    }

    if (req.user.role === 'admin' && 
        module.course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este módulo',
      });
    }

    await Lesson.deleteMany({ module: module._id });

    await module.deleteOne();
    await updateCourseTotals(module.course._id);

    res.status(200).json({
      success: true,
      message: 'Módulo eliminado exitosamente',
    });
  } catch (error) {
    console.error('Delete module error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar módulo',
    });
  }
};

exports.reorderModules = async (req, res) => {
  try {
    const { modules } = req.body;

    if (!Array.isArray(modules)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de módulos',
      });
    }

    await Promise.all(
      modules.map(({ id, order }) =>
        Module.findByIdAndUpdate(id, { order })
      )
    );

    res.status(200).json({
      success: true,
      message: 'Orden actualizado exitosamente',
    });
  } catch (error) {
    console.error('Reorder modules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reordenar módulos',
    });
  }
};
async function updateCourseTotals(courseId) {
  const modules = await Module.find({ course: courseId });
  const lessons = await Lesson.find({ course: courseId });

  const totalLessons = lessons.length;
  const totalDuration = lessons.reduce((sum, lesson) => sum + lesson.duration, 0);

  for (const module of modules) {
    const moduleLessons = lessons.filter(
      l => l.module.toString() === module._id.toString()
    );
    module.totalLessons = moduleLessons.length;
    module.totalDuration = moduleLessons.reduce((sum, l) => sum + l.duration, 0);
    await module.save();
  }


  await Course.findByIdAndUpdate(courseId, {
    totalLessons,
    totalDuration,
  });
}