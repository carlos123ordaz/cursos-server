const multer = require('multer');

// Configuración de almacenamiento en memoria
const storage = multer.memoryStorage();

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  // Tipos de archivo permitidos
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
    archive: ['application/zip', 'application/x-rar-compressed'],
  };

  const allAllowedTypes = [
    ...allowedTypes.image,
    ...allowedTypes.document,
    ...allowedTypes.video,
    ...allowedTypes.archive,
  ];

  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

// Configuración de multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

// Middlewares específicos
exports.uploadSingle = (fieldName) => upload.single(fieldName);
exports.uploadMultiple = (fieldName, maxCount = 10) => upload.array(fieldName, maxCount);
exports.uploadFields = (fields) => upload.fields(fields);

// Manejo de errores de multer
exports.handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo excede el tamaño máximo permitido (500MB)',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Error al subir archivo: ${err.message}`,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};