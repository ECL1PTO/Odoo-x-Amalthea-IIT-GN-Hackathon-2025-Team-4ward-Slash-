const express = require('express');
const bcrypt = require('bcrypt');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  createUser,
  getAllUsers,
  updateUserRole,
  assignManager,
  getUserById
} = require('../controllers/userController');

const router = express.Router();

// User Management Routes

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Admin only
 */
router.post('/', authenticateToken, requireAdmin, createUser);

/**
 * @route   GET /api/users
 * @desc    Get all users (filtered by role)
 *          - Admin: all users in company
 *          - Manager: their team members
 *          - Employee: only themselves
 * @access  Authenticated
 */
router.get('/', authenticateToken, getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID with detailed information
 * @access  Authenticated (with role-based restrictions)
 */
router.get('/:id', authenticateToken, getUserById);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Update user role
 * @access  Admin only
 */
router.put('/:id/role', authenticateToken, requireAdmin, updateUserRole);

/**
 * @route   PUT /api/users/:id/manager
 * @desc    Assign manager to user
 * @access  Admin only
 */
router.put('/:id/manager', authenticateToken, requireAdmin, assignManager);

/**
 * @route   PUT /api/users/:id/password
 * @desc    Change user password
 * @access  Authenticated (own password or admin)
 */
router.put('/:id/password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters long'
      });
    }

    // Check if user exists
    const { query } = require('../utils/database');
    const existingUser = await query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = existingUser.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, id]
    );

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete by setting is_active to false)
 * @access  Admin only
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot delete self
    if (id === req.user.id) {
      return res.status(400).json({
        error: 'Cannot delete your own account'
      });
    }

    // Check if user exists
    const { query } = require('../utils/database');
    const existingUser = await query(
      'SELECT id, name FROM users WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete - set is_active to false
    await query(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({ 
      message: 'User deactivated successfully',
      user: existingUser.rows[0]
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
