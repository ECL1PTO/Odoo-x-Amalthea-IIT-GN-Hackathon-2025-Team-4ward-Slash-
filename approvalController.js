const { query, getClient } = require('../utils/database');

/**
 * Get all pending approvals for current user
 * @route GET /api/approvals/pending
 * @access Manager, Admin
 */
const getPendingApprovals = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all expenses waiting for current user's approval
    // Only show if all previous sequence approvals are approved
    const result = await query(
      `SELECT 
        a.id as approval_id,
        a.sequence,
        a.created_at as approval_created_at,
        e.id as expense_id,
        e.amount,
        e.original_amount,
        e.original_currency,
        e.category,
        e.description,
        e.date as expense_date,
        e.receipt_url,
        e.created_at as expense_created_at,
        u.id as submitter_id,
        u.name as submitter_name,
        u.email as submitter_email,
        c.currency as company_currency,
        c.name as company_name,
        (
          SELECT COUNT(*)
          FROM approvals a2
          WHERE a2.expense_id = e.id
          AND a2.sequence < a.sequence
          AND a2.status != 'approved'
        ) as blocking_approvals
      FROM approvals a
      JOIN expenses e ON a.expense_id = e.id
      JOIN users u ON e.user_id = u.id
      JOIN companies c ON e.company_id = c.id
      WHERE a.approver_id = $1
      AND a.status = 'pending'
      AND e.status = 'pending'
      AND e.company_id = $2
      ORDER BY a.created_at ASC`,
      [userId, req.user.company_id]
    );

    // Filter out expenses where previous approvals are not complete
    const availableApprovals = result.rows.filter(
      approval => approval.blocking_approvals === '0'
    );

    // Get additional approval context for each expense
    const approvalsWithContext = await Promise.all(
      availableApprovals.map(async (approval) => {
        // Get total approvals for this expense
        const totalApprovals = await query(
          `SELECT COUNT(*) as total,
           COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count
           FROM approvals
           WHERE expense_id = $1`,
          [approval.expense_id]
        );

        // Get previous approvers
        const previousApprovers = await query(
          `SELECT u.name, a.status, a.approved_at, a.comments
           FROM approvals a
           JOIN users u ON a.approver_id = u.id
           WHERE a.expense_id = $1 AND a.sequence < $2
           ORDER BY a.sequence ASC`,
          [approval.expense_id, approval.sequence]
        );

        return {
          approval_id: approval.approval_id,
          sequence: approval.sequence,
          expense: {
            id: approval.expense_id,
            amount: approval.amount,
            original_amount: approval.original_amount,
            original_currency: approval.original_currency,
            company_currency: approval.company_currency,
            category: approval.category,
            description: approval.description,
            date: approval.expense_date,
            receipt_url: approval.receipt_url,
            created_at: approval.expense_created_at
          },
          submitter: {
            id: approval.submitter_id,
            name: approval.submitter_name,
            email: approval.submitter_email
          },
          company: {
            name: approval.company_name,
            currency: approval.company_currency
          },
          approval_context: {
            total_approvals: parseInt(totalApprovals.rows[0].total),
            approved_count: parseInt(totalApprovals.rows[0].approved_count),
            current_sequence: approval.sequence,
            previous_approvers: previousApprovers.rows
          },
          created_at: approval.approval_created_at
        };
      })
    );

    res.json({
      pending_approvals: approvalsWithContext,
      count: approvalsWithContext.length
    });

  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({
      error: 'Failed to fetch pending approvals',
      details: error.message
    });
  }
};

/**
 * Approve an expense
 * @route POST /api/approvals/:id/approve
 * @access Manager, Admin
 */
