-- Initialize databases
CREATE DATABASE IF NOT EXISTS agriculture;
CREATE DATABASE IF NOT EXISTS test_agriculture;

-- Switch to the primary database
USE agriculture;

-- Create a simple table for health checks and connection verification
CREATE TABLE IF NOT EXISTS test_connection (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status VARCHAR(50) NOT NULL,
    initialized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial verification data
INSERT INTO test_connection (status) VALUES ('Database Operational');

-- Ensure permissions are set correctly for the application user
-- Note: These variables should match .env.db
-- GRANT ALL PRIVILEGES ON agriculture.* TO 'agri_user'@'%';
-- GRANT ALL PRIVILEGES ON test_agriculture.* TO 'agri_user'@'%';
-- FLUSH PRIVILEGES;
