const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const {
  submitExpense,
  getMyExpenses,
  getExpenseById,
  getAllExpenses
} = require('../controllers/expenseController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB default
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs only
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'), false);
    }
  }
});

// Expense Routes

/**
 * @route   POST /api/expenses
 * @desc    Submit a new expense with optional receipt upload
 * @access  Employee, Manager (authenticated)
 */
router.post('/', authenticateToken, upload.single('receipt'), submitExpense);

/**
 * @route   GET /api/expenses/my
 * @desc    Get all expenses for logged-in user with approval status
 * @access  Authenticated
 */
router.get('/my', authenticateToken, getMyExpenses);

/**
 * @route   GET /api/expenses/:id
 * @desc    Get expense by ID with full approval chain
 * @access  Authenticated (with role-based restrictions)
 */
router.get('/:id', authenticateToken, getExpenseById);

/**
 * @route   GET /api/expenses
 * @desc    Get all expenses with role-based filtering and pagination
 *          - Admin: all company expenses
 *          - Manager: team expenses
 *          - Employee: only their expenses
 * @access  Authenticated
 */
router.get('/', authenticateToken, getAllExpenses);

module.exports = router;
