const User = require('../models/User');
const Tutor = require('../models/Tutor');
const Student = require('../models/Student');

// @desc    Get all users (created by current admin)
// @route   GET /api/users
// @access  Private (Admin)
exports.getUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    
    let query = { createdBy: req.user._id };
    
    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin)
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Check ownership
    if (user.createdBy && user.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este usuario',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario',
    });
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin)
exports.createUser = async (req, res) => {
  try {
    const { email, documentNumber } = req.body;

    // Check if email exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado',
      });
    }

    // Check if document exists
    const existingDoc = await User.findOne({ documentNumber });
    if (existingDoc) {
      return res.status(400).json({
        success: false,
        message: 'El número de documento ya está registrado',
      });
    }

    // Set createdBy
    req.body.createdBy = req.user._id;

    const user = await User.create(req.body);

    // Create associated profile based on role
    if (user.role === 'tutor') {
      await Tutor.create({
        user: user._id,
        specialty: req.body.specialty || 'Otros',
        bio: req.body.bio || '',
      });
    } else if (user.role === 'student') {
      await Student.create({
        user: user._id,
      });
    }

    // Remove password from response
    user.password = undefined;

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin)
exports.updateUser = async (req, res) => {
  try {
    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Check ownership
    if (user.createdBy && user.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar este usuario',
      });
    }

    // Don't allow password update through this endpoint
    delete req.body.password;
    delete req.body.role; // Don't allow role change

    user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Check ownership
    if (user.createdBy && user.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este usuario',
      });
    }

    // Delete associated profiles
    if (user.role === 'tutor') {
      await Tutor.findOneAndDelete({ user: user._id });
    } else if (user.role === 'student') {
      await Student.findOneAndDelete({ user: user._id });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Usuario eliminado exitosamente',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario',
    });
  }
};