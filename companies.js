const express = require('express');
const Joi = require('joi');
const { query } = require('../utils/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const createCompanySchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  country: Joi.string().min(2).max(100).required(),
  currency: Joi.string().length(3).default('USD')
});

// Get all companies
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, country, currency, created_at FROM companies ORDER BY name'
    );

    res.json({ companies: result.rows });
  } catch (error) {
    console.error('Fetch companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get company by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT id, name, country, currency, created_at FROM companies WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company: result.rows[0] });
  } catch (error) {
    console.error('Fetch company error:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Create company
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error, value } = createCompanySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, country, currency } = value;

    // Check if company name already exists
    const existingCompany = await query(
      'SELECT id FROM companies WHERE name = $1',
      [name]
    );

    if (existingCompany.rows.length > 0) {
      return res.status(400).json({ error: 'Company name already exists' });
    }

    const result = await query(
      'INSERT INTO companies (name, country, currency) VALUES ($1, $2, $3) RETURNING *',
      [name, country, currency]
    );

    res.status(201).json({
      message: 'Company created successfully',
      company: result.rows[0]
    });

  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Update company
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = createCompanySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, country, currency } = value;

    // Check if company exists
    const existingCompany = await query(
      'SELECT id FROM companies WHERE id = $1',
      [id]
    );

    if (existingCompany.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if new name conflicts with existing companies
    const nameConflict = await query(
      'SELECT id FROM companies WHERE name = $1 AND id != $2',
      [name, id]
    );

    if (nameConflict.rows.length > 0) {
      return res.status(400).json({ error: 'Company name already exists' });
    }

    const result = await query(
      `UPDATE companies
       SET name = $1, country = $2, currency = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, country, currency, id]
    );

    res.json({
      message: 'Company updated successfully',
      company: result.rows[0]
    });

  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if company exists
    const existingCompany = await query(
      'SELECT id FROM companies WHERE id = $1',
      [id]
    );

    if (existingCompany.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if company has users
    const usersCount = await query(
      'SELECT COUNT(*) as count FROM users WHERE company_id = $1',
      [id]
    );

    if (usersCount.rows[0].count > 0) {
      return res.status(400).json({
        error: 'Cannot delete company with existing users'
      });
    }

    await query('DELETE FROM companies WHERE id = $1', [id]);

    res.json({ message: 'Company deleted successfully' });

  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

module.exports = router;
