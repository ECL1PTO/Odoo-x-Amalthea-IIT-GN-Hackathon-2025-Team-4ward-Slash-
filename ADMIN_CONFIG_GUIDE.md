# Admin Configuration System - Complete Guide

## 📋 Overview

Complete admin configuration functionality for managing approvers and approval rules. Allows admins to configure the approval workflow for their company.

---

## 🆕 Created Files

### 1. **controllers/configController.js** (550+ lines)
### 2. **routes/config.js** (70 lines)
### 3. **Updated server.js** (Added config routes)

---

## 🔧 Functions Implemented

### **a) `addApprover(req, res)` - Add Approver**

#### What It Does:
✅ Adds a user as an approver for the company  
✅ Validates user exists and belongs to company  
✅ Validates user has manager or admin role  
✅ Checks for sequence conflicts  
✅ Prevents duplicate approvers  

#### Validation Steps:
1. **Required fields**: userId, roleName, sequence
2. **Sequence validation**: Must be positive integer ≥ 1
3. **User exists**: Must belong to company
4. **User is active**: Cannot add inactive users
5. **User role**: Must be manager or admin
6. **No duplicates**: User not already approver with same role
7. **No conflicts**: Sequence not already assigned

#### Request:
```json
POST /api/config/approvers
{
  "userId": "user-uuid",
  "roleName": "Finance Head",
  "sequence": 2
}
```

#### Response:
```json
{
  "message": "Approver added successfully",
  "approver": {
    "id": "approver-uuid",
    "user_id": "user-uuid",
    "user_name": "John Finance",
    "user_email": "john@company.com",
    "role_name": "Finance Head",
    "sequence": 2,
    "is_active": true,
    "created_at": "2025-10-04T10:00:00Z"
  }
}
```

#### Error Cases:
- Missing fields → 400 Bad Request
- Invalid sequence → 400 Bad Request
- User not found → 404 Not Found
- User inactive → 400 Bad Request
- User not manager/admin → 400 Bad Request
- Duplicate approver → 400 Bad Request
- Sequence conflict → 400 Bad Request

---

### **b) `getApprovers(req, res)` - Get All Approvers**

#### What It Does:
✅ Gets all approvers for the company  
✅ Orders by sequence ascending  
✅ Includes user details (name, email, role)  
✅ Separates active and inactive approvers  

#### Request:
```bash
GET /api/config/approvers
```

#### Response:
```json
{
  "approvers": [
    {
      "id": "approver-1",
      "user_id": "user-1",
      "role_name": "Manager",
      "sequence": 1,
      "is_active": true,
      "created_at": "2025-10-01T10:00:00Z",
      "user_name": "Jane Manager",
      "user_email": "jane@company.com",
      "user_role": "manager"
    },
    {
      "id": "approver-2",
      "user_id": "user-2",
      "role_name": "Finance Head",
      "sequence": 2,
      "is_active": true,
      "created_at": "2025-10-02T10:00:00Z",
      "user_name": "John Finance",
      "user_email": "john@company.com",
      "user_role": "manager"
    }
  ],
  "active_approvers": [...],
  "inactive_approvers": [...],
  "total": 2,
  "active_count": 2,
  "inactive_count": 0
}
```

---

### **c) `updateApproverSequence(req, res)` - Update Sequence**

#### What It Does:
✅ Updates approver's sequence number  
✅ Handles sequence conflicts by swapping  
✅ Uses transaction for atomic update  
✅ Returns old and new sequence  

#### Conflict Resolution:
If new sequence is already taken:
1. Get existing approver at that sequence
2. Swap: Move existing to old sequence
3. Update: Move current to new sequence
4. Return both changes

#### Request:
```json
PUT /api/config/approvers/:id
{
  "newSequence": 3
}
```

#### Response (No Conflict):
```json
{
  "message": "Approver sequence updated successfully",
  "approver": {
    "id": "approver-uuid",
    "user_name": "John Finance",
    "role_name": "Finance Head",
    "old_sequence": 2,
    "new_sequence": 3
  },
  "swapped_with": null
}
```

