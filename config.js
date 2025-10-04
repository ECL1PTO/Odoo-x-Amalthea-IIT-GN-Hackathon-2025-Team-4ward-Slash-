const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  addApprover,
  getApprovers,
  updateApproverSequence,
  removeApprover,
  setApprovalRule,
  getApprovalRules
} = require('../controllers/configController');

const router = express.Router();

// Admin Configuration Routes

/**
 * @route   POST /api/config/approvers
 * @desc    Add an approver to the company
 *          - Validates user exists and belongs to company
 *          - Validates user has manager or admin role
 *          - Checks for sequence conflicts
 *          - Prevents duplicate approvers
 * @access  Admin only
 */
router.post('/approvers', authenticateToken, requireAdmin, addApprover);

/**
 * @route   GET /api/config/approvers
 * @desc    Get all approvers for company
 *          - Returns approvers ordered by sequence
 *          - Includes user details (name, email, role)
 *          - Separates active and inactive approvers
 * @access  Admin only
 */
router.get('/approvers', authenticateToken, requireAdmin, getApprovers);

/**
 * @route   PUT /api/config/approvers/:id
 * @desc    Update approver sequence
 *          - Validates new sequence
 *          - Handles sequence conflicts by swapping
 *          - Returns old and new sequence
 * @access  Admin only
 */
router.put('/approvers/:id', authenticateToken, requireAdmin, updateApproverSequence);

/**
 * @route   DELETE /api/config/approvers/:id
 * @desc    Remove approver (soft delete)
 *          - Sets is_active to false
 *          - Validates no pending approvals exist
 *          - Prevents removal if approver has pending work
 * @access  Admin only
 */
router.delete('/approvers/:id', authenticateToken, requireAdmin, removeApprover);

/**
 * @route   POST /api/config/rules
 * @desc    Set approval rule for company
 *          - Supports multiple rule types:
 *            * percentage: {percentage: 60, total_approvers: 5}
 *            * specific_approver: {approver_id: "uuid"}
 *            * hybrid: {percentage: 60, total_approvers: 5, special_approver_id: "uuid"}
 *            * amount_threshold: {min_amount: 100, max_amount: 1000}
 *            * category_based: {categories: ["Travel", "Equipment"]}
 *            * role_based: {roles: ["manager", "admin"]}
 *          - Deactivates old rule of same type
 *          - Validates rule configuration
 * @access  Admin only
 */
router.post('/rules', authenticateToken, requireAdmin, setApprovalRule);

/**
 * @route   GET /api/config/rules
 * @desc    Get all approval rules for company
 *          - Returns rules with parsed JSON configs
 *          - Includes human-readable descriptions
 *          - Separates active and inactive rules
 * @access  Admin only
 */
router.get('/rules', authenticateToken, requireAdmin, getApprovalRules);

module.exports = router;
