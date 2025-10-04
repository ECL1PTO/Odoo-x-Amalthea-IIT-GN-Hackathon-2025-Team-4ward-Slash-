# Quick Reference Guide

## 🚀 Start Commands

### Backend
```bash
cd backend
npm run dev    # Development with auto-reload
npm start      # Production mode
```

### Frontend
```bash
cd frontend
npm run dev    # Development server
npm run build  # Production build
```

## 🔑 Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@techcorp.com | password123 |
| Manager | manager@techcorp.com | password123 |
| Employee | employee@techcorp.com | password123 |

## 🌐 URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/health

## 📁 Important Files

### Backend
- `backend/src/server.js` - Main server
- `backend/src/routes/` - API routes
- `backend/src/middleware/auth.js` - Authentication
- `backend/.env` - Configuration (create from .env.example)

### Frontend
- `frontend/src/App.jsx` - Main app component
- `frontend/src/pages/` - Page components
- `frontend/src/utils/AuthContext.jsx` - Auth state
- `frontend/src/services/api.js` - API client

### Database
- `database/schema.sql` - Database schema

## 🛠️ Common Commands

### Database
```bash
# Create database
psql -U postgres -c "CREATE DATABASE expense_management;"

# Run schema
psql -U postgres -d expense_management -f database/schema.sql

# Connect to database
psql -U postgres -d expense_management
```

### Backend
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Check for errors
npm run lint
```

### Frontend
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Database Connection Error
1. Check PostgreSQL is running
2. Verify credentials in `.env`
3. Ensure database exists
4. Check firewall settings

### Module Not Found
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📊 Database Tables

1. **companies** - Company information
2. **users** - User accounts
3. **expenses** - Expense records
4. **approvers** - Approval workflow
5. **approvals** - Approval tracking
6. **approval_rules** - Approval rules

## 🔐 User Roles

| Role | Permissions |
|------|-------------|
| **Employee** | Create expenses, view own expenses |
| **Manager** | Employee + approve expenses, view team expenses |
| **Admin** | Full access, manage users and companies |

## 📝 API Quick Reference

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/profile` - Get profile

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Approvals
- `GET /api/approvals/pending` - Pending approvals
- `POST /api/approvals/:id` - Approve/reject

### Users (Admin)
- `GET /api/users` - List users
- `POST /api/users` - Create user

## 🎨 UI Components

### Pages
- `/` - Dashboard
- `/expenses` - Expense management
- `/approvals` - Approval workflow
- `/users` - User management (Admin)
- `/login` - Login page
- `/register` - Registration page

### Features
- Responsive sidebar navigation
- Toast notifications
- Modal dialogs
- Loading states
- Search and filters
- File upload

## 💡 Tips

1. **Development**: Use `npm run dev` for hot reload
2. **Testing**: Use sample credentials provided
3. **Debugging**: Check browser console and terminal logs
4. **Database**: Use pgAdmin or psql for database inspection
5. **API Testing**: Use Postman or curl for API testing

## 🔄 Workflow

### Employee Workflow
1. Login → Dashboard
2. Create Expense → Upload Receipt
3. Submit for Approval
4. Track Status

### Manager Workflow
1. Login → Approvals
2. Review Pending Expenses
3. Approve/Reject with Comments
4. View History

### Admin Workflow
1. Login → Dashboard
2. Manage Users
3. View All Expenses
4. Configure System

## 📦 File Structure

```
expense-management-system/
├── backend/          # Node.js backend
├── frontend/         # React frontend
├── database/         # SQL schema
├── README.md         # Main documentation
├── PROJECT_SUMMARY.md # Project overview
├── QUICK_REFERENCE.md # This file
└── setup.sh          # Setup script
```

## ⚡ Performance Tips

1. Use pagination for large datasets
2. Implement caching for frequently accessed data
3. Optimize database queries with indexes
4. Use connection pooling
5. Compress API responses

## 🔒 Security Checklist

- ✅ JWT authentication
- ✅ Password hashing
- ✅ Input validation
- ✅ SQL injection prevention
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Helmet security headers
- ✅ File upload validation

---

**Keep this guide handy for quick reference!**
