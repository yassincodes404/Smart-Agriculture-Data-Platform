-- Initialize databases
CREATE DATABASE IF NOT EXISTS agriculture;
CREATE DATABASE IF NOT EXISTS test_agriculture;

-- Switch to the primary database
USE agriculture;

-- ============================================================================
-- 1. Core Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_connection (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status VARCHAR(50) NOT NULL,
    initialized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS data_sources (
    source_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    confidence_score DECIMAL(5,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
);

CREATE TABLE IF NOT EXISTS lands (
    land_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    boundary_polygon JSON NULL,
    area_hectares DECIMAL(10,4) NULL,
    description TEXT NULL,
    status VARCHAR(128) NOT NULL DEFAULT 'processing',
    monitoring_interval_days INT DEFAULT 7,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lands_status (status),
    INDEX idx_lands_lat_lng (latitude, longitude)
);

-- ============================================================================
-- 2. Data/Metrics Tables (Must have an external source_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS land_climate (
    id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    temperature_celsius DECIMAL(10,4) NULL,
    humidity_pct DECIMAL(10,4) NULL,
    rainfall_mm DECIMAL(10,4) NULL,
    source_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_climate_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS land_water (
    id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_water_usage_liters DECIMAL(14,4) NULL,
    irrigation_status VARCHAR(100) NULL,
    crop_water_requirement_mm DECIMAL(10,4) NULL,
    water_efficiency_ratio DECIMAL(10,4) NULL,
    source_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_water_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS crop_zones (
    zone_id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    crop_type VARCHAR(100) NOT NULL,
    area_hectares DECIMAL(12,4) NULL,
    area_pct DECIMAL(5,2) NULL,
    boundary_polygon JSON NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    avg_confidence DECIMAL(5,4) NULL,
    latest_ndvi DECIMAL(6,4) NULL,
    latest_growth_stage VARCHAR(50) NULL,
    estimated_yield_tons DECIMAL(14,4) NULL,
    first_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE,
    INDEX idx_crop_zones_land (land_id)
);

CREATE TABLE IF NOT EXISTS land_crops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    crop_type VARCHAR(100) NULL,
    ndvi_value DECIMAL(10,4) NULL,
    dvi_value DECIMAL(10,4) NULL,
    evi_value DECIMAL(10,4) NULL,
    ndwi_value DECIMAL(10,4) NULL,
    savi_value DECIMAL(10,4) NULL,
    gndvi_value DECIMAL(10,4) NULL,
    estimated_yield_tons DECIMAL(14,4) NULL,
    growth_stage VARCHAR(50) NULL,
    ndvi_trend VARCHAR(20) NULL,
    confidence DECIMAL(5,4) NULL,
    zone_id INT NULL,
    source_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    FOREIGN KEY (zone_id) REFERENCES crop_zones(zone_id) ON DELETE SET NULL,
    INDEX idx_land_crops_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS land_soil (
    id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    moisture_pct DECIMAL(10,4) NULL,
    soil_type VARCHAR(100) NULL,
    ph_level DECIMAL(5,2) NULL,
    organic_matter_pct DECIMAL(5,2) NULL,
    suitability_score DECIMAL(5,2) NULL,
    source_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_soil_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS land_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    image_data MEDIUMBLOB NOT NULL,
    image_type VARCHAR(100) NOT NULL,
    cv_analysis_summary JSON NULL,
    ndvi_mean DECIMAL(6,4) NULL,
    cloud_cover_pct DECIMAL(5,2) NULL,
    source_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_images_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS analytics_summaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    summary_text TEXT NOT NULL,
    summary_payload JSON NULL,
    source_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_analytics_summaries_land_time (land_id, timestamp)
);

CREATE TABLE IF NOT EXISTS land_ai_insights (
    insight_id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    insight_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    structured_data JSON NULL,
    confidence FLOAT NULL,
    model_used VARCHAR(128) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE,
    INDEX idx_land_created (land_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS land_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    payload JSON NULL,
    resolved_at TIMESTAMP NULL,
    source_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES data_sources(source_id),
    INDEX idx_land_alerts_land_time (land_id, timestamp),
    INDEX idx_land_alerts_severity (severity)
);

-- ============================================================================
-- 3. Database Event Handling and Auditing
-- ============================================================================

CREATE TABLE IF NOT EXISTS database_events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL,
    record_id INT NOT NULL,
    details JSON NULL
);

DELIMITER //

-- Audit Trigger: Land Registration
CREATE TRIGGER after_lands_insert
AFTER INSERT ON lands
FOR EACH ROW
BEGIN
    INSERT INTO database_events (table_name, operation, record_id, details)
    VALUES ('lands', 'INSERT', NEW.land_id, JSON_OBJECT('name', NEW.name, 'user_id', NEW.user_id));
END //

CREATE TRIGGER after_lands_update
AFTER UPDATE ON lands
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO database_events (table_name, operation, record_id, details)
        VALUES ('lands', 'UPDATE', NEW.land_id, JSON_OBJECT('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
END //

-- Audit Trigger: Data Sources
CREATE TRIGGER after_data_sources_insert
AFTER INSERT ON data_sources
FOR EACH ROW
BEGIN
    INSERT INTO database_events (table_name, operation, record_id, details)
    VALUES ('data_sources', 'INSERT', NEW.source_id, JSON_OBJECT('name', NEW.name, 'confidence_score', NEW.confidence_score));
END //

-- ============================================================================
-- 4. Triggers to Ensure Data Strictness (Only External Sources)
-- ============================================================================
-- Note: While 'source_id INT NOT NULL' enforces the presence of a foreign key,
-- triggers can be used to raise custom, descriptive error messages.

CREATE TRIGGER before_land_climate_insert
BEFORE INSERT ON land_climate
FOR EACH ROW
BEGIN
    IF NEW.source_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Data integrity violation: climate data must come from an external source_id';
    END IF;
END //

CREATE TRIGGER before_land_water_insert
BEFORE INSERT ON land_water
FOR EACH ROW
BEGIN
    IF NEW.source_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Data integrity violation: water data must come from an external source_id';
    END IF;
END //

CREATE TRIGGER before_land_crops_insert
BEFORE INSERT ON land_crops
FOR EACH ROW
BEGIN
    IF NEW.source_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Data integrity violation: crop data must come from an external source_id';
    END IF;
END //

CREATE TRIGGER before_land_soil_insert
BEFORE INSERT ON land_soil
FOR EACH ROW
BEGIN
    IF NEW.source_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Data integrity violation: soil data must come from an external source_id';
    END IF;
END //

CREATE TRIGGER before_land_images_insert
BEFORE INSERT ON land_images
FOR EACH ROW
BEGIN
    IF NEW.source_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Data integrity violation: image data must come from an external source_id';
    END IF;
END //

CREATE TRIGGER before_analytics_summaries_insert
BEFORE INSERT ON analytics_summaries
FOR EACH ROW
BEGIN
    IF NEW.source_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Data integrity violation: analytics summaries must come from an external source_id';
    END IF;
END //

CREATE TRIGGER before_land_alerts_insert
BEFORE INSERT ON land_alerts
FOR EACH ROW
BEGIN
    IF NEW.source_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Data integrity violation: land alerts must come from an external source_id';
    END IF;
END //

DELIMITER ;

-- ============================================================================
-- Ensure permissions are set correctly for the application user
-- ============================================================================
-- Note: These variables should match .env.db
-- GRANT ALL PRIVILEGES ON agriculture.* TO 'agri_user'@'%';
-- GRANT ALL PRIVILEGES ON test_agriculture.* TO 'agri_user'@'%';
-- FLUSH PRIVILEGES;
CREATE TABLE IF NOT EXISTS land_soil_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    ph_h2o FLOAT,
    soc_g_per_kg FLOAT,
    clay_pct FLOAT,
    sand_pct FLOAT,
    silt_pct FLOAT,
    bulk_density FLOAT,
    nitrogen_g_per_kg FLOAT,
    cec_cmol FLOAT,
    texture_class VARCHAR(50),
    depth_profile VARCHAR(50),
    suitability_score INT,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_id INT,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS land_soil_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    land_id INT NOT NULL,
    ph_h2o FLOAT,
    soc_g_per_kg FLOAT,
    clay_pct FLOAT,
    sand_pct FLOAT,
    silt_pct FLOAT,
    bulk_density FLOAT,
    nitrogen_g_per_kg FLOAT,
    cec_cmol FLOAT,
    texture_class VARCHAR(50),
    depth_profile VARCHAR(50),
    suitability_score INT,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_id INT,
    FOREIGN KEY (land_id) REFERENCES lands(land_id) ON DELETE CASCADE
);
