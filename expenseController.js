const { query, getClient } = require('../utils/database');
const { convertCurrency } = require('../utils/currencyConverter');
const path = require('path');
const fs = require('fs').promises;

/**
 * Submit a new expense
 * @route POST /api/expenses
 * @access Employee, Manager
 */
const submitExpense = async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { amount, currency, category, description, date } = req.body;
    const userId = req.user.id;
    const companyId = req.user.company_id;

    // Validate required fields
    if (!amount || !currency || !category || !date) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'amount, currency, category, and date are required'
      });
    }

    // Validate amount
    const expenseAmount = parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invalid amount',
        details: 'Amount must be a positive number'
      });
    }

    // Validate date
    const expenseDate = new Date(date);
    if (isNaN(expenseDate.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invalid date format'
      });
    }

    // Get user's company currency
    const companyResult = await client.query(
      'SELECT currency FROM companies WHERE id = $1',
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Company not found'
      });
    }

    const companyCurrency = companyResult.rows[0].currency;

    // Convert amount to company currency
    let convertedAmount = expenseAmount;
    try {
      convertedAmount = await convertCurrency(
        expenseAmount,
        currency.toUpperCase(),
        companyCurrency.toUpperCase()
      );
      console.log(`Converted ${expenseAmount} ${currency} to ${convertedAmount} ${companyCurrency}`);
    } catch (conversionError) {
      console.error('Currency conversion failed:', conversionError.message);
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Currency conversion failed',
        details: conversionError.message
      });
    }

    // Handle receipt file upload
    let receiptUrl = null;
    if (req.file) {
      receiptUrl = `/uploads/${req.file.filename}`;
    }

    // Create expense record
    const expenseResult = await client.query(
      `INSERT INTO expenses (
        user_id, company_id, amount, original_amount, original_currency,
        category, description, date, status, receipt_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        userId,
        companyId,
        convertedAmount,
        expenseAmount,
        currency.toUpperCase(),
        category,
        description || null,
        expenseDate,
        'pending',
        receiptUrl
      ]
    );

    const expense = expenseResult.rows[0];

    // Get user's manager
    const userResult = await client.query(
      'SELECT manager_id FROM users WHERE id = $1',
      [userId]
    );

    const managerId = userResult.rows[0]?.manager_id;

    // Create approval chain
    const approvalChain = [];
    let sequence = 1;

    // Step 1: If user has a manager, add them as first approver
    if (managerId) {
      const managerApproval = await client.query(
        `INSERT INTO approvals (expense_id, approver_id, sequence, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, approver_id, sequence, status, created_at`,
        [expense.id, managerId, sequence, 'pending']
      );

      // Get manager details
      const managerDetails = await client.query(
        'SELECT name, email, role FROM users WHERE id = $1',
        [managerId]
      );

      approvalChain.push({
        ...managerApproval.rows[0],
        approver_name: managerDetails.rows[0].name,
        approver_email: managerDetails.rows[0].email,
        approver_role: managerDetails.rows[0].role
      });

      sequence++;
    }

    // Step 2: Get additional approvers from approvers table
    const additionalApprovers = await client.query(
      `SELECT a.user_id, a.sequence as approver_sequence, u.name, u.email, u.role
       FROM approvers a
       JOIN users u ON a.user_id = u.id
       WHERE a.company_id = $1 AND a.is_active = true
       ORDER BY a.sequence ASC`,
      [companyId]
    );

    // Add additional approvers to approval chain
    for (const approver of additionalApprovers.rows) {
      // Skip if approver is the same as manager (avoid duplicate)
      if (approver.user_id === managerId) {
        continue;
      }

      const additionalApproval = await client.query(
        `INSERT INTO approvals (expense_id, approver_id, sequence, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, approver_id, sequence, status, created_at`,
        [expense.id, approver.user_id, sequence, 'pending']
      );

      approvalChain.push({
        ...additionalApproval.rows[0],
        approver_name: approver.name,
        approver_email: approver.email,
        approver_role: approver.role
      });

      sequence++;
    }

    // If no approvers found, auto-approve for admin users
    if (approvalChain.length === 0 && req.user.role === 'admin') {
      await client.query(
        `UPDATE expenses SET status = 'approved' WHERE id = $1`,
        [expense.id]
      );
      expense.status = 'approved';
    }

    await client.query('COMMIT');

    // Get submitter details
    const submitterDetails = await query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );

    res.status(201).json({
      message: 'Expense submitted successfully',
      expense: {
        id: expense.id,
        amount: expense.amount,
        original_amount: expense.original_amount,
        original_currency: expense.original_currency,
        company_currency: companyCurrency,
        category: expense.category,
        description: expense.description,
        date: expense.date,
        status: expense.status,
        receipt_url: expense.receipt_url,
        created_at: expense.created_at,
        submitter: {
          id: userId,
          name: submitterDetails.rows[0].name,
          email: submitterDetails.rows[0].email
        }
      },
      approval_chain: approvalChain,
      next_approver: approvalChain.length > 0 ? approvalChain[0] : null
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Submit expense error:', error);

    // Delete uploaded file if transaction failed
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      error: 'Failed to submit expense',
      details: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Get all expenses for logged-in user
 * @route GET /api/expenses/my
 * @access Authenticated
 */
const getMyExpenses = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT 
        e.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', a.id,
              'approver_id', a.approver_id,
              'approver_name', u.name,
              'sequence', a.sequence,
              'status', a.status,
              'comments', a.comments,
              'approved_at', a.approved_at
            ) ORDER BY a.sequence
          )
          FROM approvals a
          JOIN users u ON a.approver_id = u.id
          WHERE a.expense_id = e.id
        ) as approvals
      FROM expenses e
      WHERE e.user_id = $1
      ORDER BY e.date DESC, e.created_at DESC`,
      [userId]
    );

    res.json({
      expenses: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get my expenses error:', error);
    res.status(500).json({
      error: 'Failed to fetch expenses',
      details: error.message
    });
  }
};

/**
 * Get expense by ID
 * @route GET /api/expenses/:id
 * @access Authenticated (with role-based restrictions)
 */
const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get expense with submitter and company details
    const expenseResult = await query(
      `SELECT 
        e.*,
        u.name as submitter_name,
        u.email as submitter_email,
        u.manager_id,
        c.name as company_name,
        c.currency as company_currency
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      JOIN companies c ON e.company_id = c.id
      WHERE e.id = $1`,
      [id]
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
      // Admin can see all company expenses
      hasAccess = true;
    } else if (userRole === 'manager') {
      // Manager can see team expenses
      const teamCheck = await query(
        'SELECT id FROM users WHERE manager_id = $1 AND id = $2',
        [userId, expense.user_id]
      );
      hasAccess = teamCheck.rows.length > 0 || expense.user_id === userId;
    } else if (expense.user_id === userId) {
      // User can see their own expenses
      hasAccess = true;
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You do not have permission to view this expense'
      });
    }

    // Get approval chain
    const approvalsResult = await query(
      `SELECT 
        a.id,
        a.approver_id,
        a.sequence,
        a.status,
        a.comments,
        a.approved_at,
        a.created_at,
        u.name as approver_name,
        u.email as approver_email,
        u.role as approver_role
      FROM approvals a
      JOIN users u ON a.approver_id = u.id
      WHERE a.expense_id = $1
      ORDER BY a.sequence ASC`,
      [id]
    );

    res.json({
      expense: {
        id: expense.id,
        amount: expense.amount,
        original_amount: expense.original_amount,
        original_currency: expense.original_currency,
        company_currency: expense.company_currency,
        category: expense.category,
        description: expense.description,
        date: expense.date,
        status: expense.status,
        receipt_url: expense.receipt_url,
        created_at: expense.created_at,
        updated_at: expense.updated_at,
        submitter: {
          id: expense.user_id,
          name: expense.submitter_name,
          email: expense.submitter_email
        },
        company: {
          name: expense.company_name,
          currency: expense.company_currency
        }
      },
      approvals: approvalsResult.rows,
      current_approver: approvalsResult.rows.find(a => a.status === 'pending')
    });

  } catch (error) {
    console.error('Get expense by ID error:', error);
    res.status(500).json({
      error: 'Failed to fetch expense',
      details: error.message
    });
  }
};

