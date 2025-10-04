const bcrypt = require('bcrypt');
const { query } = require('../utils/database');

/**
 * Create a new user (Admin only)
 * @route POST /api/users
 * @access Admin
 */
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, manager_id } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'name, email, password, and role are required'
      });
    }

    // Validate role
    const validRoles = ['employee', 'manager', 'admin'];
    if (!validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid role',
        details: 'Role must be one of: employee, manager, admin'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if email already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'Email already exists',
        details: 'A user with this email address already exists'
      });
    }

    // If manager_id is provided, validate it exists and has appropriate role
    if (manager_id) {
      const managerCheck = await query(
        `SELECT id, role, company_id FROM users 
         WHERE id = $1 AND company_id = $2 AND is_active = true`,
        [manager_id, req.user.company_id]
      );

      if (managerCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Manager not found',
          details: 'The specified manager does not exist or is not in your company'
        });
      }

      const managerRole = managerCheck.rows[0].role;
      if (managerRole !== 'manager' && managerRole !== 'admin') {
        return res.status(400).json({
          error: 'Invalid manager',
          details: 'Manager must have Manager or Admin role'
        });
      }
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user in the same company as the admin
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, manager_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, manager_id, company_id, is_active, created_at`,
      [name, email, password_hash, role.toLowerCase(), manager_id || null, req.user.company_id]
    );

    const newUser = result.rows[0];

    // Get manager name if manager_id exists
    let managerName = null;
    if (newUser.manager_id) {
      const managerResult = await query(
        'SELECT name FROM users WHERE id = $1',
        [newUser.manager_id]
      );
      managerName = managerResult.rows[0]?.name;
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        manager_id: newUser.manager_id,
        manager_name: managerName,
        company_id: newUser.company_id,
        is_active: newUser.is_active,
        created_at: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Failed to create user',
      details: error.message
    });
  }
};

/**
 * Get all users based on role
 * @route GET /api/users
 * @access Authenticated
 */
const getAllUsers = async (req, res) => {
  try {
    let queryText;
    let queryParams;

    if (req.user.role === 'admin') {
      // Admin sees all users in their company
      queryText = `
        SELECT 
          u.id, u.name, u.email, u.role, u.manager_id, u.is_active, u.created_at,
          m.name as manager_name,
          c.name as company_name
        FROM users u
        LEFT JOIN users m ON u.manager_id = m.id
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.company_id = $1
        ORDER BY u.created_at DESC
      `;
      queryParams = [req.user.company_id];

    } else if (req.user.role === 'manager') {
      // Manager sees their team (users where manager_id = their id) and themselves
      queryText = `
        SELECT 
          u.id, u.name, u.email, u.role, u.manager_id, u.is_active, u.created_at,
          m.name as manager_name,
          c.name as company_name
        FROM users u
        LEFT JOIN users m ON u.manager_id = m.id
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE (u.manager_id = $1 OR u.id = $1) AND u.company_id = $2
        ORDER BY u.created_at DESC
      `;
      queryParams = [req.user.id, req.user.company_id];

    } else {
      // Employee sees only themselves
      queryText = `
        SELECT 
          u.id, u.name, u.email, u.role, u.manager_id, u.is_active, u.created_at,
          m.name as manager_name,
          c.name as company_name
        FROM users u
        LEFT JOIN users m ON u.manager_id = m.id
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.id = $1
      `;
      queryParams = [req.user.id];
    }

    const result = await query(queryText, queryParams);

    res.json({
      users: result.rows,
      count: result.rows.length,
      role: req.user.role
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      details: error.message
    });
  }
};

/**
 * Update user role (Admin only)
 * @route PUT /api/users/:id/role
 * @access Admin
 */
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { newRole } = req.body;

    // Validate newRole
    const validRoles = ['employee', 'manager', 'admin'];
    if (!newRole || !validRoles.includes(newRole.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid role',
        details: 'Role must be one of: employee, manager, admin'
      });
    }

    // Cannot change own role
    if (id === req.user.id) {
      return res.status(403).json({
        error: 'Cannot change own role',
        details: 'You cannot modify your own role'
      });
    }

    // Check if user exists and is in the same company
    const userCheck = await query(
      'SELECT id, role, name FROM users WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        details: 'User does not exist or is not in your company'
      });
    }

    const oldRole = userCheck.rows[0].role;

    // Update user role
    const result = await query(
      `UPDATE users 
       SET role = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, name, email, role, manager_id, is_active, updated_at`,
      [newRole.toLowerCase(), id]
    );

    const updatedUser = result.rows[0];

    res.json({
      message: 'User role updated successfully',
      user: updatedUser,
      changes: {
        old_role: oldRole,
        new_role: updatedUser.role
      }
    });

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      error: 'Failed to update user role',
      details: error.message
    });
  }
};

/**
 * Assign manager to user (Admin only)
 * @route PUT /api/users/:id/manager
 * @access Admin
 */
const assignManager = async (req, res) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    // Validate managerId is provided
    if (!managerId) {
      return res.status(400).json({
        error: 'Manager ID is required'
      });
    }

    // Cannot assign self as manager
    if (id === managerId) {
      return res.status(400).json({
        error: 'Invalid assignment',
        details: 'A user cannot be their own manager'
      });
    }

    // Check if user exists and is in the same company
    const userCheck = await query(
      'SELECT id, name, manager_id FROM users WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        details: 'User does not exist or is not in your company'
      });
    }

    const oldManagerId = userCheck.rows[0].manager_id;

    // Validate manager exists, has appropriate role, and is in same company
    const managerCheck = await query(
      `SELECT id, name, role FROM users 
       WHERE id = $1 AND company_id = $2 AND is_active = true`,
      [managerId, req.user.company_id]
    );

    if (managerCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Manager not found',
        details: 'The specified manager does not exist or is not in your company'
      });
    }

    const manager = managerCheck.rows[0];

    // Manager must have Manager or Admin role
    if (manager.role !== 'manager' && manager.role !== 'admin') {
      return res.status(400).json({
        error: 'Invalid manager role',
        details: 'Manager must have Manager or Admin role'
      });
    }

    // Check for circular reference (prevent manager loops)
    const circularCheck = await query(
      'SELECT manager_id FROM users WHERE id = $1',
      [managerId]
    );

    if (circularCheck.rows[0]?.manager_id === id) {
      return res.status(400).json({
        error: 'Circular reference detected',
        details: 'Cannot create circular manager relationships'
      });
    }

    // Update user's manager
    const result = await query(
      `UPDATE users 
       SET manager_id = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, name, email, role, manager_id, updated_at`,
      [managerId, id]
    );

    const updatedUser = result.rows[0];

    // Get old manager name
    let oldManagerName = null;
    if (oldManagerId) {
      const oldManagerResult = await query(
        'SELECT name FROM users WHERE id = $1',
        [oldManagerId]
      );
      oldManagerName = oldManagerResult.rows[0]?.name;
    }

    res.json({
      message: 'Manager assigned successfully',
      user: {
        ...updatedUser,
        manager_name: manager.name
      },
      changes: {
        old_manager_id: oldManagerId,
        old_manager_name: oldManagerName,
        new_manager_id: managerId,
        new_manager_name: manager.name
      }
    });

  } catch (error) {
    console.error('Assign manager error:', error);
    res.status(500).json({
      error: 'Failed to assign manager',
      details: error.message
    });
  }
};

/**
 * Get user by ID
 * @route GET /api/users/:id
 * @access Authenticated
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get user with company and manager info
    const result = await query(
      `SELECT 
        u.id, u.name, u.email, u.role, u.manager_id, u.is_active, u.created_at, u.updated_at,
        m.name as manager_name, m.email as manager_email,
        c.name as company_name, c.country as company_country, c.currency as company_currency
      FROM users u
      LEFT JOIN users m ON u.manager_id = m.id
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    // Check access permissions
    if (req.user.role === 'employee' && req.user.id !== id) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You can only view your own profile'
      });
    }

    if (req.user.role === 'manager') {
      // Manager can see their team members and themselves
      const teamCheck = await query(
        'SELECT id FROM users WHERE (manager_id = $1 OR id = $1) AND id = $2',
        [req.user.id, id]
      );

      if (teamCheck.rows.length === 0) {
        return res.status(403).json({
          error: 'Access denied',
          details: 'You can only view your team members'
        });
      }
    }

    // Admin can see all users in their company
    if (req.user.role === 'admin' && user.company_id !== req.user.company_id) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'User is not in your company'
      });
    }

    // Get team members count if user is a manager
    let teamCount = 0;
    if (user.role === 'manager' || user.role === 'admin') {
      const teamResult = await query(
        'SELECT COUNT(*) as count FROM users WHERE manager_id = $1 AND is_active = true',
        [id]
      );
      teamCount = parseInt(teamResult.rows[0].count);
    }

    // Get expense statistics for this user
    const expenseStats = await query(
      `SELECT 
        COUNT(*) as total_expenses,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
      FROM expenses
      WHERE user_id = $1`,
      [id]
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
        manager: user.manager_id ? {
          id: user.manager_id,
          name: user.manager_name,
          email: user.manager_email
        } : null,
        company: {
          name: user.company_name,
          country: user.company_country,
          currency: user.company_currency
        },
        team_count: teamCount,
        expense_stats: expenseStats.rows[0]
      }
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      details: error.message
    });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  updateUserRole,
  assignManager,
  getUserById
};