#### Response (With Swap):
```json
{
  "message": "Approver sequence updated successfully",
  "approver": {
    "id": "approver-1",
    "user_name": "John Finance",
    "role_name": "Finance Head",
    "old_sequence": 2,
    "new_sequence": 3
  },
  "swapped_with": {
    "id": "approver-2",
    "user_name": "CEO",
    "role_name": "Executive",
    "old_sequence": 3,
    "new_sequence": 2
  }
}
```

---

### **d) `removeApprover(req, res)` - Remove Approver**

#### What It Does:
✅ Soft deletes approver (sets is_active = false)  
✅ Validates no pending approvals exist  
✅ Prevents removal if approver has pending work  

#### Validation:
- Approver exists and belongs to company
- No pending approvals assigned to this approver
- If pending approvals exist → Error with count

#### Request:
```bash
DELETE /api/config/approvers/:id
```

#### Response:
```json
{
  "message": "Approver removed successfully",
  "approver": {
    "id": "approver-uuid",
    "user_name": "John Finance",
    "user_email": "john@company.com",
    "role_name": "Finance Head",
    "sequence": 2
  }
}
```

#### Error (Pending Approvals):
```json
{
  "error": "Cannot remove approver",
  "details": "Approver has 3 pending approval(s). Please reassign or complete them first."
}
```

---

### **e) `setApprovalRule(req, res)` - Set Approval Rule**

#### What It Does:
✅ Creates approval rule for company  
✅ Supports 6 rule types  
✅ Validates rule configuration  
✅ Deactivates old rule of same type  

#### Supported Rule Types:

**1. Percentage Rule**
```json
{
  "ruleType": "percentage",
  "ruleConfig": {
    "percentage": 75,
    "total_approvers": 4
  }
}
```
- Requires X% of approvers to approve
- Example: 3 out of 4 approvers (75%)

**2. Specific Approver Rule**
```json
{
  "ruleType": "specific_approver",
  "ruleConfig": {
    "approver_id": "user-uuid"
  }
}
```
- Requires specific person to approve
- Example: CEO must approve

**3. Hybrid Rule**
```json
{
  "ruleType": "hybrid",
  "ruleConfig": {
    "percentage": 60,
    "total_approvers": 5,
    "special_approver_id": "ceo-uuid"
  }
}
```
- Requires percentage AND specific approver
- Example: 60% approval + CEO approval

**4. Amount Threshold Rule**
```json
{
  "ruleType": "amount_threshold",
  "ruleConfig": {
    "min_amount": 1000,
    "max_amount": 5000,
    "required_approvals": 2
  }
}
```
- Different approvals based on amount
- Example: $1000-$5000 needs 2 approvals

**5. Category-Based Rule**
```json
{
  "ruleType": "category_based",
  "ruleConfig": {
    "categories": ["Travel", "Equipment"],
    "required_approvals": 3
  }
}
```
- Different approvals based on category
- Example: Travel expenses need 3 approvals

**6. Role-Based Rule**
```json
{
  "ruleType": "role_based",
  "ruleConfig": {
    "roles": ["manager", "admin"],
    "required_approvals": 2
  }
}
```
- Different approvals based on submitter role
- Example: Manager submissions need 2 approvals

#### Request:
```json
POST /api/config/rules
{
  "ruleType": "percentage",
  "ruleConfig": {
    "percentage": 75,
    "total_approvers": 4
  }
}
```

#### Response:
```json
{
  "message": "Approval rule created successfully",
  "rule": {
    "id": "rule-uuid",
    "rule_type": "percentage",
    "rule_config": {
      "percentage": 75,
      "total_approvers": 4
    },
    "is_active": true,
    "created_at": "2025-10-04T10:00:00Z"
  }
}
```

#### Validation:
- **Percentage rule**: percentage (1-100), total_approvers (≥1)
- **Specific approver**: approver_id (must exist in company)
- **Hybrid**: percentage, total_approvers, special_approver_id (must exist)

