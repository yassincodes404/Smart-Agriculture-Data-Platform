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
