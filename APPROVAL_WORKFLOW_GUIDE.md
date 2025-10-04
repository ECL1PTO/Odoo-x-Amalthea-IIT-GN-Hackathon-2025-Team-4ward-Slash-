# Approval Workflow System - Complete Guide

## 📋 Overview

Complete approval workflow functionality with sequential approval logic, conditional rules, and comprehensive validation.

---

## 🆕 Created Files

### 1. **controllers/approvalController.js** (600+ lines)

Complete approval workflow logic with four main functions.

---

## 🔄 Functions Implemented

### **a) `getPendingApprovals(req, res)` - Get Pending Approvals**

#### What It Does:
✅ Gets all expenses waiting for current user's approval  
✅ Filters by sequential approval logic  
✅ Only shows approvals where ALL previous sequences are approved  
✅ Shows expense in company's default currency  
✅ Includes complete context for decision making  

#### Sequential Approval Logic:
```
Expense has 3 approvers:
├── Sequence 1: Manager (approved) ✓
├── Sequence 2: Finance Head (pending) ← Shows to Finance Head
└── Sequence 3: CEO (pending) ← Hidden until Sequence 2 approves
```

#### Blocking Logic:
- Counts approvals with `sequence < current_sequence` AND `status != 'approved'`
- If count > 0, approval is blocked (not shown)
- Only shows approvals ready for action

#### Response Includes:
- **Approval details**: ID, sequence, created date
- **Expense details**: Amount (converted), category, description, date, receipt
- **Submitter info**: Name, email
- **Company info**: Name, currency
- **Approval context**:
  - Total approvals needed
  - How many already approved
  - Current sequence number
  - Previous approvers with their decisions

#### Example Response:
```json
{
  "pending_approvals": [
    {
      "approval_id": "uuid",
      "sequence": 2,
      "expense": {
        "id": "expense-uuid",
        "amount": 275.55,
        "original_amount": 250.50,
        "original_currency": "EUR",
        "company_currency": "USD",
        "category": "Travel",
        "description": "Client meeting",
        "date": "2025-10-04",
        "receipt_url": "/uploads/file.jpg"
      },
      "submitter": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@company.com"
      },
      "company": {
        "name": "Tech Corp",
        "currency": "USD"
      },
      "approval_context": {
        "total_approvals": 3,
        "approved_count": 1,
        "current_sequence": 2,
        "previous_approvers": [
          {
            "name": "Jane Manager",
            "status": "approved",
            "approved_at": "2025-10-04T10:00:00Z",
            "comments": "Approved - valid expense"
          }
        ]
      },
      "created_at": "2025-10-04T09:30:00Z"
    }
  ],
  "count": 1
}
```

---

### **b) `approveExpense(req, res)` - Approve Expense**

#### Validation Steps:
1. ✅ **Approval exists** - Check approval record exists
2. ✅ **User is approver** - Validate `approver_id === current_user.id`
3. ✅ **Approval is pending** - Cannot approve already processed approval
4. ✅ **Expense is pending** - Cannot approve rejected/approved expense
5. ✅ **Sequential validation** - All previous sequences must be approved

#### Sequential Approval Validation:
```sql
SELECT id, status, sequence
FROM approvals
WHERE expense_id = $1 AND sequence < $2
ORDER BY sequence ASC
```
- If ANY previous approval is not 'approved' → Reject with error
- Error: "Sequential approval violation: Approval sequence X must be approved first"

#### Approval Process:
1. **Update approval** to 'approved' with timestamp and comments
2. **Check remaining approvals**:
   - Query for approvals with `sequence > current_sequence`
   - If none exist → Expense is fully approved
   - If exist → Check if all are approved
3. **Apply conditional rules** (if configured):
   - **Percentage rule**: Check if X% of approvers have approved
   - **Specific approver rule**: Check if special approver approved
4. **Update expense status**:
   - If fully approved → Set expense status to 'approved'
   - Otherwise → Keep as 'pending'

#### Conditional Rules Support:
```javascript
// Percentage Rule Example
{
  "rule_type": "percentage",
  "rule_config": {
    "required_percentage": 75  // 75% approval needed
  }
}

// If 3 out of 4 approvers approve (75%), expense auto-approves
```

