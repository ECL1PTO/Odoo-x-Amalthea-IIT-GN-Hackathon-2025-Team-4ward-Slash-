const express = require('express');
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');
const {
  getPendingApprovals,
  approveExpense,
  rejectExpense,
  getApprovalHistory
} = require('../controllers/approvalController');

const router = express.Router();

// Approval Workflow Routes

/**
 * @route   GET /api/approvals/pending
 * @desc    Get all pending approvals for current user
 *          Only shows approvals where all previous sequences are approved
 *          Includes expense details, submitter info, and approval context
 * @access  Manager, Admin
 */
router.get('/pending', authenticateToken, requireManagerOrAdmin, getPendingApprovals);

/**
 * @route   POST /api/approvals/:id/approve
 * @desc    Approve an expense
 *          - Validates user is the assigned approver
 *          - Validates sequential approval flow (all previous sequences approved)
 *          - Updates approval status to 'approved'
 *          - Updates expense status to 'approved' if all approvals complete
 *          - Checks conditional approval rules (percentage, specific approver)
 * @access  Manager, Admin
 */
router.post('/:id/approve', authenticateToken, requireManagerOrAdmin, approveExpense);

/**
 * @route   POST /api/approvals/:id/reject
 * @desc    Reject an expense (comments required)
 *          - Validates user is the assigned approver
 *          - Requires rejection comments
 *          - Updates approval status to 'rejected'
 *          - Immediately rejects expense (no further approvals processed)
 *          - Rejects all other pending approvals
 * @access  Manager, Admin
 */
router.post('/:id/reject', authenticateToken, requireManagerOrAdmin, rejectExpense);

/**
 * @route   GET /api/approvals/expense/:expenseId
 * @desc    Get approval history for an expense
 *          Shows all approvals with approver details, status, and comments
 *          Includes approval statistics (total, approved, rejected, pending)
 * @access  Authenticated (with role-based access check)
 *          - Admin: all company expenses
 *          - Manager: team expenses or expenses they're approving
 *          - Employee: own expenses only
 */
router.get('/expense/:expenseId', authenticateToken, getApprovalHistory);

module.exports = router;
