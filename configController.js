const { query, getClient } = require('../utils/database');

/**
 * Add an approver to the company
 * @route POST /api/config/approvers
 * @access Admin only
 */
const addApprover = async (req, res) => {
  try {
    const { userId, roleName, sequence } = req.body;
    const companyId = req.user.company_id;

    // Validate required fields
    if (!userId || !roleName || sequence === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'userId, roleName, and sequence are required'
      });
    }

    // Validate sequence is a positive integer
    const sequenceNum = parseInt(sequence);
    if (isNaN(sequenceNum) || sequenceNum < 1) {
      return res.status(400).json({
        error: 'Invalid sequence',
        details: 'Sequence must be a positive integer starting from 1'
      });
    }

    // Validate user exists and belongs to company
    const userResult = await query(
      `SELECT id, name, email, role, is_active
       FROM users
       WHERE id = $1 AND company_id = $2`,
      [userId, companyId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        details: 'User does not exist or does not belong to your company'
      });
    }

    const user = userResult.rows[0];

    // Validate user is active
    if (!user.is_active) {
      return res.status(400).json({
        error: 'User is inactive',
        details: 'Cannot add inactive user as approver'
      });
    }

    // Validate user has appropriate role (manager or admin)
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(400).json({
        error: 'Invalid user role',
        details: 'Only managers and admins can be approvers'
      });
    }

    // Check if user is already an approver with this role
    const existingApprover = await query(
      `SELECT id FROM approvers
       WHERE company_id = $1 AND user_id = $2 AND role_name = $3 AND is_active = true`,
      [companyId, userId, roleName]
    );

    if (existingApprover.rows.length > 0) {
      return res.status(400).json({
        error: 'Approver already exists',
        details: `User is already an approver with role "${roleName}"`
      });
    }

    // Check for sequence conflicts
    const sequenceConflict = await query(
      `SELECT id, user_id, role_name
       FROM approvers
       WHERE company_id = $1 AND sequence = $2 AND is_active = true`,
      [companyId, sequenceNum]
    );

    if (sequenceConflict.rows.length > 0) {
      return res.status(400).json({
        error: 'Sequence conflict',
        details: `Sequence ${sequenceNum} is already assigned. Please use a different sequence or update existing approver.`
      });
    }

    // Add approver
    const result = await query(
      `INSERT INTO approvers (company_id, user_id, role_name, sequence)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [companyId, userId, roleName, sequenceNum]
    );

    const approver = result.rows[0];

    res.status(201).json({
      message: 'Approver added successfully',
      approver: {
        id: approver.id,
        user_id: approver.user_id,
        user_name: user.name,
        user_email: user.email,
        role_name: approver.role_name,
        sequence: approver.sequence,
        is_active: approver.is_active,
        created_at: approver.created_at
      }
    });

  } catch (error) {
    console.error('Add approver error:', error);
    res.status(500).json({
      error: 'Failed to add approver',
      details: error.message
    });
  }
};

/**
 * Get all approvers for company
 * @route GET /api/config/approvers
 * @access Admin only
 */
const getApprovers = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const result = await query(
      `SELECT 
        a.id,
        a.user_id,
        a.role_name,
        a.sequence,
        a.is_active,
        a.created_at,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role
       FROM approvers a
       JOIN users u ON a.user_id = u.id
       WHERE a.company_id = $1
       ORDER BY a.sequence ASC, a.created_at ASC`,
      [companyId]
    );

    // Separate active and inactive approvers
    const activeApprovers = result.rows.filter(a => a.is_active);
    const inactiveApprovers = result.rows.filter(a => !a.is_active);

    res.json({
      approvers: result.rows,
      active_approvers: activeApprovers,
      inactive_approvers: inactiveApprovers,
      total: result.rows.length,
      active_count: activeApprovers.length,
      inactive_count: inactiveApprovers.length
    });

  } catch (error) {
    console.error('Get approvers error:', error);
    res.status(500).json({
      error: 'Failed to fetch approvers',
      details: error.message
    });
  }
};

/**
 * Update approver sequence
 * @route PUT /api/config/approvers/:id
 * @access Admin only
 */
const updateApproverSequence = async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { newSequence } = req.body;
    const companyId = req.user.company_id;

    // Validate newSequence
    if (newSequence === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Missing required field',
        details: 'newSequence is required'
      });
    }

    const sequenceNum = parseInt(newSequence);
    if (isNaN(sequenceNum) || sequenceNum < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invalid sequence',
        details: 'Sequence must be a positive integer starting from 1'
      });
    }

    // Check if approver exists and belongs to company
    const approverResult = await client.query(
      `SELECT a.*, u.name as user_name
       FROM approvers a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = $1 AND a.company_id = $2`,
      [id, companyId]
    );

    if (approverResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Approver not found',
        details: 'Approver does not exist or does not belong to your company'
      });
    }

    const approver = approverResult.rows[0];
    const oldSequence = approver.sequence;

    // If sequence is the same, no update needed
    if (oldSequence === sequenceNum) {
      await client.query('ROLLBACK');
      return res.json({
        message: 'Sequence unchanged',
        approver: {
          id: approver.id,
          user_name: approver.user_name,
          role_name: approver.role_name,
          sequence: approver.sequence
        }
      });
    }

    // Check for sequence conflicts
    const conflictResult = await client.query(
      `SELECT id, user_id, role_name, sequence
       FROM approvers
       WHERE company_id = $1 AND sequence = $2 AND id != $3 AND is_active = true`,
      [companyId, sequenceNum, id]
    );

    if (conflictResult.rows.length > 0) {
      const conflictingApprover = conflictResult.rows[0];
      
      // Swap sequences to resolve conflict
      await client.query(
        `UPDATE approvers SET sequence = $1 WHERE id = $2`,
        [oldSequence, conflictingApprover.id]
      );

      // Get conflicting approver details
      const conflictUserResult = await client.query(
        'SELECT name FROM users WHERE id = $1',
        [conflictingApprover.user_id]
      );

      var swappedWith = {
        id: conflictingApprover.id,
        user_name: conflictUserResult.rows[0].name,
        role_name: conflictingApprover.role_name,
        old_sequence: conflictingApprover.sequence,
        new_sequence: oldSequence
      };
    }

    // Update the approver sequence
    const updateResult = await client.query(
      `UPDATE approvers
       SET sequence = $1
       WHERE id = $2
       RETURNING *`,
      [sequenceNum, id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Approver sequence updated successfully',
      approver: {
        id: updateResult.rows[0].id,
        user_name: approver.user_name,
        role_name: updateResult.rows[0].role_name,
        old_sequence: oldSequence,
        new_sequence: updateResult.rows[0].sequence
      },
      swapped_with: swappedWith || null
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update approver sequence error:', error);
    res.status(500).json({
      error: 'Failed to update approver sequence',
      details: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Remove approver (soft delete)
 * @route DELETE /api/config/approvers/:id
 * @access Admin only
 */
const removeApprover = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    // Check if approver exists and belongs to company
    const approverResult = await query(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM approvers a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = $1 AND a.company_id = $2`,
      [id, companyId]
    );

    if (approverResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Approver not found',
        details: 'Approver does not exist or does not belong to your company'
      });
    }

    const approver = approverResult.rows[0];

    // Check if approver has pending approvals
    const pendingApprovalsResult = await query(
      `SELECT COUNT(*) as count
       FROM approvals
       WHERE approver_id = $1 AND status = 'pending'`,
      [approver.user_id]
    );

    const pendingCount = parseInt(pendingApprovalsResult.rows[0].count);

    if (pendingCount > 0) {
      return res.status(400).json({
        error: 'Cannot remove approver',
        details: `Approver has ${pendingCount} pending approval(s). Please reassign or complete them first.`
      });
    }

    // Soft delete - set is_active to false
    await query(
      `UPDATE approvers
       SET is_active = false
       WHERE id = $1`,
      [id]
    );

    res.json({
      message: 'Approver removed successfully',
      approver: {
        id: approver.id,
        user_name: approver.user_name,
        user_email: approver.user_email,
        role_name: approver.role_name,
        sequence: approver.sequence
      }
    });

  } catch (error) {
    console.error('Remove approver error:', error);
    res.status(500).json({
      error: 'Failed to remove approver',
      details: error.message
    });
  }
};

