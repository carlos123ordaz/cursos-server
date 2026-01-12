const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  selectedOptionIndex: {
    type: Number,
    required: true,
  },
  isCorrect: {
    type: Boolean,
    default: false,
  },
  pointsEarned: {
    type: Number,
    default: 0,
  },
});

const examSubmissionSchema = new mongoose.Schema({
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  enrollment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enrollment',
    required: true,
  },
  answers: [answerSchema],
  startedAt: {
    type: Date,
    default: Date.now,
  },
  submittedAt: {
    type: Date,
    default: null,
  },
  timeSpent: {
    type: Number, // en segundos
    default: 0,
  },
  score: {
    type: Number, // Puntos obtenidos
    default: 0,
  },
  totalPoints: {
    type: Number, // Puntos totales posibles
    default: 0,
  },
  percentage: {
    type: Number, // Porcentaje
    default: 0,
  },
  passed: {
    type: Boolean,
    default: false,
  },
  attemptNumber: {
    type: Number,
    default: 1,
  },
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'graded'],
    default: 'in_progress',
  },
}, {
  timestamps: true,
});

// Método para calcular la calificación
examSubmissionSchema.methods.calculateScore = function(exercise) {
  let totalScore = 0;
  let totalPossible = 0;

  this.answers.forEach((answer) => {
    const question = exercise.questions.id(answer.questionId);
    if (question) {
      totalPossible += question.points;
      
      const selectedOption = question.options[answer.selectedOptionIndex];
      if (selectedOption && selectedOption.isCorrect) {
        answer.isCorrect = true;
        answer.pointsEarned = question.points;
        totalScore += question.points;
      } else {
        answer.isCorrect = false;
        answer.pointsEarned = 0;
      }
    }
  });

  this.score = totalScore;
  this.totalPoints = totalPossible;
  this.percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
  this.passed = this.percentage >= exercise.passingScore;
  this.status = 'graded';
  
  return this;
};

// Método para calcular tiempo transcurrido
examSubmissionSchema.methods.calculateTimeSpent = function() {
  if (this.submittedAt) {
    this.timeSpent = Math.floor((this.submittedAt - this.startedAt) / 1000);
  }
  return this.timeSpent;
};

// Índices
examSubmissionSchema.index({ exercise: 1, student: 1 });
examSubmissionSchema.index({ enrollment: 1 });
examSubmissionSchema.index({ student: 1, status: 1 });
examSubmissionSchema.index({ submittedAt: -1 });

// Índice único para evitar múltiples envíos si no se permite
examSubmissionSchema.index(
  { exercise: 1, student: 1, attemptNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model('ExamSubmission', examSubmissionSchema);