const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'El título del módulo es requerido'],
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
  isPublished: {
    type: Boolean,
    default: false,
  },
  totalLessons: {
    type: Number,
    default: 0,
  },
  totalDuration: {
    type: Number, // en segundos
    default: 0,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual para lecciones
moduleSchema.virtual('lessons', {
  ref: 'Lesson',
  localField: '_id',
  foreignField: 'module',
});

// Índices
moduleSchema.index({ course: 1, order: 1 });
moduleSchema.index({ isPublished: 1 });

module.exports = mongoose.model('Module', moduleSchema);