# Expense Submission System - Complete Guide

## 📋 Overview

Complete expense submission functionality with automatic currency conversion, approval chain creation, and role-based access control.

---

## 🆕 Created Files

### 1. **utils/currencyConverter.js** - Currency Conversion Utility

#### Features:
✅ **Real-time currency conversion** using exchangerate-api.com  
✅ **1-hour caching** to minimize API calls  
✅ **Graceful error handling** with fallback to expired cache  
✅ **28 supported currencies** (USD, EUR, GBP, INR, etc.)  
✅ **Automatic rounding** to 2 decimal places  

#### Functions:
- `convertCurrency(amount, fromCurrency, toCurrency)` - Convert amounts
- `getSupportedCurrencies()` - Get list of 28 currencies
- `clearCache()` - Clear exchange rate cache
- `getCacheStats()` - Get cache statistics

#### Usage Example:
```javascript
const { convertCurrency } = require('./utils/currencyConverter');

// Convert 100 USD to EUR
const converted = await convertCurrency(100, 'USD', 'EUR');
console.log(converted); // e.g., 92.50
```

---

### 2. **controllers/expenseController.js** - Expense Management Logic

#### Functions Implemented:

**a) `submitExpense(req, res)` - Submit New Expense**
- ✅ Validates all required fields (amount, currency, category, date)
- ✅ Validates amount is positive number
- ✅ Validates date format
- ✅ Gets company currency from database
- ✅ **Converts amount to company currency** using `convertCurrency()`
- ✅ Stores both original and converted amounts
- ✅ Handles optional receipt file upload
- ✅ Creates expense with status 'pending'
- ✅ **Builds approval chain:**
  - If user has manager → adds manager as first approver (sequence 1)
  - Fetches additional approvers from `approvers` table
  - Creates approval records in sequence order
  - Auto-approves if admin with no approvers
- ✅ Uses SQL transaction for atomicity
- ✅ Deletes uploaded file if transaction fails
- ✅ Returns expense with full approval chain

**b) `getMyExpenses(req, res)` - Get User's Expenses**
- ✅ Gets all expenses for logged-in user
- ✅ Includes approval status for each expense
- ✅ Includes approver names using JSON aggregation
- ✅ Sorts by date descending
- ✅ Returns expense count

**c) `getExpenseById(req, res)` - Get Single Expense**
- ✅ Gets expense with submitter and company details
- ✅ **Role-based access control:**
  - Admin: can see all company expenses
  - Manager: can see team expenses (where submitter's manager_id = manager's id)
  - Employee: can only see own expenses
- ✅ Returns full approval chain with approver details
- ✅ Identifies current pending approver
- ✅ Includes currency information

**d) `getAllExpenses(req, res)` - Get All Expenses**
- ✅ **Role-based filtering:**
  - Admin: all company expenses
  - Manager: team expenses (submitters managed by them)
  - Employee: only their expenses
- ✅ **Pagination support:**
  - page, limit parameters
  - Returns total count and pages
  - hasNext, hasPrev flags
- ✅ **Filtering options:**
  - status (pending, approved, rejected)
  - category (partial match)
  - startDate, endDate (date range)
- ✅ Includes approval summary for each expense
- ✅ Shows pending approvals count

---

### 3. **routes/expenses.js** - Clean Route Definitions

#### Routes Implemented:
- ✅ `POST /api/expenses` - Submit expense (with file upload)
- ✅ `GET /api/expenses/my` - Get user's expenses
- ✅ `GET /api/expenses/:id` - Get expense by ID
- ✅ `GET /api/expenses` - Get all expenses (filtered)

#### Multer Configuration:
- ✅ File upload to `uploads/` directory
- ✅ Unique filename generation (timestamp + random)
- ✅ 5MB file size limit
- ✅ Accepts images and PDFs only
- ✅ Automatic directory creation

---

## 🔄 Approval Chain Logic

### How It Works:

1. **User submits expense** → Creates expense record with status 'pending'

2. **Check for manager:**
   - If user has `manager_id` → Create approval for manager (sequence 1)
   - Manager gets first approval responsibility

3. **Check for additional approvers:**
   - Query `approvers` table for company
   - Add each approver in sequence order
   - Skip if approver is same as manager (avoid duplicate)

4. **Special case:**
   - If no approvers found AND user is admin → Auto-approve

5. **Result:**
   - Expense has complete approval chain
   - Approvals created with status 'pending'
   - Each approval has sequence number for ordering

### Example Approval Chain:

```
Expense: $500 Travel Expense
├── Approval 1 (sequence: 1) - Manager John - Status: pending
├── Approval 2 (sequence: 2) - Finance Head - Status: pending
└── Approval 3 (sequence: 3) - CEO - Status: pending
```

---

## 💱 Currency Conversion

### Features:

**Automatic Conversion:**
- User submits expense in any currency (e.g., EUR)
- System fetches company's base currency (e.g., USD)
- Converts amount using real-time exchange rates
- Stores both original and converted amounts

**Caching Strategy:**
- Exchange rates cached for 1 hour
- Reduces API calls significantly
- Falls back to expired cache if API fails
- Cache key format: `{FROM}_{TO}` (e.g., `EUR_USD`)

**Error Handling:**
- API timeout: Uses cached rate if available
- Invalid currency: Returns clear error message
- Network error: Graceful fallback
- Same currency: No conversion needed (optimization)

### Example:

```javascript
// User submits: 100 EUR
// Company currency: USD
// Exchange rate: 1 EUR = 1.10 USD

Stored in database:
{
  amount: 110.00,              // Converted to company currency
  original_amount: 100.00,     // Original amount
  original_currency: 'EUR'     // Original currency
}
```