#### Response:
```json
{
  "message": "Expense approved successfully",
  "approval": {
    "id": "approval-uuid",
    "expense_id": "expense-uuid",
    "sequence": 2,
    "status": "approved",
    "comments": "Approved - valid business expense",
    "approved_at": "2025-10-04T11:00:00Z",
    "approver": {
      "name": "Finance Head",
      "email": "finance@company.com"
    }
  },
  "expense": {
    "id": "expense-uuid",
    "status": "pending",  // or "approved" if fully approved
    "fully_approved": false  // or true
  },
  "next_approver": {
    "name": "CEO",
    "email": "ceo@company.com",
    "sequence": 3
  }
}
```

---

### **c) `rejectExpense(req, res)` - Reject Expense**

#### Validation Steps:
1. ✅ **Comments required** - Must provide rejection reason
2. ✅ **Approval exists** - Check approval record exists
3. ✅ **User is approver** - Validate `approver_id === current_user.id`
4. ✅ **Approval is pending** - Cannot reject already processed approval
5. ✅ **Expense is pending** - Cannot reject already rejected/approved expense

#### Rejection Process:
1. **Update approval** to 'rejected' with comments and timestamp
2. **Update expense** status to 'rejected'
3. **Reject all other pending approvals**:
   - Sets status to 'rejected'
   - Adds comment: "Rejected due to prior rejection in approval chain"
   - No further approvals needed

#### Cascade Effect:
```
Expense with 3 approvers:
├── Sequence 1: Manager (approved) ✓
├── Sequence 2: Finance Head (REJECTS) ✗
└── Sequence 3: CEO (auto-rejected) ✗

Result: Expense status = 'rejected'
```

#### Response:
```json
{
  "message": "Expense rejected successfully",
  "approval": {
    "id": "approval-uuid",
    "expense_id": "expense-uuid",
    "sequence": 2,
    "status": "rejected",
    "comments": "Insufficient documentation provided",
    "approved_at": "2025-10-04T11:00:00Z",
    "approver": {
      "name": "Finance Head",
      "email": "finance@company.com"
    }
  },
  "expense": {
    "id": "expense-uuid",
    "status": "rejected",
    "submitter": {
      "name": "John Doe",
      "email": "john@company.com"
    }
  }
}
```

---

### **d) `getApprovalHistory(req, res)` - Get Approval History**

#### Access Control:
- **Admin**: Can see all company expenses
- **Manager**: Can see team expenses OR expenses they're approving
- **Employee**: Can see own expenses only

#### Access Validation:
```javascript
if (admin && same_company) → Allow
if (manager && (team_member || is_approver || own_expense)) → Allow
if (employee && own_expense) → Allow
else → Deny
```

#### Response Includes:
- **Expense summary**: ID, amount, category, status, submitter
- **All approvals**: Ordered by sequence
- **Approval statistics**: Total, approved, rejected, pending, completion %

#### Example Response:
```json
{
  "expense": {
    "id": "expense-uuid",
    "amount": 275.55,
    "category": "Travel",
    "status": "approved",
    "submitter_name": "John Doe",
    "created_at": "2025-10-04T09:00:00Z"
  },
  "approvals": [
    {
      "id": "approval-1",
      "sequence": 1,
      "status": "approved",
      "comments": "Approved - valid expense",
      "approved_at": "2025-10-04T10:00:00Z",
      "created_at": "2025-10-04T09:00:00Z",
      "approver_id": "manager-uuid",
      "approver_name": "Jane Manager",
      "approver_email": "jane@company.com",
      "approver_role": "manager"
    },
    {
      "id": "approval-2",
      "sequence": 2,
      "status": "approved",
      "comments": "Approved",
      "approved_at": "2025-10-04T11:00:00Z",
      "created_at": "2025-10-04T09:00:00Z",
      "approver_id": "finance-uuid",
      "approver_name": "Finance Head",
      "approver_email": "finance@company.com",
      "approver_role": "manager"
    },
    {
      "id": "approval-3",
      "sequence": 3,
      "status": "approved",
      "comments": "Final approval",
      "approved_at": "2025-10-04T12:00:00Z",
      "created_at": "2025-10-04T09:00:00Z",
      "approver_id": "ceo-uuid",
      "approver_name": "CEO",
      "approver_email": "ceo@company.com",
      "approver_role": "admin"
    }
  ],
  "statistics": {
    "total": 3,
    "approved": 3,
    "rejected": 0,
    "pending": 0,
    "completion_percentage": 100
  }
}
```

