-- Geospatial Phase 1 tables (see documents/Geospatial_System/02_Database_Schema.md
-- and 05_Project_Structure_Sync.md). Applied on MySQL init via docker-compose volume.
-- ORM models use Integer PKs where noted in 05 §7 for SQLite test compatibility.

USE agriculture;

CREATE TABLE IF NOT EXISTS lands (
    land_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NULL,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    boundary_polygon JSON NULL,
    description TEXT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lands_status (status),
    INDEX idx_lands_lat_lng (latitude, longitude)
);

CREATE TABLE IF NOT EXISTS data_sources (
    source_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    confidence_score DECIMAL(5,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS land_climate (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    land_id BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    temperature_celsius DECIMAL(10,4) NULL,
    humidity_pct DECIMAL(10,4) NULL,
    rainfall_mm DECIMAL(10,4) NULL,
    source_id BIGINT NULL,
    FOREIGN KEY (land_id) REFERENCES lands(land_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_climate_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS land_water (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    land_id BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_water_usage_liters DECIMAL(14,4) NULL,
    irrigation_status VARCHAR(100) NULL,
    source_id BIGINT NULL,
    FOREIGN KEY (land_id) REFERENCES lands(land_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_water_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS land_crops (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    land_id BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    crop_type VARCHAR(100) NULL,
    ndvi_value DECIMAL(10,4) NULL,
    estimated_yield_tons DECIMAL(14,4) NULL,
    source_id BIGINT NULL,
    FOREIGN KEY (land_id) REFERENCES lands(land_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_crops_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS land_soil (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    land_id BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    moisture_pct DECIMAL(10,4) NULL,
    soil_type VARCHAR(100) NULL,
    source_id BIGINT NULL,
    FOREIGN KEY (land_id) REFERENCES lands(land_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_soil_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS land_images (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    land_id BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    image_path VARCHAR(500) NOT NULL,
    image_type VARCHAR(100) NOT NULL,
    cv_analysis_summary JSON NULL,
    source_id BIGINT NULL,
    FOREIGN KEY (land_id) REFERENCES lands(land_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_images_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS analytics_summaries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    land_id BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    summary_text TEXT NOT NULL,
    summary_payload JSON NULL,
    source_id BIGINT NULL,
    FOREIGN KEY (land_id) REFERENCES lands(land_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_analytics_summaries_land_time (land_id, timestamp)
);

-- ============================================================================
-- Phase 1: Decision Engine column extensions
-- ============================================================================

-- land_crops: growth stage tracking
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_crops' AND COLUMN_NAME = 'growth_stage');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE land_crops ADD COLUMN growth_stage VARCHAR(50) NULL AFTER estimated_yield_tons',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_crops' AND COLUMN_NAME = 'ndvi_trend');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE land_crops ADD COLUMN ndvi_trend VARCHAR(20) NULL AFTER growth_stage',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_crops' AND COLUMN_NAME = 'confidence');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE land_crops ADD COLUMN confidence DECIMAL(5,4) NULL AFTER ndvi_trend',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- land_water: FAO water requirement + efficiency
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_water' AND COLUMN_NAME = 'crop_water_requirement_mm');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE land_water ADD COLUMN crop_water_requirement_mm DECIMAL(10,4) NULL AFTER irrigation_status',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_water' AND COLUMN_NAME = 'water_efficiency_ratio');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE land_water ADD COLUMN water_efficiency_ratio DECIMAL(10,4) NULL AFTER crop_water_requirement_mm',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- land_soil: soil quality indicators
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_soil' AND COLUMN_NAME = 'ph_level');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE land_soil ADD COLUMN ph_level DECIMAL(5,2) NULL AFTER soil_type',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_soil' AND COLUMN_NAME = 'organic_matter_pct');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE land_soil ADD COLUMN organic_matter_pct DECIMAL(5,2) NULL AFTER ph_level',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_soil' AND COLUMN_NAME = 'suitability_score');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE land_soil ADD COLUMN suitability_score DECIMAL(5,2) NULL AFTER organic_matter_pct',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- land_images: NDVI and cloud cover metadata
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_images' AND COLUMN_NAME = 'ndvi_mean');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE land_images ADD COLUMN ndvi_mean DECIMAL(6,4) NULL AFTER cv_analysis_summary',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'land_images' AND COLUMN_NAME = 'cloud_cover_pct');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE land_images ADD COLUMN cloud_cover_pct DECIMAL(5,2) NULL AFTER ndvi_mean',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- land_alerts: anomalies & risk alerts
CREATE TABLE IF NOT EXISTS land_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    land_id BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    payload JSON NULL,
    resolved_at TIMESTAMP NULL,
    source_id BIGINT NULL,
    FOREIGN KEY (land_id) REFERENCES lands(land_id),
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_alerts_land_time (land_id, timestamp),
    INDEX idx_land_alerts_severity (severity)
);

