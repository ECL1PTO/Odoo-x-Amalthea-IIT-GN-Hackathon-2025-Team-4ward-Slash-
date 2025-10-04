-- Expense Management System Database Schema

-- Create database (run this manually in PostgreSQL)
-- CREATE DATABASE expense_management;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
    manager_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Expenses table
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    original_amount DECIMAL(10,2),
    original_currency VARCHAR(3) DEFAULT 'USD',
    category VARCHAR(100) NOT NULL,
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'draft')),
    receipt_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Approvers table
CREATE TABLE approvers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,
    sequence INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, role_name, sequence)
);

-- Approvals table
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    comments TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Approval rules table
CREATE TABLE approval_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('amount_threshold', 'category_based', 'role_based')),
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_manager_id ON users(manager_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_company_id ON expenses(company_id);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_approvers_company_id ON approvers(company_id);
CREATE INDEX idx_approvers_user_id ON approvers(user_id);
CREATE INDEX idx_approvals_expense_id ON approvals(expense_id);
CREATE INDEX idx_approvals_approver_id ON approvals(approver_id);
CREATE INDEX idx_approval_rules_company_id ON approval_rules(company_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_approval_rules_updated_at BEFORE UPDATE ON approval_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
-- Sample company
INSERT INTO companies (name, country, currency) VALUES
('Tech Corp', 'USA', 'USD'),
('Global Solutions Ltd', 'Canada', 'CAD');

-- Sample users (password is 'password123' hashed)
INSERT INTO users (company_id, name, email, password_hash, role) VALUES
((SELECT id FROM companies WHERE name = 'Tech Corp'), 'Admin User', 'admin@techcorp.com', '$2b$10$rEuVt2qGfZrEjPgQ7XKJNe.7HOUVQ3qT7qNcY8gFyUXc5vJ8zT5G6', 'admin'),
((SELECT id FROM companies WHERE name = 'Tech Corp'), 'John Manager', 'manager@techcorp.com', '$2b$10$rEuVt2qGfZrEjPgQ7XKJNe.7HOUVQ3qT7qNcY8gFyUXc5vJ8zT5G6', 'manager'),
((SELECT id FROM companies WHERE name = 'Tech Corp'), 'Jane Employee', 'employee@techcorp.com', '$2b$10$rEuVt2qGfZrEjPgQ7XKJNe.7HOUVQ3qT7qNcY8gFyUXc5vJ8zT5G6', 'employee');

-- Sample approvers
INSERT INTO approvers (company_id, user_id, role_name, sequence) VALUES
((SELECT id FROM companies WHERE name = 'Tech Corp'), (SELECT id FROM users WHERE email = 'manager@techcorp.com'), 'manager', 1),
((SELECT id FROM companies WHERE name = 'Tech Corp'), (SELECT id FROM users WHERE email = 'admin@techcorp.com'), 'admin', 2);

-- Sample approval rules
INSERT INTO approval_rules (company_id, rule_type, rule_config) VALUES
((SELECT id FROM companies WHERE name = 'Tech Corp'), 'amount_threshold', '{"min_amount": 100, "max_amount": 1000, "required_approvals": 1}'),
((SELECT id FROM companies WHERE name = 'Tech Corp'), 'amount_threshold', '{"min_amount": 1001, "required_approvals": 2}');

-- Sample expenses
INSERT INTO expenses (user_id, company_id, amount, category, description, status) VALUES
((SELECT id FROM users WHERE email = 'employee@techcorp.com'), (SELECT id FROM companies WHERE name = 'Tech Corp'), 250.00, 'Travel', 'Business trip to client site', 'pending'),
((SELECT id FROM users WHERE email = 'employee@techcorp.com'), (SELECT id FROM companies WHERE name = 'Tech Corp'), 75.50, 'Meals', 'Client lunch meeting', 'approved'),
((SELECT id FROM users WHERE email = 'employee@techcorp.com'), (SELECT id FROM companies WHERE name = 'Tech Corp'), 1500.00, 'Equipment', 'New laptop purchase', 'pending');

-- Sample approvals
INSERT INTO approvals (expense_id, approver_id, sequence, status, comments) VALUES
((SELECT id FROM expenses WHERE amount = 75.50), (SELECT id FROM users WHERE email = 'manager@techcorp.com'), 1, 'approved', 'Approved - reasonable expense'),
((SELECT id FROM expenses WHERE amount = 250.00), (SELECT id FROM users WHERE email = 'manager@techcorp.com'), 1, 'pending', NULL);
