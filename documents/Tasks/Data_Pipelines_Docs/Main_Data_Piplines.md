Understood. I will focus only on the **core data pipelines (non-CV, non-logging)** and rewrite them in a **clear, engineering-grade document**, with precise structure, responsibilities, and flow.

---

# 1. Scope of This Document

This document defines the **main data pipelines** for the platform, excluding:

* Computer Vision pipelines (NDVI, imagery)
* Logging / monitoring pipelines

The focus is on:

1. Data ingestion
2. Data transformation (ETL)
3. Analytical pipelines
4. Feature engineering
5. Predictive pipelines
6. Reporting / export pipelines

These pipelines are derived from:

* The system architecture and data flow 
* The Egyptian agricultural analysis axes 

---

# 2. Pipeline Placement in Project

All pipelines must be implemented inside:

```
services/backend/app/
```

### Exact structure

```
app/
├── tasks/        → all pipeline execution (Celery)
├── search/       → external data connectors
├── ai/           → ML models only
├── models/       → database schema
├── db/           → DB session
```

### Rule

* Pipelines are implemented in `tasks/`
* External data access is implemented in `search/`
* Models are implemented in `ai/`
* No pipeline logic exists in `api/`

---

# 3. Data Ingestion Pipelines

## 3.1 Purpose

Collect raw data from all external and internal sources and store it in:

* `data/csv/` (raw files)
* Database (structured tables)

Sources include:

* FAOSTAT
* CAPMAS
* Climate datasets
* Water datasets
* Manual CSV uploads

---

## 3.2 File Structure

```
search/
├── faostat_client.py
├── capmas_loader.py
├── climate_loader.py
├── water_loader.py

tasks/
├── ingestion_pipeline.py
├── ingestion_scheduler.py
```

---

## 3.3 Responsibilities

### search/*.py (connectors)

Each file:

* Handles one data source
* Fetches raw data
* Returns structured data (DataFrame or JSON)

Examples:

* faostat_client.py → crop production data
* capmas_loader.py → official Egypt datasets
* climate_loader.py → temperature, humidity
* water_loader.py → irrigation data

---

### ingestion_pipeline.py

Central orchestration pipeline:

Responsibilities:

* Calls all source connectors
* Standardizes returned data format
* Stores raw files in `data/csv/`
* Inserts structured data into DB
* Handles retries and failures

---

### ingestion_scheduler.py

Responsibilities:

* Defines periodic jobs
* Example:

  * daily climate updates
  * monthly production updates

---

## 3.4 Flow

```
External Source
    ↓
search/clients
    ↓
ingestion_pipeline
    ↓
Raw storage (csv) + Database
```

---

# 4. Data Transformation (ETL) Pipeline

## 4.1 Purpose

Convert raw ingested data into **clean, consistent, analysis-ready datasets**

---

## 4.2 File Structure

```
tasks/
├── etl_pipeline.py
├── data_cleaning.py
├── data_validation.py
├── data_normalization.py
```

---

## 4.3 Responsibilities

### etl_pipeline.py

Main orchestrator:

* Loads raw data from DB or CSV
* Calls cleaning, validation, normalization
* Writes processed data back to DB

---

### data_cleaning.py

* Handle missing values
* Remove duplicates
* Fix inconsistent labels (crop names, governorates)

---

### data_validation.py

* Schema validation
* Range checks (e.g., negative production not allowed)
* Data completeness checks

---

### data_normalization.py

* Unit standardization:

  * hectare vs feddan
  * ton vs kg
  * water m³ conversions

---

## 4.4 Flow

```
Raw Data
   ↓
Cleaning
   ↓
Validation
   ↓
Normalization
   ↓
Processed Tables
```

---

# 5. Analytical Pipelines

## 5.1 Purpose

Generate core agricultural insights required by the system.

Derived directly from Egyptian analysis requirements .

---

## 5.2 File Structure

```
tasks/
├── analytics_area.py
├── analytics_crop_distribution.py
├── analytics_production.py
├── analytics_water.py
├── analytics_climate.py
```

---

## 5.3 Pipelines Description

### analytics_area.py

* Compute cultivated area per governorate
* Calculate percentage of total agricultural land

---

### analytics_crop_distribution.py

* Crop distribution per governorate
* Crop share (%) per region

---

### analytics_production.py

* Total production per crop
* Ranking of crops
* Governorate contribution to national production

---

### analytics_water.py

* Water consumption per crop
* Water per ton metric
* Irrigation comparison (flood vs drip)

---

### analytics_climate.py

* Temperature vs yield relationship
* Humidity impact
* Multi-year correlation analysis

---

## 5.4 Output

Stored in DB as:

* aggregated tables
* KPI tables
* time-series tables

---

# 6. Feature Engineering Pipeline

## 6.1 Purpose

Prepare datasets for machine learning and advanced analytics.

---

## 6.2 File Structure

```
tasks/
├── feature_engineering.py
├── dataset_builder.py
```

---

## 6.3 Responsibilities

### feature_engineering.py

* Create derived features:

  * yield_per_hectare
  * water_efficiency
  * production_growth_rate
  * climate_index

---

### dataset_builder.py

* Join multiple datasets:

  * production + climate + water
* Create ML-ready tables

---

## 6.4 Flow

```
Processed Data
   ↓
Feature Engineering
   ↓
Joined Dataset
   ↓
ML-ready Dataset
```

---

# 7. Predictive Pipelines

## 7.1 Purpose

Generate predictions and decision-support outputs.

Defined in system goals .

---

## 7.2 File Structure

```
ai/
├── models/
│   ├── yield_model.py
│   ├── water_efficiency_model.py
│   ├── climate_impact_model.py

tasks/
├── prediction_pipeline.py
```

---

## 7.3 Responsibilities

### prediction_pipeline.py

* Loads engineered dataset
* Runs models
* Stores predictions in DB

---

### Models

#### yield_model.py

* Predict crop yield

#### water_efficiency_model.py

* Predict water usage efficiency

#### climate_impact_model.py

* Predict climate risk impact

---

## 7.4 Output

* prediction tables
* risk indicators
* scenario simulations

---

# 8. Reporting and Export Pipelines

## 8.1 Purpose

Deliver final outputs for dashboards and external use.

---

## 8.2 File Structure

```
tasks/
├── reporting_pipeline.py

backup/
├── export_csv.py
├── export_tables.py
```

---

## 8.3 Responsibilities

### reporting_pipeline.py

* Aggregate final KPIs
* Prepare API-ready datasets

---

### export_csv.py

* Export datasets to CSV

---

### export_tables.py

* Export summarized tables
* Support reporting tools

---

## 8.4 Outputs

* dashboard datasets
* downloadable CSV files
* structured reports

---

# 9. End-to-End Data Flow

```
1. Ingestion Pipeline
   ↓
2. ETL Pipeline
   ↓
3. Analytical Pipelines
   ↓
4. Feature Engineering
   ↓
5. Prediction Pipeline
   ↓
6. Reporting Pipeline
```

---

# 10. Key Architectural Rules

1. All pipelines are executed via `tasks/` using Celery
2. Pipelines are modular and independent
3. Each pipeline writes results back to the database
4. No pipeline logic exists in API layer
5. Data always flows forward (no circular dependencies)

---

# 11. What This Covers

This document gives you:

* Exact pipeline breakdown
* File-level architecture
* Responsibilities per module
* Clear execution flow
* Alignment with all project sources

---

If you want next step, the most critical one is:

* detailed database schema that matches these pipelines
  or
* exact Celery orchestration (task chaining, scheduling, retries)

Both are required before implementation.
S