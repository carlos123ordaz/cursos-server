const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, 'El apellido es requerido'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false,
  },
  role: {
    type: String,
    enum: ['admin', 'tutor', 'student'],
    default: 'admin',
  },
  documentType: {
    type: String,
    enum: ['DNI', 'CE', 'PASAPORTE'],
    required: true,
  },
  documentNumber: {
    type: String,
    required: [true, 'El número de documento es requerido'],
    unique: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['Activo', 'Inactivo'],
    default: 'Activo',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null = cuenta creada por sistema
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual para nombre completo
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Encriptar contraseña antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Índices
userSchema.index({ email: 1 });
userSchema.index({ documentNumber: 1 });
userSchema.index({ role: 1, status: 1 });

module.exports = mongoose.model('User', userSchema);