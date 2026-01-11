const { uploadToGCS, deleteFromGCS } = require('../config/googleStorage');
const { createVideo, uploadVideo, getEmbedUrl, getHlsUrl, getThumbnailUrl } = require('../config/bunny');

// @desc    Upload image to Google Cloud Storage
// @route   POST /api/upload/image
// @access  Private
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Por favor sube una imagen',
      });
    }

    // Validate image type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG o WebP',
      });
    }

    const { folder = 'general' } = req.body;

    const url = await uploadToGCS(
      req.file.buffer,
      req.file.originalname,
      folder,
      req.file.mimetype
    );

    res.status(200).json({
      success: true,
      data: {
        url,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir imagen',
    });
  }
};

// @desc    Upload document (PDF, DOC, etc) to Google Cloud Storage
// @route   POST /api/upload/document
// @access  Private
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Por favor sube un documento',
      });
    }

    // Validate document type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/x-rar-compressed',
    ];
    
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de archivo no permitido. Solo se aceptan PDF, DOC, DOCX, ZIP, RAR',
      });
    }

    const { folder = 'documents' } = req.body;

    const url = await uploadToGCS(
      req.file.buffer,
      req.file.originalname,
      folder,
      req.file.mimetype
    );

    // Calculate file size in MB
    const sizeInMB = (req.file.size / (1024 * 1024)).toFixed(2);

    res.status(200).json({
      success: true,
      data: {
        url,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: `${sizeInMB} MB`,
      },
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir documento',
    });
  }
};

// @desc    Upload video to Bunny.net
// @route   POST /api/upload/video
// @access  Private (Admin)
exports.uploadVideoToBunny = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Por favor sube un video',
      });
    }

    // Validate video type
    const allowedTypes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
    ];
    
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de archivo no permitido. Solo se aceptan videos MP4, MOV, AVI',
      });
    }

    const { title } = req.body;
    const videoTitle = title || req.file.originalname;

    // Create video in Bunny.net
    const bunnyVideo = await createVideo(videoTitle);

    // Upload video file
    await uploadVideo(bunnyVideo.guid, req.file.buffer);

    res.status(200).json({
      success: true,
      data: {
        videoId: bunnyVideo.guid,
        title: videoTitle,
        embedUrl: getEmbedUrl(bunnyVideo.guid),
        hlsUrl: getHlsUrl(bunnyVideo.guid),
        thumbnailUrl: getThumbnailUrl(bunnyVideo.guid),
        provider: 'bunny',
      },
    });
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir video a Bunny.net',
    });
  }
};

// @desc    Delete file from Google Cloud Storage
// @route   DELETE /api/upload
// @access  Private
exports.deleteFile = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la URL del archivo',
      });
    }

    const deleted = await deleteFromGCS(url);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: 'Error al eliminar archivo',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Archivo eliminado exitosamente',
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar archivo',
    });
  }
};

// @desc    Upload multiple files
// @route   POST /api/upload/multiple
// @access  Private
exports.uploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Por favor sube al menos un archivo',
      });
    }

    const { folder = 'general' } = req.body;
    const uploadedFiles = [];

    for (const file of req.files) {
      const url = await uploadToGCS(
        file.buffer,
        file.originalname,
        folder,
        file.mimetype
      );

      uploadedFiles.push({
        url,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });
    }

    res.status(200).json({
      success: true,
      count: uploadedFiles.length,
      data: uploadedFiles,
    });
  } catch (error) {
    console.error('Upload multiple files error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir archivos',
    });
  }
};