---

### **f) `getApprovalRules(req, res)` - Get Approval Rules**

#### What It Does:
✅ Gets all approval rules for company  
✅ Parses JSON configurations  
✅ Adds human-readable descriptions  
✅ Separates active and inactive rules  

#### Request:
```bash
GET /api/config/rules
```

#### Response:
```json
{
  "rules": [
    {
      "id": "rule-1",
      "rule_type": "percentage",
      "rule_config": {
        "percentage": 75,
        "total_approvers": 4
      },
      "is_active": true,
      "created_at": "2025-10-04T10:00:00Z",
      "updated_at": "2025-10-04T10:00:00Z",
      "description": "Requires 75% approval from 4 approvers"
    },
    {
      "id": "rule-2",
      "rule_type": "specific_approver",
      "rule_config": {
        "approver_id": "ceo-uuid"
      },
      "is_active": true,
      "created_at": "2025-10-03T10:00:00Z",
      "updated_at": "2025-10-03T10:00:00Z",
      "description": "Requires approval from specific approver (ID: ceo-uuid)"
    }
  ],
  "active_rules": [...],
  "inactive_rules": [...],
  "total": 2,
  "active_count": 2,
  "inactive_count": 0
}
```

#### Auto-Generated Descriptions:
- **Percentage**: "Requires X% approval from Y approvers"
- **Specific**: "Requires approval from specific approver (ID: ...)"
- **Hybrid**: "Requires X% approval from Y approvers AND approval from special approver"
- **Amount**: "Amount-based approval: $X - $Y"
- **Category**: "Category-based approval for: Travel, Equipment"
- **Role**: "Role-based approval for: manager, admin"

---

## 📊 API Routes Summary

```
POST   /api/config/approvers        - Add approver
GET    /api/config/approvers        - Get all approvers
PUT    /api/config/approvers/:id    - Update approver sequence
DELETE /api/config/approvers/:id    - Remove approver
POST   /api/config/rules            - Set approval rule
GET    /api/config/rules            - Get approval rules
```

**All routes require Admin access**

---

## 🔒 Security Features

### Access Control:
✅ **Admin only** - All endpoints require admin role  
✅ **Company isolation** - Can only manage own company  
✅ **User validation** - Validates users belong to company  

### Data Validation:
✅ **Required fields** - Validates all required inputs  
✅ **Type checking** - Validates data types  
✅ **Range validation** - Validates numeric ranges  
✅ **Existence checks** - Validates referenced entities exist  

### Business Logic:
✅ **No duplicates** - Prevents duplicate approvers  
✅ **Sequence conflicts** - Handles with automatic swapping  
✅ **Pending work** - Prevents removal if pending approvals  
✅ **Role requirements** - Only managers/admins can be approvers  

### Transaction Safety:
✅ **Atomic updates** - Uses transactions for sequence updates  
✅ **Rollback on error** - Ensures data consistency  
✅ **Soft deletes** - Preserves historical data  

---

## 🎯 Usage Examples

### Example 1: Setup Approval Chain

```bash
# Step 1: Add Manager as first approver
POST /api/config/approvers
{
  "userId": "manager-uuid",
  "roleName": "Department Manager",
  "sequence": 1
}

# Step 2: Add Finance Head as second approver
POST /api/config/approvers
{
  "userId": "finance-uuid",
  "roleName": "Finance Head",
  "sequence": 2
}

# Step 3: Add CEO as final approver
POST /api/config/approvers
{
  "userId": "ceo-uuid",
  "roleName": "Executive",
  "sequence": 3
}

Result: Approval chain created
1. Department Manager
2. Finance Head
3. CEO
```

### Example 2: Reorder Approvers

```bash
# Move CEO from sequence 3 to sequence 2
PUT /api/config/approvers/ceo-approver-id
{
  "newSequence": 2
}

Result: Automatic swap
- CEO: 3 → 2
- Finance Head: 2 → 3
```