/**
 * Set approval rule for company
 * @route POST /api/config/rules
 * @access Admin only
 */
const setApprovalRule = async (req, res) => {
  try {
    const { ruleType, ruleConfig } = req.body;
    const companyId = req.user.company_id;

    // Validate required fields
    if (!ruleType || !ruleConfig) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'ruleType and ruleConfig are required'
      });
    }

    // Validate ruleType
    const validRuleTypes = ['percentage', 'specific_approver', 'hybrid', 'amount_threshold', 'category_based', 'role_based'];
    if (!validRuleTypes.includes(ruleType)) {
      return res.status(400).json({
        error: 'Invalid rule type',
        details: `Rule type must be one of: ${validRuleTypes.join(', ')}`
      });
    }

    // Validate ruleConfig is an object
    if (typeof ruleConfig !== 'object' || Array.isArray(ruleConfig)) {
      return res.status(400).json({
        error: 'Invalid rule configuration',
        details: 'ruleConfig must be a JSON object'
      });
    }

    // Validate specific rule configurations
    if (ruleType === 'percentage') {
      const { percentage, total_approvers } = ruleConfig;
      
      if (percentage === undefined || total_approvers === undefined) {
        return res.status(400).json({
          error: 'Invalid percentage rule',
          details: 'Percentage rule requires: percentage and total_approvers'
        });
      }

      if (percentage < 1 || percentage > 100) {
        return res.status(400).json({
          error: 'Invalid percentage value',
          details: 'Percentage must be between 1 and 100'
        });
      }

      if (total_approvers < 1) {
        return res.status(400).json({
          error: 'Invalid total_approvers',
          details: 'total_approvers must be at least 1'
        });
      }
    }

    if (ruleType === 'specific_approver') {
      const { approver_id } = ruleConfig;
      
      if (!approver_id) {
        return res.status(400).json({
          error: 'Invalid specific_approver rule',
          details: 'specific_approver rule requires: approver_id'
        });
      }

      // Validate approver exists
      const approverCheck = await query(
        'SELECT id FROM users WHERE id = $1 AND company_id = $2',
        [approver_id, companyId]
      );

      if (approverCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Approver not found',
          details: 'Specified approver does not exist in your company'
        });
      }
    }

    if (ruleType === 'hybrid') {
      const { percentage, total_approvers, special_approver_id } = ruleConfig;
      
      if (!percentage || !total_approvers || !special_approver_id) {
        return res.status(400).json({
          error: 'Invalid hybrid rule',
          details: 'Hybrid rule requires: percentage, total_approvers, and special_approver_id'
        });
      }

      // Validate approver exists
      const approverCheck = await query(
        'SELECT id FROM users WHERE id = $1 AND company_id = $2',
        [special_approver_id, companyId]
      );

      if (approverCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Special approver not found',
          details: 'Specified special approver does not exist in your company'
        });
      }
    }

    // Check if rule of this type already exists
    const existingRule = await query(
      `SELECT id FROM approval_rules
       WHERE company_id = $1 AND rule_type = $2 AND is_active = true`,
      [companyId, ruleType]
    );

    if (existingRule.rows.length > 0) {
      // Deactivate old rule
      await query(
        `UPDATE approval_rules SET is_active = false WHERE id = $1`,
        [existingRule.rows[0].id]
      );
    }

    // Create new rule
    const result = await query(
      `INSERT INTO approval_rules (company_id, rule_type, rule_config)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [companyId, ruleType, JSON.stringify(ruleConfig)]
    );

    const rule = result.rows[0];

    res.status(201).json({
      message: 'Approval rule created successfully',
      rule: {
        id: rule.id,
        rule_type: rule.rule_type,
        rule_config: rule.rule_config,
        is_active: rule.is_active,
        created_at: rule.created_at
      }
    });

  } catch (error) {
    console.error('Set approval rule error:', error);
    res.status(500).json({
      error: 'Failed to set approval rule',
      details: error.message
    });
  }
};

/**
 * Get all approval rules for company
 * @route GET /api/config/rules
 * @access Admin only
 */
const getApprovalRules = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const result = await query(
      `SELECT 
        id,
        rule_type,
        rule_config,
        is_active,
        created_at,
        updated_at
       FROM approval_rules
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [companyId]
    );

    // Separate active and inactive rules
    const activeRules = result.rows.filter(r => r.is_active);
    const inactiveRules = result.rows.filter(r => !r.is_active);

    // Parse rule configs and add descriptions
    const rulesWithDescriptions = result.rows.map(rule => {
      let description = '';
      const config = rule.rule_config;

      switch (rule.rule_type) {
        case 'percentage':
          description = `Requires ${config.percentage}% approval from ${config.total_approvers} approvers`;
          break;
        case 'specific_approver':
          description = `Requires approval from specific approver (ID: ${config.approver_id})`;
          break;
        case 'hybrid':
          description = `Requires ${config.percentage}% approval from ${config.total_approvers} approvers AND approval from special approver (ID: ${config.special_approver_id})`;
          break;
        case 'amount_threshold':
          description = `Amount-based approval: ${config.min_amount || 0} - ${config.max_amount || '∞'}`;
          break;
        case 'category_based':
          description = `Category-based approval for: ${config.categories?.join(', ') || 'all'}`;
          break;
        case 'role_based':
          description = `Role-based approval for: ${config.roles?.join(', ') || 'all'}`;
          break;
        default:
          description = 'Custom approval rule';
      }

      return {
        ...rule,
        description
      };
    });

    res.json({
      rules: rulesWithDescriptions,
      active_rules: activeRules.map(r => ({
        ...r,
        description: rulesWithDescriptions.find(rd => rd.id === r.id)?.description
      })),
      inactive_rules: inactiveRules.map(r => ({
        ...r,
        description: rulesWithDescriptions.find(rd => rd.id === r.id)?.description
      })),
      total: result.rows.length,
      active_count: activeRules.length,
      inactive_count: inactiveRules.length
    });

  } catch (error) {
    console.error('Get approval rules error:', error);
    res.status(500).json({
      error: 'Failed to fetch approval rules',
      details: error.message
    });
  }
};

module.exports = {
  addApprover,
  getApprovers,
  updateApproverSequence,
  removeApprover,
  setApprovalRule,
  getApprovalRules
};
