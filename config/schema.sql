-- FAAMS Database Schema
-- Based on Tina's ERD (Chapter 4.8) and system requirements (Chapter 4.5)

-- Departments (MDAs) — e.g. "Ministry of Health"
CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Users — everyone who logs into the system, of any role
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('mda_officer', 'treasury_accountant', 'director_of_budget', 'admin')),
    department_id INTEGER REFERENCES departments(department_id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vote Heads — government spending category codes, e.g. "Recurrent Expenditure"
CREATE TABLE vote_heads (
    vote_head_id SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL
);

-- Budget Ceilings — the yearly spending limit per department
CREATE TABLE budget_ceilings (
    ceiling_id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(department_id),
    fiscal_year VARCHAR(9) NOT NULL, -- e.g. "2025/2026"
    total_ceiling NUMERIC(15,2) NOT NULL,
    amount_used NUMERIC(15,2) NOT NULL DEFAULT 0,
    UNIQUE (department_id, fiscal_year)
);

-- Fund Requests — the central table
CREATE TABLE fund_requests (
    request_id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(department_id),
    submitted_by INTEGER NOT NULL REFERENCES users(user_id),
    vote_head_id INTEGER NOT NULL REFERENCES vote_heads(vote_head_id),
    amount NUMERIC(15,2) NOT NULL,
    purpose TEXT NOT NULL,
    supporting_document_url VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accountant_review', 'director_review', 'approved', 'rejected', 'revision_requested')),
    is_flagged_duplicate BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Approvals — records each decision made on a request, by whom
CREATE TABLE approvals (
    approval_id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES fund_requests(request_id),
    reviewed_by INTEGER NOT NULL REFERENCES users(user_id),
    decision VARCHAR(30) NOT NULL CHECK (decision IN ('approved', 'rejected', 'sent_back')),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Trail — a log of every important action, for accountability
CREATE TABLE audit_trail (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    action VARCHAR(255) NOT NULL,
    request_id INTEGER REFERENCES fund_requests(request_id),
    created_at TIMESTAMP DEFAULT NOW()
);