### Example 3: Set Percentage Rule

```bash
# Require 75% approval (3 out of 4 approvers)
POST /api/config/rules
{
  "ruleType": "percentage",
  "ruleConfig": {
    "percentage": 75,
    "total_approvers": 4
  }
}

Result: Expense auto-approves when 3 approvers approve
```

### Example 4: Set Hybrid Rule

```bash
# Require 60% approval AND CEO approval
POST /api/config/rules
{
  "ruleType": "hybrid",
  "ruleConfig": {
    "percentage": 60,
    "total_approvers": 5,
    "special_approver_id": "ceo-uuid"
  }
}

Result: Need 3 of 5 approvers (60%) + CEO must approve
```

---

## 🧪 Testing Scenarios

### Test 1: Add Approver Validation
```bash
# Try to add employee as approver
POST /api/config/approvers
{
  "userId": "employee-uuid",
  "roleName": "Approver",
  "sequence": 1
}

Expected: 400 Bad Request
Error: "Only managers and admins can be approvers"
```

### Test 2: Sequence Conflict
```bash
# Try to add approver with existing sequence
POST /api/config/approvers
{
  "userId": "user-uuid",
  "roleName": "Finance",
  "sequence": 1  // Already exists
}

Expected: 400 Bad Request
Error: "Sequence 1 is already assigned"
```

### Test 3: Remove Approver with Pending Work
```bash
# Try to remove approver with pending approvals
DELETE /api/config/approvers/approver-id

Expected: 400 Bad Request
Error: "Approver has 5 pending approval(s)"
```

### Test 4: Invalid Rule Configuration
```bash
# Try to set percentage rule without required fields
POST /api/config/rules
{
  "ruleType": "percentage",
  "ruleConfig": {
    "percentage": 75
    // Missing total_approvers
  }
}

Expected: 400 Bad Request
Error: "Percentage rule requires: percentage and total_approvers"
```

---

## 💡 Best Practices

### Approver Management:
1. **Start with sequence 1** - Always begin approval chain at 1
2. **Use descriptive roles** - "Finance Head" not just "Approver"
3. **Order by authority** - Manager → Finance → CEO
4. **Keep it simple** - 3-5 approvers maximum
5. **Review regularly** - Update when org changes

### Rule Configuration:
1. **One rule per type** - System deactivates old rules automatically
2. **Test rules** - Verify behavior before production
3. **Document rules** - Keep track of why rules exist
4. **Start simple** - Begin with sequential, add percentage later
5. **Monitor impact** - Check approval times after changes

### Sequence Management:
1. **Plan sequences** - Design approval flow before adding
2. **Use gaps** - Leave room (1, 3, 5) for future additions
3. **Update carefully** - Swaps affect existing approvals
4. **Communicate changes** - Inform approvers of reordering

---

## 📝 Database Impact

### Tables Modified:
- **approvers** - Stores approver configurations
- **approval_rules** - Stores approval rules

### Soft Delete Strategy:
- Sets `is_active = false` instead of DELETE
- Preserves historical data
- Allows reactivation if needed
- Maintains referential integrity

### Sequence Swapping:
```sql
-- Transaction ensures atomic swap
BEGIN;
  UPDATE approvers SET sequence = 3 WHERE id = 'approver-1';
  UPDATE approvers SET sequence = 2 WHERE id = 'approver-2';
COMMIT;
```

---

## ✅ Summary

### What's Complete:

✅ **Approver Management**
- Add approvers with validation
- Get approvers with details
- Update sequences with conflict resolution
- Remove approvers with safety checks

✅ **Approval Rules**
- 6 rule types supported
- Flexible JSON configuration
- Automatic rule replacement
- Human-readable descriptions

✅ **Security**
- Admin-only access
- Company isolation
- Comprehensive validation
- Transaction safety

✅ **User Experience**
- Clear error messages
- Automatic conflict resolution
- Detailed responses
- Soft deletes

---

**The admin configuration system is complete and production-ready!** 🎉
