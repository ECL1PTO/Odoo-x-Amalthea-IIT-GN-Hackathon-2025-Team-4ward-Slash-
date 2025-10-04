#!/bin/bash

# Expense Management System - Quick Setup Script
# This script automates the setup process

set -e

echo "🚀 Starting Expense Management System Setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if PostgreSQL is installed
echo "📋 Checking prerequisites..."
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed. Please install PostgreSQL first.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Database setup
echo "🗄️  Setting up database..."
read -p "Enter PostgreSQL username (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "Enter PostgreSQL password: " DB_PASSWORD
echo ""

# Create database
echo "Creating database..."
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -c "CREATE DATABASE expense_management;" 2>/dev/null || echo "Database might already exist, continuing..."

# Run schema
echo "Running database schema..."
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -d expense_management -f database/schema.sql

echo -e "${GREEN}✅ Database setup complete${NC}"
echo ""

# Backend setup
echo "⚙️  Setting up backend..."
cd backend

# Create .env file
cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=expense_management
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=5000
NODE_ENV=development

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_DIR=uploads/
EOF

echo "Installing backend dependencies..."
npm install

echo -e "${GREEN}✅ Backend setup complete${NC}"
echo ""

# Frontend setup
echo "🎨 Setting up frontend..."
cd ../frontend

echo "Installing frontend dependencies..."
npm install

# Create .env file
cat > .env << EOF
VITE_API_URL=http://localhost:5000/api
EOF

echo -e "${GREEN}✅ Frontend setup complete${NC}"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Sample Login Credentials:"
echo "   Admin:    admin@techcorp.com / password123"
echo "   Manager:  manager@techcorp.com / password123"
echo "   Employee: employee@techcorp.com / password123"
echo ""
echo "🚀 To start the application:"
echo ""
echo "   Terminal 1 (Backend):"
echo "   $ cd backend"
echo "   $ npm run dev"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   $ cd frontend"
echo "   $ npm run dev"
echo ""
echo "   Then open: http://localhost:5173"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