/**
 * Get all expenses (role-based filtering)
 * @route GET /api/expenses
 * @access Authenticated
 */
const getAllExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const companyId = req.user.company_id;

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Filters
    const statusFilter = req.query.status; // 'pending', 'approved', 'rejected'
    const categoryFilter = req.query.category;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let queryText;
    let queryParams;
    let countQueryText;
    let countQueryParams;

    // Build WHERE conditions
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (userRole === 'admin') {
      // Admin sees all company expenses
      conditions.push(`e.company_id = $${paramCount}`);
      params.push(companyId);
      paramCount++;

    } else if (userRole === 'manager') {
      // Manager sees team expenses
      conditions.push(`(e.user_id IN (SELECT id FROM users WHERE manager_id = $${paramCount}) OR e.user_id = $${paramCount})`);
      params.push(userId);
      paramCount++;
      conditions.push(`e.company_id = $${paramCount}`);
      params.push(companyId);
      paramCount++;

    } else {
      // Employee sees only their expenses
      conditions.push(`e.user_id = $${paramCount}`);
      params.push(userId);
      paramCount++;
    }

    // Apply filters
    if (statusFilter) {
      conditions.push(`e.status = $${paramCount}`);
      params.push(statusFilter.toLowerCase());
      paramCount++;
    }

    if (categoryFilter) {
      conditions.push(`e.category ILIKE $${paramCount}`);
      params.push(`%${categoryFilter}%`);
      paramCount++;
    }

    if (startDate) {
      conditions.push(`e.date >= $${paramCount}`);
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      conditions.push(`e.date <= $${paramCount}`);
      params.push(endDate);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Main query
    queryText = `
      SELECT 
        e.*,
        u.name as submitter_name,
        u.email as submitter_email,
        (
          SELECT COUNT(*) 
          FROM approvals a 
          WHERE a.expense_id = e.id AND a.status = 'pending'
        ) as pending_approvals,
        (
          SELECT json_agg(
            json_build_object(
              'approver_name', u2.name,
              'status', a2.status,
              'sequence', a2.sequence
            ) ORDER BY a2.sequence
          )
          FROM approvals a2
          JOIN users u2 ON a2.approver_id = u2.id
          WHERE a2.expense_id = e.id
        ) as approval_summary
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY e.date DESC, e.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    queryParams = [...params, limit, offset];

    // Count query
    countQueryText = `
      SELECT COUNT(*) as total
      FROM expenses e
      ${whereClause}
    `;
    countQueryParams = params;

    // Execute queries
    const [expensesResult, countResult] = await Promise.all([
      query(queryText, queryParams),
      query(countQueryText, countQueryParams)
    ]);

    const totalExpenses = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalExpenses / limit);

    res.json({
      expenses: expensesResult.rows,
      pagination: {
        page,
        limit,
        total: totalExpenses,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        status: statusFilter || 'all',
        category: categoryFilter || 'all',
        startDate: startDate || null,
        endDate: endDate || null
      }
    });

  } catch (error) {
    console.error('Get all expenses error:', error);
    res.status(500).json({
      error: 'Failed to fetch expenses',
      details: error.message
    });
  }
};

module.exports = {
  submitExpense,
  getMyExpenses,
  getExpenseById,
  getAllExpenses
};