---

## 🔒 Security & Validation

### Input Validation:
✅ Amount must be positive number  
✅ Currency code must be 3 characters  
✅ Category is required  
✅ Date must be valid format  
✅ File must be image or PDF  
✅ File size max 5MB  

### Access Control:
✅ **Submit expense**: Employee, Manager (authenticated)  
✅ **View own expenses**: All authenticated users  
✅ **View team expenses**: Manager, Admin  
✅ **View all expenses**: Admin only  

### SQL Security:
✅ Parameterized queries prevent SQL injection  
✅ Transactions ensure data consistency  
✅ Foreign key constraints maintain referential integrity  

---

## 📊 API Examples

### 1. Submit Expense

```bash
POST /api/expenses
Content-Type: multipart/form-data
Authorization: Bearer {token}

Form Data:
- amount: 250.50
- currency: EUR
- category: Travel
- description: Client meeting in Paris
- date: 2025-10-04
- receipt: [file]

Response:
{
  "message": "Expense submitted successfully",
  "expense": {
    "id": "uuid",
    "amount": 275.55,              // Converted to USD
    "original_amount": 250.50,
    "original_currency": "EUR",
    "company_currency": "USD",
    "category": "Travel",
    "description": "Client meeting in Paris",
    "date": "2025-10-04",
    "status": "pending",
    "receipt_url": "/uploads/1728012345-123456789.jpg",
    "created_at": "2025-10-04T10:30:00Z",
    "submitter": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@company.com"
    }
  },
  "approval_chain": [
    {
      "id": "approval-uuid-1",
      "approver_id": "manager-uuid",
      "approver_name": "Jane Manager",
      "approver_email": "jane@company.com",
      "approver_role": "manager",
      "sequence": 1,
      "status": "pending"
    },
    {
      "id": "approval-uuid-2",
      "approver_id": "admin-uuid",
      "approver_name": "Bob Admin",
      "approver_email": "bob@company.com",
      "approver_role": "admin",
      "sequence": 2,
      "status": "pending"
    }
  ],
  "next_approver": {
    "approver_name": "Jane Manager",
    "sequence": 1
  }
}
```

### 2. Get My Expenses

```bash
GET /api/expenses/my
Authorization: Bearer {token}

Response:
{
  "expenses": [
    {
      "id": "uuid",
      "amount": 275.55,
      "category": "Travel",
      "status": "pending",
      "date": "2025-10-04",
      "approvals": [
        {
          "approver_name": "Jane Manager",
          "status": "pending",
          "sequence": 1
        }
      ]
    }
  ],
  "count": 1
}
```

### 3. Get All Expenses (with filters)

```bash
GET /api/expenses?page=1&limit=10&status=pending&category=Travel&startDate=2025-10-01
Authorization: Bearer {token}

Response:
{
  "expenses": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "status": "pending",
    "category": "Travel",
    "startDate": "2025-10-01",
    "endDate": null
  }
}
```

### 4. Get Expense by ID

```bash
GET /api/expenses/:id
Authorization: Bearer {token}

Response:
{
  "expense": {
    "id": "uuid",
    "amount": 275.55,
    "original_amount": 250.50,
    "original_currency": "EUR",
    "company_currency": "USD",
    "category": "Travel",
    "description": "Client meeting",
    "date": "2025-10-04",
    "status": "pending",
    "receipt_url": "/uploads/file.jpg",
    "submitter": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@company.com"
    },
    "company": {
      "name": "Tech Corp",
      "currency": "USD"
    }
  },
  "approvals": [
    {
      "id": "approval-uuid",
      "approver_name": "Jane Manager",
      "sequence": 1,
      "status": "pending",
      "comments": null,
      "approved_at": null
    }
  ],
  "current_approver": {
    "approver_name": "Jane Manager",
    "sequence": 1,
    "status": "pending"
  }
}
```

---

## 🧪 Testing Guide

### Test Scenarios:

1. **Submit expense in different currency**
   - Submit in EUR, verify conversion to company USD
   - Check both amounts stored correctly

2. **Approval chain creation**
   - Submit as employee with manager
   - Verify manager approval created
   - Verify additional approvers added

3. **Role-based access**
   - Employee: Can only see own expenses
   - Manager: Can see team expenses
   - Admin: Can see all expenses

4. **File upload**
   - Upload image receipt
   - Upload PDF receipt
   - Try invalid file type (should fail)
   - Try oversized file (should fail)

5. **Pagination and filters**
   - Test page navigation
   - Filter by status
   - Filter by category
   - Filter by date range

---

## 📦 Dependencies Added

```json
{
  "axios": "^1.6.2"  // For currency conversion API calls
}
```

---

## ✅ Summary

### What's Complete:

✅ **Currency Conversion System**
- Real-time exchange rates
- 28 supported currencies
- 1-hour caching
- Error handling with fallback

✅ **Expense Submission**
- Multi-currency support
- File upload (receipts)
- Automatic approval chain creation
- Transaction safety

✅ **Expense Retrieval**
- Role-based filtering
- Pagination support
- Multiple filter options
- Approval status tracking

✅ **Security**
- Input validation
- Role-based access control
- SQL injection prevention
- File type validation

### Key Features:

1. **Automatic Currency Conversion** - Seamless multi-currency support
2. **Smart Approval Chain** - Automatic creation based on hierarchy
3. **Role-Based Access** - Proper data isolation
4. **Comprehensive Filtering** - Status, category, date range
5. **File Upload Support** - Receipt management
6. **Transaction Safety** - Rollback on errors

---

**The expense submission system is now complete and production-ready!** 🎉
