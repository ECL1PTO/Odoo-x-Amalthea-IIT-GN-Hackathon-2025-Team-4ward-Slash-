# 🧪 Testing & Debugging Guide - Expense Management Backend

## ⚠️ IMPORTANT: Prerequisites Check

Before testing, ensure you have:

### 1. **Node.js & npm Installed**
```bash
# Check if installed
node --version  # Should show v16+ or v18+
npm --version   # Should show v8+

# If not installed, download from:
# https://nodejs.org/ (LTS version recommended)
```

### 2. **PostgreSQL Installed & Running**
```bash
# Check if installed
psql --version  # Should show PostgreSQL 12+

# Check if running
pg_isready

# If not running:
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql
```

---

## 🚀 STEP-BY-STEP SETUP

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

**Expected Output:**
```
added 150+ packages in 30s
```

**If you see errors:**
- `npm ERR! code ENOENT` → Node.js not installed
- `npm ERR! peer dep missing` → Run `npm install --legacy-peer-deps`

---

### Step 2: Setup Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit .env file with your values
nano .env  # or use any text editor
```

**Required values in .env:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=expense_management
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password
JWT_SECRET=generate_a_random_secret_key_here
JWT_EXPIRES_IN=24h
PORT=5000
NODE_ENV=development
MAX_FILE_SIZE=5242880
UPLOAD_DIR=uploads/
FRONTEND_URL=http://localhost:5173
```

**Generate JWT Secret:**
```bash
# Option 1: Use OpenSSL
openssl rand -base64 32

# Option 2: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Use online generator
# https://randomkeygen.com/
```

---

### Step 3: Setup Database

```bash
# Create database
createdb expense_management

# Or using psql
psql -U postgres
CREATE DATABASE expense_management;
\q

# Run schema
psql -U your_username -d expense_management -f ../database/schema.sql
```

**Expected Output:**
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
...
```

**If you see errors:**
- `database "expense_management" already exists` → OK, continue
- `permission denied` → Check PostgreSQL user permissions
- `psql: command not found` → PostgreSQL not installed

---

### Step 4: Verify File Structure

```bash
# Check all required files exist
ls -R src/

# Should show:
src/
├── controllers/
│   ├── approvalController.js
│   ├── configController.js
│   ├── expenseController.js
│   └── userController.js
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   └── notFound.js
├── routes/
│   ├── approvals.js
│   ├── auth.js
│   ├── companies.js
│   ├── config.js
│   ├── expenses.js
│   └── users.js
├── utils/
│   ├── currencyConverter.js
│   └── database.js
└── server.js
```

---

## 🧪 TESTING PHASE 1: Syntax & Import Checks

### Test 1: Check for Syntax Errors

```bash
# Check server.js
node --check src/server.js

