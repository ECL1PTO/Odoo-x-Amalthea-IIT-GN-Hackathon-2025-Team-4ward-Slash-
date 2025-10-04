# 📚 API Quick Reference - For Frontend Team

## 🔗 Base URL
```
http://localhost:5000/api
```

---

## 🔐 Authentication

All protected endpoints require:
```
Authorization: Bearer {token}
```

Get token from `/auth/login` or `/auth/register` response.

---

## 📋 API Endpoints Summary

### **Authentication**
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/register` | Public | Register company & admin |
| POST | `/auth/login` | Public | Login user |

### **Users**
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/users` | Admin | Create user |
| GET | `/users` | Admin | Get all users |
| GET | `/users/:id` | Admin | Get user by ID |
| PUT | `/users/:id` | Admin | Update user |
| DELETE | `/users/:id` | Admin | Delete user |

### **Expenses**
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/expenses` | Employee, Manager | Submit expense |
| GET | `/expenses/my` | Authenticated | Get my expenses |
| GET | `/expenses/:id` | Authenticated | Get expense by ID |
| GET | `/expenses` | Authenticated | Get all expenses (filtered) |

### **Approvals**
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/approvals/pending` | Manager, Admin | Get pending approvals |
| POST | `/approvals/:id/approve` | Manager, Admin | Approve expense |
| POST | `/approvals/:id/reject` | Manager, Admin | Reject expense |
| GET | `/approvals/expense/:expenseId` | Authenticated | Get approval history |

### **Configuration**
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/config/approvers` | Admin | Add approver |
| GET | `/config/approvers` | Admin | Get all approvers |
| PUT | `/config/approvers/:id` | Admin | Update approver sequence |
| DELETE | `/config/approvers/:id` | Admin | Remove approver |
| POST | `/config/rules` | Admin | Set approval rule |
| GET | `/config/rules` | Admin | Get approval rules |

---

## 📝 Request/Response Examples

### 1. Register Company & Admin

**Request:**
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Admin",
  "email": "admin@company.com",
  "password": "Admin123!",
  "role": "admin",
  "companyName": "Tech Corp",
  "companyCurrency": "USD"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "name": "John Admin",
    "email": "admin@company.com",
    "role": "admin"
  },
  "company": {
    "id": "uuid",
    "name": "Tech Corp",
    "currency": "USD"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2. Login

**Request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "Admin123!"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "John Admin",
    "email": "admin@company.com",
    "role": "admin",
    "company_id": "uuid"
  }
}
```

---

### 3. Submit Expense (with file)

**Request:**
```http
POST /api/expenses
Authorization: Bearer {token}
Content-Type: multipart/form-data

amount: 250.50
currency: EUR
category: Travel
description: Client meeting in Paris
date: 2025-10-04
receipt: [file]
```

**Response:**
```json
{
  "message": "Expense submitted successfully",
  "expense": {
    "id": "uuid",
    "amount": 275.55,
    "original_amount": 250.50,
    "original_currency": "EUR",
    "company_currency": "USD",
    "category": "Travel",
    "description": "Client meeting in Paris",
    "status": "pending",
    "receipt_url": "/uploads/file.jpg"
  },
  "approval_chain": [
    {
      "id": "approval-uuid",
      "approver_name": "Jane Manager",
      "sequence": 1,
      "status": "pending"
    }
  ],
  "next_approver": {
    "approver_name": "Jane Manager",
    "sequence": 1
  }
}
```

---

### 4. Get Pending Approvals

**Request:**
```http
GET /api/approvals/pending
Authorization: Bearer {manager_token}
```

**Response:**
```json
{
  "pending_approvals": [
    {
      "approval_id": "uuid",
      "sequence": 1,
      "expense": {
        "id": "expense-uuid",
        "amount": 275.55,
        "category": "Travel",
        "description": "Client meeting"
      },
      "submitter": {
        "name": "Bob Employee",
        "email": "bob@company.com"
      },
      "approval_context": {
        "total_approvals": 2,
        "approved_count": 0,
        "current_sequence": 1
      }
    }
  ],
  "count": 1
}
```

---

### 5. Approve Expense

**Request:**
```http
POST /api/approvals/{approval_id}/approve
Authorization: Bearer {manager_token}
Content-Type: application/json

{
  "comments": "Approved - valid business expense"
}
```

**Response:**
```json
{
  "message": "Expense approved successfully",
  "approval": {
    "id": "approval-uuid",
    "status": "approved",
    "comments": "Approved - valid business expense"
  },
  "expense": {
    "id": "expense-uuid",
    "status": "pending",
    "fully_approved": false
  },
  "next_approver": {
    "name": "John Admin",
    "sequence": 2
  }
}
```

