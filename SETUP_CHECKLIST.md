# ✅ Setup Checklist

## 📋 Complete Project Setup Verification

Use this checklist to ensure everything is properly set up.

---

## ✅ Phase 1: Project Files

### Root Directory
- [x] README.md - Main documentation
- [x] PROJECT_SUMMARY.md - Project overview
- [x] QUICK_REFERENCE.md - Quick reference guide
- [x] setup.sh - Automated setup script

### Backend Directory (`backend/`)
- [x] package.json - Dependencies and scripts
- [x] .env.example - Environment variables template
- [x] .gitignore - Git ignore rules
- [x] uploads/.gitkeep - Uploads directory placeholder

#### Backend Source (`backend/src/`)
- [x] server.js - Main server file
- [x] middleware/auth.js - Authentication middleware
- [x] middleware/errorHandler.js - Error handling
- [x] middleware/notFound.js - 404 handler
- [x] utils/database.js - Database connection
- [x] routes/auth.js - Authentication routes
- [x] routes/users.js - User management routes
- [x] routes/expenses.js - Expense routes
- [x] routes/approvals.js - Approval routes
- [x] routes/companies.js - Company routes

### Frontend Directory (`frontend/`)
- [x] package.json - Dependencies and scripts
- [x] .env.example - Environment variables template
- [x] .gitignore - Git ignore rules
- [x] .eslintrc.cjs - ESLint configuration
- [x] index.html - HTML entry point
- [x] vite.config.js - Vite configuration
- [x] tailwind.config.js - TailwindCSS configuration
- [x] postcss.config.js - PostCSS configuration

#### Frontend Source (`frontend/src/`)
- [x] main.jsx - React entry point
- [x] App.jsx - Main app component
- [x] index.css - Global styles
- [x] components/Layout.jsx - Layout component
- [x] pages/Login.jsx - Login page
- [x] pages/Register.jsx - Register page
- [x] pages/Dashboard.jsx - Dashboard page
- [x] pages/Expenses.jsx - Expenses page
- [x] pages/Approvals.jsx - Approvals page
- [x] pages/Users.jsx - Users page
- [x] services/api.js - API client
- [x] utils/AuthContext.jsx - Auth context
- [x] utils/helpers.js - Helper functions

### Database Directory (`database/`)
- [x] schema.sql - Complete database schema

---

## ✅ Phase 2: Prerequisites

Before starting, ensure you have:

- [ ] Node.js (v16+) installed
  ```bash
  node --version
  ```

- [ ] PostgreSQL (v12+) installed
  ```bash
  psql --version
  ```

- [ ] npm or yarn installed
  ```bash
  npm --version
  ```

---

## ✅ Phase 3: Database Setup

- [ ] PostgreSQL service is running
  ```bash
  # macOS
  brew services list | grep postgresql
  
  # Linux
  sudo systemctl status postgresql
  ```

- [ ] Database created
  ```bash
  psql -U postgres -c "CREATE DATABASE expense_management;"
  ```

- [ ] Schema loaded
  ```bash
  psql -U postgres -d expense_management -f database/schema.sql
  ```

- [ ] Sample data loaded (included in schema.sql)

- [ ] Verify tables created
  ```bash
  psql -U postgres -d expense_management -c "\dt"
  ```

---

## ✅ Phase 4: Backend Setup

- [ ] Navigate to backend directory
  ```bash
  cd backend
  ```

- [ ] Install dependencies
  ```bash
  npm install
  ```

- [ ] Create .env file from .env.example
  ```bash
  cp .env.example .env
  ```

- [ ] Update .env with your credentials
  - [ ] DB_USER
  - [ ] DB_PASSWORD
  - [ ] JWT_SECRET (use strong random string)

- [ ] Verify uploads directory exists
  ```bash
  ls -la uploads/
  ```

- [ ] Test backend server
  ```bash
  npm run dev
  ```

- [ ] Verify backend is running
  - [ ] Open http://localhost:5000/health
  - [ ] Should see: `{"status":"OK",...}`

---

## ✅ Phase 5: Frontend Setup

- [ ] Navigate to frontend directory
  ```bash
  cd frontend
  ```

- [ ] Install dependencies
  ```bash
  npm install
  ```

- [ ] Create .env file (optional)
  ```bash
  cp .env.example .env
  ```

- [ ] Test frontend server
  ```bash
  npm run dev
  ```

- [ ] Verify frontend is running
  - [ ] Open http://localhost:5173
  - [ ] Should see login page

---

## ✅ Phase 6: Testing

### Test Authentication
- [ ] Open http://localhost:5173
- [ ] Login with: admin@techcorp.com / password123
- [ ] Should redirect to dashboard
- [ ] Verify user name appears in sidebar

### Test Dashboard
- [ ] Dashboard loads without errors
- [ ] Statistics cards display data
- [ ] Recent expenses show (if any)

### Test Expenses
- [ ] Navigate to Expenses page
- [ ] Click "New Expense" button
- [ ] Fill form and submit
- [ ] Verify expense appears in list

### Test Approvals (Manager/Admin)
- [ ] Navigate to Approvals page
- [ ] Verify pending approvals show
- [ ] Try approving an expense
- [ ] Verify success message

### Test Users (Admin)
- [ ] Navigate to Users page
- [ ] Verify user list displays
- [ ] Check user cards show correct info

---

## ✅ Phase 7: Verification

### Backend Verification
- [ ] Server starts without errors
- [ ] Database connection successful
- [ ] All routes accessible
- [ ] Authentication works
- [ ] File uploads work

### Frontend Verification
- [ ] App loads without errors
- [ ] All pages accessible
- [ ] Navigation works
- [ ] Forms submit correctly
- [ ] Toast notifications appear
- [ ] Responsive design works

### Integration Verification
- [ ] Frontend connects to backend
- [ ] API calls succeed
- [ ] Data displays correctly
- [ ] Authentication persists
- [ ] File uploads work end-to-end

---

## ✅ Phase 8: Common Issues

### Issue: Database connection failed
**Solution:**
- [ ] Check PostgreSQL is running
- [ ] Verify credentials in .env
- [ ] Ensure database exists
- [ ] Check firewall settings

### Issue: Port already in use
**Solution:**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Issue: Module not found
**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: CORS errors
**Solution:**
- [ ] Check backend CORS configuration
- [ ] Verify frontend URL in backend .env
- [ ] Restart both servers

---

## ✅ Phase 9: Final Checks

- [ ] Both servers running simultaneously
- [ ] Can login successfully
- [ ] Can create expense
- [ ] Can approve expense (as manager)
- [ ] Can view users (as admin)
- [ ] No console errors
- [ ] All features working

---

## 🎉 Success Criteria

Your setup is complete when:

1. ✅ Backend server runs on port 5000
2. ✅ Frontend server runs on port 5173
3. ✅ Can login with test credentials
4. ✅ Dashboard displays data
5. ✅ Can create and manage expenses
6. ✅ Approvals workflow works
7. ✅ No errors in console
8. ✅ All pages load correctly

---

## 📞 Need Help?

If you encounter issues:

1. Check the **Troubleshooting** section in README.md
2. Review **QUICK_REFERENCE.md** for common commands
3. Verify all prerequisites are installed
4. Check console logs for errors
5. Ensure database is properly set up

---

## 🚀 Next Steps

Once setup is complete:

1. **Explore Features**: Test all functionality
2. **Customize**: Modify as needed for your hackathon
3. **Deploy**: Follow deployment guide in README.md
4. **Present**: Use PROJECT_SUMMARY.md for presentation

---

**Setup Complete! Happy Hacking! 🎉**
