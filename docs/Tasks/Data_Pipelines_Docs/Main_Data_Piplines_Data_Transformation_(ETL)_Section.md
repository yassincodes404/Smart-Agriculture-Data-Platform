Good. We move directly to the next section and keep it strictly aligned with the ingestion output and overall pipeline.

---

# 2. Data Transformation (ETL) Section

## 2.1 Purpose

The ETL section is responsible for converting **raw ingested data** into **clean, consistent, structured datasets ready for analysis**.

This section sits **immediately after ingestion** and acts as the **quality control layer** of the system.

It ensures:

* Data is reliable
* Data is consistent across sources
* Data is usable for analytics and modeling

---

## 2.2 Position in Pipeline Flow

```text
Ingestion (raw data)
   ↓
ETL (clean + validate + normalize)
   ↓
Analytics / Feature Engineering
```

The ETL pipeline always consumes:

* Raw CSV files (`data/csv/`)
* Staging tables (from ingestion)

And produces:

* Clean, structured database tables

---

## 2.3 Placement in Project

```text
services/backend/app/tasks/
```

All ETL logic is executed as asynchronous pipelines (Celery tasks).

---

## 2.4 File Structure

```text
tasks/
├── etl_pipeline.py
├── data_cleaning.py
├── data_validation.py
├── data_normalization.py
├── data_loading.py
```

---

## 2.5 ETL Subcomponents (Core Responsibilities)

### 1. data_cleaning.py

Purpose:
Remove inconsistencies and obvious data issues.

Responsibilities:

* Handle missing values
* Remove duplicate records
* Fix inconsistent naming:

  * crop names
  * governorate names
* Trim strings and fix formatting issues

Important:
No assumptions or derived calculations here.

---

### 2. data_validation.py

Purpose:
Ensure data correctness before storing it.

Responsibilities:

* Schema validation (required columns exist)
* Data type validation (numeric, string, date)
* Range checks:

  * production ≥ 0
  * water usage ≥ 0
* Logical validation:

  * area cannot be zero if production exists

If validation fails:

* Reject record OR flag it

---

### 3. data_normalization.py

Purpose:
Standardize units and formats across all datasets.

Responsibilities:

* Convert units:

  * feddan → hectare (or unified unit)
  * kg → ton
  * water units → m³
* Standardize date formats
* Normalize categorical values

This ensures all datasets can be compared and joined.

---

### 4. data_loading.py

Purpose:
Load processed data into final database tables.

Responsibilities:

* Insert cleaned data into structured tables
* Handle upserts (avoid duplicates)
* Maintain referential integrity

---

### 5. etl_pipeline.py (Orchestrator)

This is the main pipeline controller.

Responsibilities:

1. Load raw data (from DB or CSV)
2. Pass data through:

   * cleaning
   * validation
   * normalization
3. Send processed data to loading module
4. Handle pipeline execution logic:

   * batching
   * retries
   * error handling

---

## 2.6 Data Flow Inside ETL

```text
Raw Data (CSV / staging tables)
   ↓
Cleaning
   ↓
Validation
   ↓
Normalization
   ↓
Loading into structured tables
```

---

## 2.7 Input Data (From Ingestion)

Examples of input datasets:

* crop production data
* water usage data
* climate data

As defined in ingestion and analysis plan 

These datasets are not yet consistent or clean.

---

## 2.8 Output Data (Structured Tables)

The ETL pipeline produces **clean domain tables**, such as:

* production_data
* water_usage_data
* climate_data

Characteristics:

* clean
* validated
* normalized
* ready for joins and analytics

---

## 2.9 Key Processing Rules

### Rule 1: No Business Logic

ETL does NOT:

* calculate KPIs
* compute analytics
* generate insights

---

### Rule 2: Deterministic Processing

Same input must always produce same output.

---

### Rule 3: Idempotency

Running ETL multiple times must:

* not duplicate data
* not corrupt data

---

### Rule 4: Separation from Ingestion

* Ingestion = collect data
* ETL = prepare data

They must not overlap.

---

## 2.10 Error Handling Strategy

The ETL pipeline must handle:

* Missing columns
* Invalid values
* Partial data corruption

Approach:

* Skip invalid rows OR flag them
* Log validation failures
* Continue processing valid data

---

## 2.11 Example Transformation Logic

Example: crop production dataset

Input (raw):

* inconsistent crop names
* mixed units (feddan, hectare)

After ETL:

* standardized crop names
* unified area unit
* validated production values

---

## 2.12 End Result of ETL Section

After this section:

* Data is clean
* Data is structured
* Data is consistent across all sources

This becomes the **foundation for all downstream pipelines**:

* analytics
* feature engineering
* prediction

---

## 2.13 Checkpoint

At this stage, the system has:

* Reliable datasets
* Standard schema
* Ready-to-use tables

---

Next step:

We move to **Analytical Processing Section**, where we define:

* exact KPIs
* aggregation logic
* per-module responsibilities

Or, if you want deeper precision, we can now define:

* exact database schema for ETL outputs (tables + columns)
