const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  enrolledCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
  }],
  completedCourses: {
    type: Number,
    default: 0,
  },
  enrollDate: {
    type: Date,
    default: Date.now,
  },
  lastAccess: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual para obtener progreso total
studentSchema.virtual('totalEnrolled').get(function() {
  return this.enrolledCourses.length;
});

// Actualizar lastAccess
studentSchema.methods.updateLastAccess = function() {
  this.lastAccess = Date.now();
  return this.save();
};

// Índices
studentSchema.index({ user: 1 });
studentSchema.index({ enrolledCourses: 1 });
studentSchema.index({ lastAccess: -1 });

module.exports = mongoose.model('Student', studentSchema);