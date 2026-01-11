const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Proteger rutas - verificar JWT
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado para acceder a esta ruta',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    if (req.user.status !== 'Activo') {
      return res.status(403).json({
        success: false,
        message: 'Cuenta inactiva',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado',
    });
  }
};

// Autorizar roles específicos
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `El rol ${req.user.role} no tiene permiso para esta acción`,
      });
    }
    next();
  };
};

// Verificar que el recurso pertenece al usuario (para admins)
exports.checkOwnership = (Model, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resource = await Model.findById(req.params[resourceIdParam]);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Recurso no encontrado',
        });
      }

      // Si es admin y el recurso tiene createdBy, verificar que sea suyo
      if (req.user.role === 'admin' && resource.createdBy) {
        if (resource.createdBy.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permiso para acceder a este recurso',
          });
        }
      }

      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
      });
    }
  };
};