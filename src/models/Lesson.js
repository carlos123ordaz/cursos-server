const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'El título de la lección es requerido'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  order: {
    type: Number,
    required: true,
    default: 0,
  },
  // Video de Bunny.net
  videoProvider: {
    type: String,
    enum: ['bunny', 'youtube', 'vimeo', 'direct'],
    default: 'bunny',
  },
  videoId: {
    type: String, // Bunny.net video GUID
    default: null,
  },
  videoUrl: {
    type: String,
    default: null,
  },
  duration: {
    type: Number, // en segundos
    default: 0,
  },
  durationFormatted: {
    type: String, // "12:30" formato MM:SS
    default: '00:00',
  },
  // Tutor de la lección (puede ser diferente al del curso)
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    default: null,
  },
  // Recursos adjuntos (PDFs, archivos)
  resources: [{
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['pdf', 'doc', 'zip', 'link', 'other'],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    size: {
      type: String, // "2.5 MB"
      default: '',
    },
  }],
  isPublished: {
    type: Boolean,
    default: false,
  },
  isFree: {
    type: Boolean,
    default: false, // Algunas lecciones pueden ser gratuitas como preview
  },
}, {
  timestamps: true,
});

// Calcular duración formateada
lessonSchema.methods.formatDuration = function() {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  this.durationFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return this.durationFormatted;
};

// Pre-save: formatear duración
lessonSchema.pre('save', function(next) {
  if (this.isModified('duration')) {
    this.formatDuration();
  }
  next();
});

// Índices
lessonSchema.index({ module: 1, order: 1 });
lessonSchema.index({ course: 1 });
lessonSchema.index({ isPublished: 1 });
lessonSchema.index({ videoId: 1 });

module.exports = mongoose.model('Lesson', lessonSchema);