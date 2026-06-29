-- =====================================================================
-- SEED DATA
-- Fresh initialization with real-data readiness.
-- =====================================================================

USE agriculture;

-- --- 0. Connection Verification Data ---------------------------------
INSERT INTO test_connection (status) VALUES ('Database Operational');

-- --- 1. Admin User ---------------------------------------------------
INSERT INTO users (email, password_hash, role) VALUES (
  'yassint.codes@gmail.com',
  '$5$rounds=535000$iqPFhsnBackXdDqZ$apsSsCRoP3EkPmQg4QC7kUuiKdJZj7ho1cdaQtgBaa5',
  'admin'
);
