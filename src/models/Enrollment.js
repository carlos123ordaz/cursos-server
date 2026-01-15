const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  enrolledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // Admin que inscribió al estudiante
  },
  enrollDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['Activo', 'Completado', 'Suspendido'],
    default: 'Activo',
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  completedLessons: [{
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    watchTime: {
      type: Number, 
      default: 0,
    },
  }],
  lastAccessedLesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    default: null,
  },
  lastAccessDate: {
    type: Date,
    default: Date.now,
  },
  completionDate: {
    type: Date,
    default: null,
  },
  certificateIssued: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Calcular progreso
enrollmentSchema.methods.calculateProgress = async function() {
  const Course = mongoose.model('Course');
  const course = await Course.findById(this.course);
  
  if (!course || course.totalLessons === 0) {
    this.progress = 0;
    return this.progress;
  }

  this.progress = Math.round((this.completedLessons.length / course.totalLessons) * 100);
  
  // Si completó el 100%, marcar como completado
  if (this.progress === 100 && this.status !== 'Completado') {
    this.status = 'Completado';
    this.completionDate = Date.now();
  }
  
  await this.save();
  return this.progress;
};

// Marcar lección como completada
enrollmentSchema.methods.markLessonComplete = async function(lessonId, watchTime = 0) {
  // Verificar si ya está completada
  const alreadyCompleted = this.completedLessons.some(
    cl => cl.lesson.toString() === lessonId.toString()
  );

  if (!alreadyCompleted) {
    this.completedLessons.push({
      lesson: lessonId,
      completedAt: Date.now(),
      watchTime,
    });
    
    this.lastAccessedLesson = lessonId;
    this.lastAccessDate = Date.now();
    
    await this.calculateProgress();
  }
  
  return this;
};

// Índices
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ enrolledBy: 1 });
enrollmentSchema.index({ status: 1 });
enrollmentSchema.index({ progress: 1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);