const approveExpense = async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    // Get approval details
    const approvalResult = await client.query(
      `SELECT a.*, e.id as expense_id, e.status as expense_status, e.company_id
       FROM approvals a
       JOIN expenses e ON a.expense_id = e.id
       WHERE a.id = $1`,
      [id]
    );

    if (approvalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Approval not found'
      });
    }

    const approval = approvalResult.rows[0];

    // Validate user is the assigned approver
    if (approval.approver_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Access denied',
        details: 'You are not the assigned approver for this expense'
      });
    }

    // Validate approval is still pending
    if (approval.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invalid approval status',
        details: `This approval is already ${approval.status}`
      });
    }

    // Validate expense is still pending
    if (approval.expense_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invalid expense status',
        details: `This expense is already ${approval.expense_status}`
      });
    }

    // Validate all previous sequence approvals are approved
    const previousApprovals = await client.query(
      `SELECT id, status, sequence
       FROM approvals
       WHERE expense_id = $1 AND sequence < $2
       ORDER BY sequence ASC`,
      [approval.expense_id, approval.sequence]
    );

    const unapprovedPrevious = previousApprovals.rows.filter(
      a => a.status !== 'approved'
    );

    if (unapprovedPrevious.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Sequential approval violation',
        details: `Approval sequence ${unapprovedPrevious[0].sequence} must be approved first`
      });
    }

    // Update approval status to approved
    const updateApprovalResult = await client.query(
      `UPDATE approvals
       SET status = 'approved',
           comments = $1,
           approved_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [comments || null, id]
    );

    const updatedApproval = updateApprovalResult.rows[0];

    // Check if there are any more pending approvals
    const remainingApprovals = await client.query(
      `SELECT id, sequence, status
       FROM approvals
       WHERE expense_id = $1 AND sequence > $2
       ORDER BY sequence ASC`,
      [approval.expense_id, approval.sequence]
    );

    let expenseStatus = 'pending';
    let isFullyApproved = false;

    // If no more approvals or all remaining are approved, mark expense as approved
    if (remainingApprovals.rows.length === 0) {
      isFullyApproved = true;
      expenseStatus = 'approved';
    } else {
      // Check if all approvals are now approved
      const allApprovals = await client.query(
        `SELECT status
         FROM approvals
         WHERE expense_id = $1`,
        [approval.expense_id]
      );

      const allApproved = allApprovals.rows.every(a => a.status === 'approved');
      if (allApproved) {
        isFullyApproved = true;
        expenseStatus = 'approved';
      }
    }

    // Check for conditional approval rules
    const rulesResult = await client.query(
      `SELECT rule_type, rule_config
       FROM approval_rules
       WHERE company_id = $1 AND is_active = true`,
      [approval.company_id]
    );

    for (const rule of rulesResult.rows) {
      if (rule.rule_type === 'percentage') {
        // Check if X% of approvers have approved
        const config = rule.rule_config;
        const requiredPercentage = config.required_percentage || 100;

        const approvalStats = await client.query(
          `SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved
           FROM approvals
           WHERE expense_id = $1`,
          [approval.expense_id]
        );

        const stats = approvalStats.rows[0];
        const approvedPercentage = (parseInt(stats.approved) / parseInt(stats.total)) * 100;

        if (approvedPercentage >= requiredPercentage) {
          isFullyApproved = true;
          expenseStatus = 'approved';
        }
      }
    }

    // Update expense status if fully approved
    let updatedExpense;
    if (isFullyApproved) {
      const expenseUpdateResult = await client.query(
        `UPDATE expenses
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [expenseStatus, approval.expense_id]
      );
      updatedExpense = expenseUpdateResult.rows[0];
    } else {
      const expenseResult = await client.query(
        'SELECT * FROM expenses WHERE id = $1',
        [approval.expense_id]
      );
      updatedExpense = expenseResult.rows[0];
    }

    await client.query('COMMIT');

    // Get approver details
    const approverDetails = await query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );

    // Get next approver if exists
    let nextApprover = null;
    if (!isFullyApproved && remainingApprovals.rows.length > 0) {
      const nextApprovalId = remainingApprovals.rows[0].id;
      const nextApproverResult = await query(
        `SELECT u.name, u.email, a.sequence
         FROM approvals a
         JOIN users u ON a.approver_id = u.id
         WHERE a.id = $1`,
        [nextApprovalId]
      );
      nextApprover = nextApproverResult.rows[0];
    }

    res.json({
      message: 'Expense approved successfully',
      approval: {
        id: updatedApproval.id,
        expense_id: updatedApproval.expense_id,
        sequence: updatedApproval.sequence,
        status: updatedApproval.status,
        comments: updatedApproval.comments,
        approved_at: updatedApproval.approved_at,
        approver: {
          name: approverDetails.rows[0].name,
          email: approverDetails.rows[0].email
        }
      },
      expense: {
        id: updatedExpense.id,
        status: updatedExpense.status,
        fully_approved: isFullyApproved
      },
      next_approver: nextApprover
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve expense error:', error);
    res.status(500).json({
      error: 'Failed to approve expense',
      details: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Reject an expense
 * @route POST /api/approvals/:id/reject
 * @access Manager, Admin
 */
const rejectExpense = async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    // Validate comments are provided
    if (!comments || comments.trim().length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Comments are required when rejecting an expense'
      });
    }

    // Get approval details
    const approvalResult = await client.query(
      `SELECT a.*, e.id as expense_id, e.status as expense_status
       FROM approvals a
       JOIN expenses e ON a.expense_id = e.id
       WHERE a.id = $1`,
      [id]
    );

    if (approvalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Approval not found'
      });
    }

    const approval = approvalResult.rows[0];

    // Validate user is the assigned approver
    if (approval.approver_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Access denied',
        details: 'You are not the assigned approver for this expense'
      });
    }

    // Validate approval is still pending
    if (approval.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invalid approval status',
        details: `This approval is already ${approval.status}`
      });
    }

    // Validate expense is still pending
    if (approval.expense_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invalid expense status',
        details: `This expense is already ${approval.expense_status}`
      });
    }

    // Update approval status to rejected
    const updateApprovalResult = await client.query(
      `UPDATE approvals
       SET status = 'rejected',
           comments = $1,
           approved_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [comments, id]
    );

    const updatedApproval = updateApprovalResult.rows[0];

    // Update expense status to rejected
    const expenseUpdateResult = await client.query(
      `UPDATE expenses
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [approval.expense_id]
    );

    const updatedExpense = expenseUpdateResult.rows[0];

    // Update all other pending approvals to rejected (no need to process further)
    await client.query(
      `UPDATE approvals
       SET status = 'rejected',
           comments = 'Rejected due to prior rejection in approval chain',
           approved_at = CURRENT_TIMESTAMP
       WHERE expense_id = $1 AND status = 'pending' AND id != $2`,
      [approval.expense_id, id]
    );

    await client.query('COMMIT');

    // Get approver details
    const approverDetails = await query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );

    // Get submitter details for notification
    const submitterDetails = await query(
      'SELECT name, email FROM users WHERE id = $1',
      [updatedExpense.user_id]
    );

    res.json({
      message: 'Expense rejected successfully',
      approval: {
        id: updatedApproval.id,
        expense_id: updatedApproval.expense_id,
        sequence: updatedApproval.sequence,
        status: updatedApproval.status,
        comments: updatedApproval.comments,
        approved_at: updatedApproval.approved_at,
        approver: {
          name: approverDetails.rows[0].name,
          email: approverDetails.rows[0].email
        }
      },
      expense: {
        id: updatedExpense.id,
        status: updatedExpense.status,
        submitter: {
          name: submitterDetails.rows[0].name,
          email: submitterDetails.rows[0].email
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reject expense error:', error);
    res.status(500).json({
      error: 'Failed to reject expense',
      details: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Get approval history for an expense
 * @route GET /api/approvals/expense/:expenseId
 * @access Authenticated (with access check)
 */
const getApprovalHistory = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if expense exists and user has access
    const expenseResult = await query(
      `SELECT e.*, u.name as submitter_name, u.manager_id
       FROM expenses e
       JOIN users u ON e.user_id = u.id
       WHERE e.id = $1`,
      [expenseId]
    );

    if (expenseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    const expense = expenseResult.rows[0];

    // Check access permissions
    let hasAccess = false;

    if (userRole === 'admin' && expense.company_id === req.user.company_id) {
      hasAccess = true;
    } else if (userRole === 'manager') {
      // Manager can see team expenses or expenses they're approving
      const teamCheck = await query(
        'SELECT id FROM users WHERE manager_id = $1 AND id = $2',
        [userId, expense.user_id]
      );
      const approverCheck = await query(
        'SELECT id FROM approvals WHERE expense_id = $1 AND approver_id = $2',
        [expenseId, userId]
      );
      hasAccess = teamCheck.rows.length > 0 || 
                  approverCheck.rows.length > 0 || 
                  expense.user_id === userId;
    } else if (expense.user_id === userId) {
      // User can see their own expense history
      hasAccess = true;
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You do not have permission to view this approval history'
      });
    }

    // Get all approvals for this expense
    const approvalsResult = await query(
      `SELECT 
        a.id,
        a.sequence,
        a.status,
        a.comments,
        a.approved_at,
        a.created_at,
        u.id as approver_id,
        u.name as approver_name,
        u.email as approver_email,
        u.role as approver_role
       FROM approvals a
       JOIN users u ON a.approver_id = u.id
       WHERE a.expense_id = $1
       ORDER BY a.sequence ASC`,
      [expenseId]
    );

    // Calculate approval statistics
    const totalApprovals = approvalsResult.rows.length;
    const approvedCount = approvalsResult.rows.filter(a => a.status === 'approved').length;
    const rejectedCount = approvalsResult.rows.filter(a => a.status === 'rejected').length;
    const pendingCount = approvalsResult.rows.filter(a => a.status === 'pending').length;

    res.json({
      expense: {
        id: expense.id,
        amount: expense.amount,
        category: expense.category,
        status: expense.status,
        submitter_name: expense.submitter_name,
        created_at: expense.created_at
      },
      approvals: approvalsResult.rows,
      statistics: {
        total: totalApprovals,
        approved: approvedCount,
        rejected: rejectedCount,
        pending: pendingCount,
        completion_percentage: totalApprovals > 0 
          ? Math.round((approvedCount / totalApprovals) * 100) 
          : 0
      }
    });

  } catch (error) {
    console.error('Get approval history error:', error);
    res.status(500).json({
      error: 'Failed to fetch approval history',
      details: error.message
    });
  }
};

module.exports = {
  getPendingApprovals,
  approveExpense,
  rejectExpense,
  getApprovalHistory
};
