const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true,
  },
  questionImage: {
    type: String, // URL de la imagen (opcional)
    default: null,
  },
  options: [{
    text: {
      type: String,
      required: true,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
  }],
  points: {
    type: Number,
    default: 1,
    min: 0,
  },
  explanation: {
    type: String, // Explicación de la respuesta correcta
    default: '',
  },
  order: {
    type: Number,
    default: 0,
  },
});

const exerciseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'El título es requerido'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    enum: ['general', 'lesson'], // general = examen programado, lesson = ejercicio por lección
    required: true,
    default: 'lesson',
  },
  // Para ejercicios de lección
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    default: null,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  // Para exámenes generales programados
  scheduledDate: {
    type: Date,
    default: null, // Solo para exámenes generales
  },
  startTime: {
    type: Date,
    default: null, // Hora de inicio del examen
  },
  endTime: {
    type: Date,
    default: null, // Hora de fin (disponibilidad)
  },
  duration: {
    type: Number, // Duración en minutos
    default: 60,
  },
  // Preguntas
  questions: [questionSchema],
  // Configuración
  passingScore: {
    type: Number,
    default: 60, // Porcentaje mínimo para aprobar
    min: 0,
    max: 100,
  },
  allowRetake: {
    type: Boolean,
    default: false, // Solo para exámenes generales
  },
  showResults: {
    type: Boolean,
    default: true, // Mostrar resultados inmediatamente
  },
  shuffleQuestions: {
    type: Boolean,
    default: false, // Mezclar preguntas
  },
  shuffleOptions: {
    type: Boolean,
    default: false, // Mezclar opciones
  },
  status: {
    type: String,
    enum: ['Activo', 'Borrador', 'Finalizado'],
    default: 'Activo',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Virtual para calcular puntos totales
exerciseSchema.virtual('totalPoints').get(function() {
  return this.questions.reduce((sum, q) => sum + q.points, 0);
});

// Método para verificar si el examen está disponible
exerciseSchema.methods.isAvailable = function() {
  if (this.type === 'lesson') return true; // Siempre disponible
  
  const now = new Date();
  if (this.startTime && now < this.startTime) return false;
  if (this.endTime && now > this.endTime) return false;
  
  return true;
};

// Método para verificar si el examen ha finalizado
exerciseSchema.methods.hasEnded = function() {
  if (this.type === 'lesson') return false;
  
  const now = new Date();
  return this.endTime && now > this.endTime;
};

// Índices
exerciseSchema.index({ course: 1, type: 1 });
exerciseSchema.index({ lesson: 1 });
exerciseSchema.index({ scheduledDate: 1 });
exerciseSchema.index({ status: 1 });
exerciseSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Exercise', exerciseSchema);