# Check all controllers
node --check src/controllers/*.js

# Check all routes
node --check src/routes/*.js

# Check all middleware
node --check src/middleware/*.js

# Check all utils
node --check src/utils/*.js
```

**Expected Output:**
```
(no output means success)
```

**If you see errors:**
- `SyntaxError: Unexpected token` → Fix the syntax error
- `Cannot find module` → Missing dependency or wrong path

---

### Test 2: Start Server (Dry Run)

```bash
npm run dev
```

**Expected Output:**
```
✅ Database connected successfully
🚀 Server running on port 5000
📱 Frontend URL: http://localhost:5173
🔗 API Base URL: http://localhost:5000/api
```

**Common Errors & Fixes:**

#### Error: "Cannot find module 'express'"
```bash
# Fix: Install dependencies
npm install
```

#### Error: "connect ECONNREFUSED 127.0.0.1:5432"
```bash
# Fix: Start PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux
```

#### Error: "password authentication failed"
```bash
# Fix: Check .env credentials
# Make sure DB_USER and DB_PASSWORD match your PostgreSQL setup
```

#### Error: "database 'expense_management' does not exist"
```bash
# Fix: Create database
createdb expense_management
psql -d expense_management -f ../database/schema.sql
```

#### Error: "Port 5000 is already in use"
```bash
# Fix: Change port in .env or kill existing process
lsof -ti:5000 | xargs kill -9
```

---

## 🧪 TESTING PHASE 2: API Endpoints

### Test 1: Health Check ✅

```bash
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-10-04T11:12:00.000Z",
  "environment": "development"
}
```

**If fails:**
- Server not running → Start with `npm run dev`
- Wrong port → Check PORT in .env

---

### Test 2: Register Company & Admin 🏢

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Admin",
    "email": "admin@test.com",
    "password": "Admin123!",
    "role": "admin",
    "companyName": "Test Corp",
    "companyCurrency": "USD"
  }'
```

**Expected Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid-here",
    "name": "Test Admin",
    "email": "admin@test.com",
    "role": "admin"
  },
  "company": {
    "id": "uuid-here",
    "name": "Test Corp",
    "currency": "USD"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Save the token!** Export it:
```bash
export ADMIN_TOKEN="paste_token_here"
```

**Common Errors:**

#### "Email already exists"
```bash
# Fix: Use different email or delete existing user
psql -d expense_management -c "DELETE FROM users WHERE email='admin@test.com';"
```

#### "Missing required fields"
```bash
# Fix: Check JSON syntax, ensure all fields present
```

---

### Test 3: Login 🔐

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Admin123!"
  }'
```

**Expected Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "Test Admin",
    "email": "admin@test.com",
    "role": "admin"
  }
}
```

---

### Test 4: Create Manager User 👤

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Test Manager",
    "email": "manager@test.com",
    "password": "Manager123!",
    "role": "manager"
  }'
```

**Expected Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "name": "Test Manager",
    "email": "manager@test.com",
    "role": "manager"
  }
}
```

**Save Manager ID:**
```bash
export MANAGER_ID="paste_manager_id_here"
```

---

### Test 5: Create Employee User 👤

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Test Employee",
    "email": "employee@test.com",
    "password": "Employee123!",
    "role": "employee",
    "managerId": "'$MANAGER_ID'"
  }'
```

**Save Employee Token:**
```bash
# Login as employee
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@test.com",
    "password": "Employee123!"
  }'

export EMPLOYEE_TOKEN="paste_employee_token_here"
```

---

### Test 6: Add Approvers ⚙️

```bash
# Add Manager as first approver
curl -X POST http://localhost:5000/api/config/approvers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "userId": "'$MANAGER_ID'",
    "roleName": "Department Manager",
    "sequence": 1
  }'
```

**Expected Response:**
```json
{
  "message": "Approver added successfully",
  "approver": {
    "id": "uuid",
    "user_id": "manager-uuid",
    "user_name": "Test Manager",
    "role_name": "Department Manager",
    "sequence": 1,
    "is_active": true
  }
}
```

---

### Test 7: Submit Expense 💰

```bash
# Create a test receipt file
echo "Test Receipt" > test-receipt.txt

# Submit expense
curl -X POST http://localhost:5000/api/expenses \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
  -F "amount=100.50" \
  -F "currency=USD" \
  -F "category=Travel" \
  -F "description=Test expense" \
  -F "date=2025-10-04" \
  -F "receipt=@test-receipt.txt"
```

**Expected Response:**
```json
{
  "message": "Expense submitted successfully",
  "expense": {
    "id": "expense-uuid",
    "amount": 100.50,
    "original_amount": 100.50,
    "original_currency": "USD",
    "company_currency": "USD",
    "category": "Travel",
    "status": "pending"
  },
  "approval_chain": [
    {
      "approver_name": "Test Manager",
      "sequence": 1,
      "status": "pending"
    }
  ]
}
```

**Save Expense ID and Approval ID:**
```bash
export EXPENSE_ID="paste_expense_id_here"
export APPROVAL_ID="paste_approval_id_here"
```

---

### Test 8: Get Pending Approvals 📋

```bash
# Login as manager
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@test.com",
    "password": "Manager123!"
  }'

export MANAGER_TOKEN="paste_manager_token_here"

# Get pending approvals
curl -X GET http://localhost:5000/api/approvals/pending \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

**Expected Response:**
```json
{
  "pending_approvals": [
    {
      "approval_id": "uuid",
      "sequence": 1,
      "expense": {
        "amount": 100.50,
        "category": "Travel",
        "description": "Test expense"
      },
      "submitter": {
        "name": "Test Employee",
        "email": "employee@test.com"
      }
    }
  ],
  "count": 1
}
```

---

### Test 9: Approve Expense ✅

```bash
curl -X POST http://localhost:5000/api/approvals/$APPROVAL_ID/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{
    "comments": "Approved - test"
  }'
```

**Expected Response:**
```json
{
  "message": "Expense approved successfully",
  "approval": {
    "status": "approved",
    "comments": "Approved - test"
  },
  "expense": {
    "status": "approved",
    "fully_approved": true
  }
}
```

---

### Test 10: Get Approval History 📊

```bash
curl -X GET http://localhost:5000/api/approvals/expense/$EXPENSE_ID \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"
```

**Expected Response:**
```json
{
  "expense": {
    "id": "expense-uuid",
    "amount": 100.50,
    "category": "Travel",
    "status": "approved"
  },
  "approvals": [
    {
      "sequence": 1,
      "status": "approved",
      "approver_name": "Test Manager",
      "comments": "Approved - test",
      "approved_at": "2025-10-04T11:00:00Z"
    }
  ],
  "statistics": {
    "total": 1,
    "approved": 1,
    "rejected": 0,
    "pending": 0,
    "completion_percentage": 100
  }
}
```

---

## 🐛 COMMON BUGS & FIXES

### Bug 1: Currency Conversion Fails

**Symptom:**
```json
{
  "error": "Currency conversion failed",
  "details": "Currency conversion service unavailable"
}
```

**Debug:**
```bash
# Test currency API directly
curl https://api.exchangerate-api.com/v4/latest/USD
```

**Fix:**
- Check internet connection
- API might be rate-limited (uses cache for 1 hour)
- Submit expense in company currency (USD) to bypass conversion

---

### Bug 2: Sequential Approval Violation

**Symptom:**
```json
{
  "error": "Sequential approval violation",
  "details": "Approval sequence 1 must be approved first"
}
```

**This is correct behavior!** Cannot skip approval sequences.

**Fix:**
- Approve in order: sequence 1, then 2, then 3
- Check pending approvals to see current sequence

---

### Bug 3: Token Expired

**Symptom:**
```json
{
  "error": "Token expired"
}
```

**Fix:**
```bash
# Login again to get new token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin123!"}'
```

---

### Bug 4: File Upload Fails

**Symptom:**
```json
{
  "error": "Only image and PDF files are allowed"
}
```

**Fix:**
- Use image files (.jpg, .png, .gif) or PDF
- Check file size < 5MB
- Use correct form field name: `receipt`

---

### Bug 5: Cannot Remove Approver

**Symptom:**
```json
{
  "error": "Cannot remove approver",
  "details": "Approver has 3 pending approval(s)"
}
```

**This is correct behavior!** Safety check.

**Fix:**
- Complete or reassign pending approvals first
- Or wait until approvals are processed

---

## 📊 AUTOMATED TEST SCRIPT

Create `test-backend.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Expense Management Backend"
echo "======================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:5000"

# Test 1: Health Check
echo -n "Test 1: Health Check... "
RESPONSE=$(curl -s $BASE_URL/health)
if echo "$RESPONSE" | grep -q "OK"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $RESPONSE"
fi

# Test 2: Register
echo -n "Test 2: Register... "
RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Auto Test Admin",
    "email": "autotest@test.com",
    "password": "Test123!",
    "role": "admin",
    "companyName": "Auto Test Corp",
    "companyCurrency": "USD"
  }')

if echo "$RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✓ PASS${NC}"
    TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $RESPONSE"
fi

# Test 3: Login
echo -n "Test 3: Login... "
RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "autotest@test.com",
    "password": "Test123!"
  }')

if echo "$RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $RESPONSE"
fi

echo ""
echo "======================================"
echo "Testing complete!"
```

**Run it:**
```bash
chmod +x test-backend.sh
./test-backend.sh
```

---

## ✅ FINAL CHECKLIST

Before declaring backend complete:

- [ ] All dependencies installed (`npm install`)
- [ ] Database created and schema loaded
- [ ] `.env` file configured with correct values
- [ ] Server starts without errors
- [ ] Health check returns OK
- [ ] Can register company + admin
- [ ] Can login and get token
- [ ] Can create users (manager, employee)
- [ ] Can add approvers
- [ ] Can submit expense with file upload
- [ ] Currency conversion works
- [ ] Approval chain created correctly
- [ ] Manager sees pending approvals
- [ ] Can approve in sequential order
- [ ] Can reject expense
- [ ] Can view approval history
- [ ] Can set approval rules
- [ ] Role-based access control works
- [ ] Error messages are clear
- [ ] No console errors or warnings

---

## 📞 TROUBLESHOOTING SUPPORT

If you encounter issues:

1. **Check server logs** - Look at terminal where server is running
2. **Check database** - Use `psql` to query tables
3. **Check .env** - Verify all values are correct
4. **Check file permissions** - Ensure uploads/ directory is writable
5. **Check ports** - Ensure 5000 is not in use

**Common Commands:**
```bash
# View server logs
npm run dev

# Check database
psql -d expense_management -c "SELECT * FROM users;"

# Check uploads directory
ls -la uploads/

# Check port usage
lsof -i :5000
```

---

**Your backend is ready for testing!** 🚀
