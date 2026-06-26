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

-- ============================================================================
-- Missing Core & ETL Tables Required by Backend
-- ============================================================================

-- Disable foreign key checks temporarily to allow out-of-order schema loading
SET FOREIGN_KEY_CHECKS = 0;

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
);

-- 2. locations
CREATE TABLE IF NOT EXISTS locations (
    location_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    governorate VARCHAR(100) NOT NULL UNIQUE,
    region VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_locations_governorate (governorate)
);

-- 3. ingestion_batches
CREATE TABLE IF NOT EXISTS ingestion_batches (
    batch_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_system VARCHAR(100) NOT NULL,
    source_version VARCHAR(100) NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    status VARCHAR(50) NOT NULL,
    INDEX idx_batches_source_system (source_system),
    INDEX idx_batches_status (status)
);

-- 4. etl_errors
CREATE TABLE IF NOT EXISTS etl_errors (
    etl_error_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NULL,
    stage_name VARCHAR(100) NOT NULL,
    record_key VARCHAR(255) NULL,
    error_code VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    is_retryable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES ingestion_batches(batch_id),
    INDEX idx_etl_errors_batch_id (batch_id),
    INDEX idx_etl_errors_stage_name (stage_name)
);

-- 5. climate_records
CREATE TABLE IF NOT EXISTS climate_records (
    climate_record_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    location_id BIGINT NOT NULL,
    year INT NOT NULL,
    temperature_mean DECIMAL(10, 4) NULL,
    humidity_pct DECIMAL(10, 4) NULL,
    batch_id BIGINT NOT NULL,
    source_system VARCHAR(100) NOT NULL,
    ingestion_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    FOREIGN KEY (batch_id) REFERENCES ingestion_batches(batch_id),
    UNIQUE KEY uq_climate_location_year_batch (location_id, year, batch_id),
    INDEX idx_climate_year_location (year, location_id)
);

-- 6. water_records
CREATE TABLE IF NOT EXISTS water_records (
    water_record_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    location_id BIGINT NOT NULL,
    crop VARCHAR(100) NOT NULL,
    year INT NOT NULL,
    water_consumption_m3 DECIMAL(12, 2) NULL,
    irrigation_type VARCHAR(50) NULL,
    batch_id BIGINT NOT NULL,
    source_system VARCHAR(100) NOT NULL,
    ingestion_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    FOREIGN KEY (batch_id) REFERENCES ingestion_batches(batch_id),
    UNIQUE KEY uq_water_location_crop_year_batch (location_id, crop, year, batch_id),
    INDEX idx_water_crop (crop)
);

-- 7. crop_zones
CREATE TABLE IF NOT EXISTS crop_zones (
    zone_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    land_id BIGINT NOT NULL,
    crop_type VARCHAR(100) NOT NULL,
    area_hectares DECIMAL(12, 4) NULL,
    area_pct DECIMAL(5, 2) NULL,
    boundary_polygon JSON NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    avg_confidence DECIMAL(5, 4) NULL,
    latest_ndvi DECIMAL(6, 4) NULL,
    latest_growth_stage VARCHAR(50) NULL,
    estimated_yield_tons DECIMAL(14, 4) NULL,
    first_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (land_id) REFERENCES lands(land_id),
    INDEX idx_crop_zones_land (land_id)
);

-- 8. land_soil_profiles
CREATE TABLE IF NOT EXISTS land_soil_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    land_id BIGINT NOT NULL UNIQUE,
    ph_h2o DECIMAL(5, 2) NULL,
    soc_g_per_kg DECIMAL(8, 3) NULL,
    clay_pct DECIMAL(6, 2) NULL,
    sand_pct DECIMAL(6, 2) NULL,
    silt_pct DECIMAL(6, 2) NULL,
    bulk_density DECIMAL(6, 3) NULL,
    nitrogen_g_per_kg DECIMAL(7, 3) NULL,
    cec_cmol DECIMAL(8, 3) NULL,
    texture_class VARCHAR(32) NULL,
    depth_profile JSON NULL,
    suitability_score DECIMAL(5, 2) NULL,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_id BIGINT NULL,
    FOREIGN KEY (land_id) REFERENCES lands(land_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_soil_profiles_land (land_id)
);

-- ============================================================================
-- Pre-creation Workaround to align with Untouched geospatial_schema.sql
-- ============================================================================

-- 9. lands (Pre-created to inject area_hectares & monitoring_interval_days)
CREATE TABLE IF NOT EXISTS lands (
    land_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NULL,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    boundary_polygon JSON NULL,
    area_hectares DECIMAL(12,4) NULL,
    description TEXT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'processing',
    monitoring_interval_days INT NOT NULL DEFAULT 16,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_lands_status (status),
    INDEX idx_lands_lat_lng (latitude, longitude),
    INDEX idx_lands_user_id (user_id)
);

-- 10. land_crops (Pre-created to inject zone_id)
CREATE TABLE IF NOT EXISTS land_crops (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    land_id BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    crop_type VARCHAR(100) NULL,
    ndvi_value DECIMAL(10,4) NULL,
    estimated_yield_tons DECIMAL(14,4) NULL,
    growth_stage VARCHAR(50) NULL,
    ndvi_trend VARCHAR(20) NULL,
    confidence DECIMAL(5, 4) NULL,
    zone_id BIGINT NULL,
    source_id BIGINT NULL,
    FOREIGN KEY (land_id) REFERENCES lands(land_id),
    FOREIGN KEY (zone_id) REFERENCES crop_zones(zone_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_crops_land_time (land_id, timestamp)
);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
