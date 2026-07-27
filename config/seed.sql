-- Sample data so we have something to test against

INSERT INTO departments (name) VALUES
('Ministry of Health'),
('Ministry of Education'),
('Ministry of Transport');

INSERT INTO vote_heads (code, name) VALUES
('REC-001', 'Recurrent Expenditure'),
('DEV-001', 'Development Expenditure'),
('STA-001', 'Stationery and Supplies');

INSERT INTO budget_ceilings (department_id, fiscal_year, total_ceiling, amount_used) VALUES
(1, '2025/2026', 5000000.00, 0),
(2, '2025/2026', 3000000.00, 0),
(3, '2025/2026', 2000000.00, 0);