---

## 🔒 Security Features

### Sequential Approval Enforcement:
✅ Cannot skip approval sequences  
✅ Must approve in order (1 → 2 → 3)  
✅ Validates all previous approvals are complete  
✅ Clear error messages for violations  

### Access Control:
✅ Only assigned approver can approve/reject  
✅ Cannot approve own submissions  
✅ Role-based access for viewing history  
✅ Company isolation (cannot access other companies)  

### Data Integrity:
✅ SQL transactions for atomic updates  
✅ Rollback on any error  
✅ Prevents double-approval  
✅ Prevents approval of already processed expenses  

### Validation:
✅ Comments required for rejection  
✅ Approval must be pending  
✅ Expense must be pending  
✅ User must be assigned approver  

---

## 📊 API Routes

### 1. Get Pending Approvals
```bash
GET /api/approvals/pending
Authorization: Bearer {token}
Access: Manager, Admin

Response: List of expenses ready for approval
```

### 2. Approve Expense
```bash
POST /api/approvals/:id/approve
Authorization: Bearer {token}
Access: Manager, Admin

Body:
{
  "comments": "Approved - valid business expense"  // Optional
}

Response: Updated approval and expense status
```

### 3. Reject Expense
```bash
POST /api/approvals/:id/reject
Authorization: Bearer {token}
Access: Manager, Admin

Body:
{
  "comments": "Insufficient documentation"  // REQUIRED
}

Response: Updated approval and expense status
```

### 4. Get Approval History
```bash
GET /api/approvals/expense/:expenseId
Authorization: Bearer {token}
Access: Authenticated (with access check)

Response: Complete approval history with statistics
```

---

## 🔄 Approval Flow Examples

### Example 1: Sequential Approval (3 Approvers)

```
Employee submits $500 expense
↓
Approval Chain Created:
├── Sequence 1: Manager (pending)
├── Sequence 2: Finance Head (pending)
└── Sequence 3: CEO (pending)

Step 1: Manager approves
├── Sequence 1: Manager (approved) ✓
├── Sequence 2: Finance Head (pending) ← Now visible
└── Sequence 3: CEO (pending) ← Still hidden

Step 2: Finance Head approves
├── Sequence 1: Manager (approved) ✓
├── Sequence 2: Finance Head (approved) ✓
└── Sequence 3: CEO (pending) ← Now visible

Step 3: CEO approves
├── Sequence 1: Manager (approved) ✓
├── Sequence 2: Finance Head (approved) ✓
└── Sequence 3: CEO (approved) ✓

Result: Expense status = 'approved' ✓
```

### Example 2: Rejection at Sequence 2

```
Employee submits $500 expense
↓
Approval Chain Created:
├── Sequence 1: Manager (pending)
├── Sequence 2: Finance Head (pending)
└── Sequence 3: CEO (pending)

Step 1: Manager approves
├── Sequence 1: Manager (approved) ✓
├── Sequence 2: Finance Head (pending)
└── Sequence 3: CEO (pending)

Step 2: Finance Head REJECTS
├── Sequence 1: Manager (approved) ✓
├── Sequence 2: Finance Head (rejected) ✗
└── Sequence 3: CEO (auto-rejected) ✗

Result: Expense status = 'rejected' ✗
No further approvals processed
```

### Example 3: Percentage Rule (75% Required)