---

## 🎨 Frontend Integration Tips

### 1. **Store Token in LocalStorage**
```javascript
// After login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const data = await response.json();
localStorage.setItem('token', data.token);
localStorage.setItem('user', JSON.stringify(data.user));
```

### 2. **Add Token to Requests**
```javascript
const token = localStorage.getItem('token');

const response = await fetch('/api/expenses/my', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 3. **File Upload**
```javascript
const formData = new FormData();
formData.append('amount', '100.50');
formData.append('currency', 'USD');
formData.append('category', 'Travel');
formData.append('description', 'Business trip');
formData.append('date', '2025-10-04');
formData.append('receipt', fileInput.files[0]);

const response = await fetch('/api/expenses', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### 4. **Handle Errors**
```javascript
const response = await fetch('/api/expenses', options);

if (!response.ok) {
  const error = await response.json();
  
  if (response.status === 401) {
    // Token expired, redirect to login
    localStorage.removeItem('token');
    window.location.href = '/login';
  } else {
    // Show error message
    alert(error.error || 'An error occurred');
  }
}
```

### 5. **Role-Based UI**
```javascript
const user = JSON.parse(localStorage.getItem('user'));

// Show/hide based on role
if (user.role === 'admin') {
  // Show admin panel
}

if (user.role === 'manager' || user.role === 'admin') {
  // Show approval section
}

if (user.role === 'employee') {
  // Show submit expense form
}
```

---

## 🎯 User Roles & Permissions

### **Employee**
- ✅ Submit expenses
- ✅ View own expenses
- ✅ View own approval history
- ❌ Cannot approve
- ❌ Cannot access admin settings

### **Manager**
- ✅ All employee permissions
- ✅ Approve/reject expenses
- ✅ View team expenses
- ✅ View pending approvals
- ❌ Cannot access admin settings

### **Admin**
- ✅ All manager permissions
- ✅ Create/manage users
- ✅ Add/remove approvers
- ✅ Set approval rules
- ✅ View all company expenses

---

## 📊 Expense Status Flow

```
Employee submits → Status: "pending"
↓
Manager approves → Status: "pending" (if more approvers)
↓
Admin approves → Status: "approved" (if last approver)

OR

Any approver rejects → Status: "rejected" (immediately)
```

---

## 🔄 Approval Chain Logic

**Sequential Approval:**
- Must approve in order (sequence 1, then 2, then 3)
- Cannot skip sequences
- Manager only sees their sequence when ready

**Example:**
```
Sequence 1: Manager (pending) ← Shows to Manager
Sequence 2: Finance (pending) ← Hidden until Seq 1 approves
Sequence 3: CEO (pending) ← Hidden until Seq 2 approves
```

---

## 💱 Currency Conversion

- System automatically converts to company currency
- Stores both original and converted amounts
- Uses real-time exchange rates (cached 1 hour)
- Supports 28 currencies

**Example:**
```
Employee submits: 100 EUR
Company currency: USD
System converts: 100 EUR → 110 USD (approx)

Stored:
- original_amount: 100
- original_currency: EUR
- amount: 110 (in USD)
```

---

## ⚠️ Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check request body/params |
| 401 | Unauthorized | Token missing/invalid - login again |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Contact backend team |

---

## 🧪 Testing with Postman

1. **Import Collection:**
   - File: `Expense_Management_API.postman_collection.json`
   - Import into Postman

2. **Set Variables:**
   - `baseUrl`: `http://localhost:5000`
   - Tokens auto-save after login

3. **Run in Order:**
   - Health Check
   - Register Company
   - Create Users
   - Add Approvers
   - Submit Expense
   - Approve Expense

---

## 📞 Need Help?

**Common Issues:**

1. **"Token expired"** → Login again
2. **"Access denied"** → Check user role
3. **"Sequential approval violation"** → Approve in order
4. **"Currency conversion failed"** → Check internet or use company currency

**Backend Team Contact:**
- Check `TESTING_AND_DEBUG_GUIDE.md` for detailed debugging
- Check server logs for errors
- Verify database connection

---

## ✅ Frontend Checklist

- [ ] Login/Register pages
- [ ] Dashboard (role-based)
- [ ] Submit expense form (with file upload)
- [ ] My expenses list
- [ ] Expense details page
- [ ] Pending approvals (manager/admin)
- [ ] Approve/reject buttons
- [ ] Approval history view
- [ ] Admin settings (users, approvers, rules)
- [ ] Error handling
- [ ] Loading states
- [ ] Token refresh/logout

---

**Happy Coding! 🚀**
