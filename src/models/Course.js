const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del curso es requerido'],
    trim: true,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
  },
  description: {
    type: String,
    default: '',
  },
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: [true, 'El tutor es requerido'],
  },
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: [
      '3D y Animación',
      'Diseño Web y App',
      'Ilustración',
      'Fotografía',
      'Marketing',
      'Programación',
      'Matemáticas',
      'Razonamiento Verbal',
      'Otros',
    ],
  },
  thumbnail: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['Activo', 'Borrador', 'Archivado'],
    default: 'Borrador',
  },
  targetAudience: {
    type: String,
    default: '',
  },
  whatYouWillLearn: [{
    type: String,
  }],
  requirements: [{
    type: String,
  }],
  totalStudents: {
    type: Number,
    default: 0,
  },
  totalLessons: {
    type: Number,
    default: 0,
  },
  totalDuration: {
    type: Number, // en segundos
    default: 0,
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 0,
    max: 5,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual para módulos
courseSchema.virtual('modules', {
  ref: 'Module',
  localField: '_id',
  foreignField: 'course',
});

// Generar slug antes de guardar
courseSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Método para formatear duración
courseSchema.methods.getFormattedDuration = function() {
  const hours = Math.floor(this.totalDuration / 3600);
  const minutes = Math.floor((this.totalDuration % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

// Índices
courseSchema.index({ slug: 1 });
courseSchema.index({ tutor: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ createdBy: 1 });
courseSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Course', courseSchema);