```
Expense has 4 approvers, 75% approval needed
↓
Approval Chain:
├── Sequence 1: Manager 1 (pending)
├── Sequence 2: Manager 2 (pending)
├── Sequence 3: Finance (pending)
└── Sequence 4: CEO (pending)

After 3 approvals (75%):
├── Sequence 1: Manager 1 (approved) ✓
├── Sequence 2: Manager 2 (approved) ✓
├── Sequence 3: Finance (approved) ✓
└── Sequence 4: CEO (pending)

Result: 3/4 = 75% → Expense auto-approved ✓
CEO approval no longer needed
```

---

## 🧪 Testing Scenarios

### Test 1: Sequential Approval Validation
```bash
# Try to approve sequence 3 before sequence 2
POST /api/approvals/{sequence-3-id}/approve

Expected: 400 Bad Request
Error: "Sequential approval violation: Approval sequence 2 must be approved first"
```

### Test 2: Non-Approver Attempting Approval
```bash
# User who is not assigned approver tries to approve
POST /api/approvals/{approval-id}/approve

Expected: 403 Forbidden
Error: "You are not the assigned approver for this expense"
```

### Test 3: Rejection Without Comments
```bash
# Try to reject without providing comments
POST /api/approvals/{approval-id}/reject
Body: {}

Expected: 400 Bad Request
Error: "Comments are required when rejecting an expense"
```

### Test 4: Double Approval
```bash
# Try to approve already approved expense
POST /api/approvals/{approved-id}/approve

Expected: 400 Bad Request
Error: "This approval is already approved"
```

### Test 5: Access Control
```bash
# Employee tries to view another employee's approval history
GET /api/approvals/expense/{other-user-expense-id}

Expected: 403 Forbidden
Error: "You do not have permission to view this approval history"
```

---

## 💡 Key Features

### 1. **Sequential Approval Logic**
- Strict sequence enforcement
- Cannot skip approvers
- Clear blocking mechanism
- Prevents approval chaos

### 2. **Conditional Rules Support**
- Percentage-based approval
- Specific approver requirements
- Flexible rule configuration
- Stored in `approval_rules` table

### 3. **Comprehensive Context**
- Shows previous approvers
- Displays approval progress
- Indicates next approver
- Provides decision context

### 4. **Cascade Rejection**
- One rejection stops all
- Auto-rejects pending approvals
- Immediate expense rejection
- No wasted approver time

### 5. **Transaction Safety**
- Atomic approval + expense update
- Rollback on any error
- Data consistency guaranteed
- No partial states

---

## 📝 Database Queries

### Key Queries Used:

**1. Get Pending with Blocking Check:**
```sql
SELECT ...,
  (SELECT COUNT(*)
   FROM approvals a2
   WHERE a2.expense_id = e.id
   AND a2.sequence < a.sequence
   AND a2.status != 'approved'
  ) as blocking_approvals
FROM approvals a
WHERE a.approver_id = $1 AND a.status = 'pending'
```

**2. Validate Previous Approvals:**
```sql
SELECT id, status, sequence
FROM approvals
WHERE expense_id = $1 AND sequence < $2
ORDER BY sequence ASC
```

**3. Check Remaining Approvals:**
```sql
SELECT id, sequence, status
FROM approvals
WHERE expense_id = $1 AND sequence > $2
ORDER BY sequence ASC
```

**4. Cascade Rejection:**
```sql
UPDATE approvals
SET status = 'rejected',
    comments = 'Rejected due to prior rejection',
    approved_at = CURRENT_TIMESTAMP
WHERE expense_id = $1 AND status = 'pending' AND id != $2
```

---

## ✅ Summary

### What's Complete:

✅ **Sequential Approval System**
- Strict sequence enforcement
- Blocking logic for pending approvals
- Cannot skip sequences

✅ **Approval Actions**
- Approve with optional comments
- Reject with required comments
- Automatic expense status updates

✅ **Conditional Rules**
- Percentage-based approval
- Flexible rule configuration
- Auto-approval when threshold met

✅ **Access Control**
- Role-based permissions
- Approver validation
- Company isolation

✅ **Transaction Safety**
- Atomic updates
- Rollback on errors
- Data consistency

✅ **Comprehensive Responses**
- Approval context
- Next approver info
- Complete history
- Statistics

---

**The approval workflow system is complete and production-ready!** 🎉
