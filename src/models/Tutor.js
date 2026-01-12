const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  specialty: {
    type: String,
    required: [true, 'La especialidad es requerida'],
    enum: [
      'Matemáticas',
      'Razonamiento',
      'Comunicación',
      'Ciencias',
      'Ciencias Sociales',
      'Humanidades',
      'Aptitud Académica',
      'Cultura General',
      'Otros'
    ],
  },
  bio: {
    type: String,
    default: '',
    maxlength: [500, 'La biografía no puede exceder 500 caracteres'],
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 0,
    max: 5,
  },
  totalCourses: {
    type: Number,
    default: 0,
  },
  totalStudents: {
    type: Number,
    default: 0,
  },
  joinDate: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual populate courses
tutorSchema.virtual('courses', {
  ref: 'Course',
  localField: '_id',
  foreignField: 'tutor',
});

// Índices
tutorSchema.index({ user: 1 });
tutorSchema.index({ specialty: 1 });
tutorSchema.index({ rating: -1 });

module.exports = mongoose.model('Tutor', tutorSchema);