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
  '$5$rounds=535000$qPXMKmi1sSAFFUxr$qKzzD80tRuD.kciuKhZ6RXo2n.oSu6OsrykBg36eNA.',
  'admin'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, role) VALUES (
  'admin2@agri.local',
  '$5$rounds=535000$LgcRSxDTi/9GQKHV$ActzizWhrAnabV47VuIjX3KsS.Hqs81vlfMSnwQoYUD',
  'admin'
) ON CONFLICT (email) DO NOTHING;
