Good. We will go step by step and stay strictly focused.

---

# 1. Data Ingestion Section (Detailed Definition)

## 1.1 Purpose

The Data Ingestion section is responsible for **bringing all external and internal data into the system in a controlled, repeatable way**.

It is the **first and most critical pipeline stage**, because all downstream pipelines depend on it.

From the system design, ingestion must support:

* Multiple heterogeneous sources
* Automated and manual data entry
* Scheduling and retry mechanisms 

---

## 1.2 What This Section Must Handle

The ingestion layer must support the following data categories:

### 1. Official agricultural datasets

* Crop production
* Area (feddan / hectare)
* Yield
* Source: CAPMAS, FAOSTAT

### 2. Water datasets

* Water consumption per crop
* Irrigation systems
* Source: CSV + official datasets

### 3. Climate datasets

* Temperature
* Humidity
* Multi-year records
* Source: climate datasets (NASA or similar)

### 4. Manual uploads

* CSV files uploaded from users or stakeholders

---

## 1.3 Types of Ingestion

The system must support **three ingestion modes**:

### A. API-based ingestion

* Pull data from external APIs
* Example: FAOSTAT, NASA

### B. File-based ingestion

* Load CSV files
* Example:

  * egypt_crop_production.csv
  * egypt_crop_water_use.csv
  * governorate_climate_5yr.csv 

### C. Manual upload ingestion

* User uploads CSV via frontend
* Stored in `data/csv/` then processed

---

## 1.4 Placement in Project

### Connectors (data access)

```text
services/backend/app/search/
```

### Pipeline execution

```text
services/backend/app/tasks/
```

### Storage targets

```text
data/csv/        → raw files
database         → structured tables
```

This aligns with the defined architecture where:

* `search/` handles external communication
* `tasks/` executes pipelines asynchronously 

---

## 1.5 File-Level Design

### In search/

Each file represents a **single data source connector**:

```text
search/
├── faostat_client.py
├── capmas_loader.py
├── climate_loader.py
├── water_loader.py
```

#### Responsibilities

Each connector must:

* Authenticate if needed
* Fetch raw data
* Convert to structured format (DataFrame / dict)
* Handle source-specific errors

---

### In tasks/

```text
tasks/
├── ingestion_pipeline.py
├── ingestion_scheduler.py
```

---

## 1.6 Core Pipeline Logic

### ingestion_pipeline.py

This is the **central orchestrator**.

Responsibilities:

1. Call all connectors from `search/`
2. Receive raw datasets
3. Apply minimal standardization:

   * column naming consistency
   * basic formatting
4. Store outputs:

   * raw CSV → `data/csv/`
   * structured → database tables
5. Track ingestion status (success/failure)
6. Handle retries

---

### ingestion_scheduler.py

Responsibilities:

* Define when ingestion runs

Examples:

* Climate data → daily
* Production data → monthly
* Manual uploads → event-based

This matches the requirement for:

* automation
* repeatability
* reliability 

---

## 1.7 Data Standardization at Ingestion Stage

Important rule:

> Ingestion does NOT fully clean data
> It only ensures minimal consistency

What is allowed here:

* rename columns
* ensure required fields exist
* basic type conversion

What is NOT allowed:

* heavy cleaning
* aggregation
* analytics

Those belong to ETL.

---

## 1.8 Data Outputs

The ingestion pipeline produces **two outputs**:

### 1. Raw Data (immutable)

Stored in:

```text
data/csv/
```

Purpose:

* traceability
* reproducibility

---

### 2. Staging Tables (database)

Stored in database as:

* raw_production_data
* raw_water_data
* raw_climate_data

Purpose:

* input for ETL pipeline

---

## 1.9 Failure Handling

The ingestion pipeline must handle:

* API failures
* missing files
* corrupted data

Mechanisms:

* retry logic
* partial ingestion support
* error logging (basic level)

---

## 1.10 End-to-End Flow

```text
Data Source
   ↓
search/ connector
   ↓
ingestion_pipeline
   ↓
Raw storage (csv)
   ↓
Staging tables (DB)
```

---

## 1.11 Key Constraints

1. No business logic in ingestion
2. No analytics in ingestion
3. No feature engineering in ingestion
4. Must be idempotent (safe to rerun)
5. Must support multiple sources independently

---

# 1.12 What We Defined (Checkpoint)

We now have a clear definition of:

* Purpose of ingestion
* Data types handled
* File structure
* Responsibilities per file
* Execution flow
* Boundaries with other pipelines

---

Next step (recommended):

We go to **Data Transformation (ETL)** and define:

* exact cleaning rules
* schema design
* table structure

Or if you prefer, we can go deeper into ingestion itself:

* exact DB staging tables
* exact function signatures for connectors
