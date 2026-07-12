-- =====================================================================
-- SEED DATA
-- Fresh initialization with real-data readiness.
-- PostgreSQL compatible — no USE statement needed (DB is selected
-- automatically via POSTGRES_DB in docker-compose / .env.db).
-- =====================================================================

-- --- 0. Connection Verification Data ---------------------------------
INSERT INTO test_connection (status) VALUES ('Database Operational');

-- --- 1. Fixed Admin Accounts (only two admins allowed) ----------------
-- Passwords: AdminPass123 and SuperAdmin456
-- These are the ONLY admin accounts. Registration cannot create admins.

INSERT INTO users (email, password_hash, role) VALUES (
  'admin1@agri.local',
  '$5$rounds=535000$0elV25TH6NPgasYc$bSGKFwhqaC7QUWTvVTm2nWLoaDnO5Yi9gSOUSt0aSq0',
  'admin'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, role) VALUES (
  'admin2@agri.local',
  '$5$rounds=535000$l4oZXLJrq6SmBbJA$8P1cMnEZLjdP79FdKhfVkn/RFtYqzJ1/moifBCS0jpB',
  'admin'
) ON CONFLICT (email) DO NOTHING;
