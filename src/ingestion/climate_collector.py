"""
Climate Data Collector — All Egyptian Governorates
====================================================
Queries Open-Meteo API for all 27 governorates across multiple years.
Produces CSV files for climate analysis, soil moisture, and water consumption.
"""

import os
import time
import logging
from datetime import datetime

import requests
import pandas as pd
import numpy as np

from src.ingestion.egypt_data import EGYPT_GOVERNORATES, CROP_KC_VALUES, IRRIGATION_EFFICIENCY

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("climate_collector")

OUT_DIR = "./data/sources"


def _request_with_retry(url, max_retries=3, base_wait=5):
    """Make a GET request with exponential backoff on 429 errors."""
    for attempt in range(max_retries + 1):
        r = requests.get(url, timeout=30)
        if r.status_code == 429:
            wait = base_wait * (2 ** attempt)
            logger.warning("  Rate limited (429) — waiting %ds (attempt %d/%d)", wait, attempt + 1, max_retries)
            time.sleep(wait)
            continue
        r.raise_for_status()
        return r
    # Final attempt
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r


def fetch_open_meteo_climate(lat, lon, start_date, end_date):
    """Fetch daily climate data from Open-Meteo archive API."""
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,"
        f"precipitation_sum,et0_fao_evapotranspiration,"
        f"windspeed_10m_max,shortwave_radiation_sum,"
        f"relative_humidity_2m_mean"
        f"&timezone=Africa/Cairo"
    )
    r = _request_with_retry(url)
    daily = r.json().get("daily", {})
    if "time" not in daily:
        return pd.DataFrame()

    return pd.DataFrame({
        "date": pd.to_datetime(daily["time"]),
        "temp_mean": daily.get("temperature_2m_mean"),
        "temp_max": daily.get("temperature_2m_max"),
        "temp_min": daily.get("temperature_2m_min"),
        "precipitation_mm": daily.get("precipitation_sum"),
        "et0_fao_mm": daily.get("et0_fao_evapotranspiration"),
        "wind_max_kmh": daily.get("windspeed_10m_max"),
        "solar_radiation_mj": daily.get("shortwave_radiation_sum"),
        "humidity_pct": daily.get("relative_humidity_2m_mean"),
    })


def fetch_open_meteo_soil(lat, lon, start_date, end_date):
    """Fetch hourly soil data, aggregate to daily."""
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&hourly=soil_temperature_0_to_7cm,soil_moisture_0_to_7cm,"
        f"soil_moisture_7_to_28cm,soil_moisture_28_to_100cm"
        f"&timezone=Africa/Cairo"
    )
    r = _request_with_retry(url)
    hourly = r.json().get("hourly", {})
    if "time" not in hourly:
        return pd.DataFrame()

    df = pd.DataFrame({
        "datetime": pd.to_datetime(hourly["time"]),
        "soil_temp_0_7cm": hourly.get("soil_temperature_0_to_7cm"),
        "soil_moisture_0_7cm": hourly.get("soil_moisture_0_to_7cm"),
        "soil_moisture_7_28cm": hourly.get("soil_moisture_7_to_28cm"),
        "soil_moisture_28_100cm": hourly.get("soil_moisture_28_to_100cm"),
    })
    df["date"] = df["datetime"].dt.date
    daily = df.groupby("date").mean(numeric_only=True).reset_index()
    daily["date"] = pd.to_datetime(daily["date"])
    return daily


# ── Main Collectors ──────────────────────────────────────────

def collect_all_governorate_climate(years=None):
    """
    Collect daily climate data for all 27 governorates.
    Returns a big DataFrame and saves to CSV.
    """
    if years is None:
        years = [2019, 2020, 2021, 2022, 2023]

    os.makedirs(OUT_DIR, exist_ok=True)
    all_frames = []

    for gov in EGYPT_GOVERNORATES:
        name = gov["name"]
        lat, lon = gov["lat"], gov["lon"]
        logger.info("Fetching climate for %s (%s) [%s, %s]", name, gov["name_ar"], lat, lon)

        for year in years:
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            try:
                df = fetch_open_meteo_climate(lat, lon, start_date, end_date)
                if df.empty:
                    logger.warning("  %s/%s — no data", name, year)
                    continue
                df["governorate"] = name
                df["governorate_ar"] = gov["name_ar"]
                df["region"] = gov["region"]
                df["year"] = year
                all_frames.append(df)
                logger.info("  %s/%s — %d rows", name, year, len(df))
            except Exception as e:
                logger.error("  %s/%s — error: %s", name, year, e)

            time.sleep(1.5)  # be nice to the API

    if not all_frames:
        logger.error("No climate data collected!")
        return pd.DataFrame()

    big_df = pd.concat(all_frames, ignore_index=True)
    csv_path = os.path.join(OUT_DIR, "governorate_climate_5yr.csv")
    big_df.to_csv(csv_path, index=False)
    logger.info("Saved %d rows to %s", len(big_df), csv_path)
    return big_df


def collect_all_governorate_soil(years=None):
    """
    Collect daily soil data for all 27 governorates.
    """
    if years is None:
        years = [2019, 2020, 2021, 2022, 2023]

    os.makedirs(OUT_DIR, exist_ok=True)
    all_frames = []

    for gov in EGYPT_GOVERNORATES:
        name = gov["name"]
        lat, lon = gov["lat"], gov["lon"]
        logger.info("Fetching soil for %s (%s)", name, gov["name_ar"])

        for year in years:
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            try:
                df = fetch_open_meteo_soil(lat, lon, start_date, end_date)
                if df.empty:
                    continue
                df["governorate"] = name
                df["governorate_ar"] = gov["name_ar"]
                df["region"] = gov["region"]
                df["year"] = year
                all_frames.append(df)
                logger.info("  %s/%s — %d rows", name, year, len(df))
            except Exception as e:
                logger.error("  %s/%s — error: %s", name, year, e)

            time.sleep(1.5)

    if not all_frames:
        return pd.DataFrame()

    big_df = pd.concat(all_frames, ignore_index=True)
    csv_path = os.path.join(OUT_DIR, "governorate_soil_5yr.csv")
    big_df.to_csv(csv_path, index=False)
    logger.info("Saved %d rows to %s", len(big_df), csv_path)
    return big_df


def calculate_water_consumption(climate_df=None):
    """
    Calculate crop water requirements for each governorate using FAO method.
    ETcrop = ET0 × Kc (crop coefficient)
    Also computes irrigation water need and efficiency metrics.
    """
    if climate_df is None:
        csv_path = os.path.join(OUT_DIR, "governorate_climate_5yr.csv")
        if not os.path.exists(csv_path):
            logger.error("Climate CSV not found. Run collect_all_governorate_climate first.")
            return pd.DataFrame()
        climate_df = pd.read_csv(csv_path, parse_dates=["date"])

    os.makedirs(OUT_DIR, exist_ok=True)

    # Aggregate ET0 by governorate × year (annual sum in mm)
    annual_et0 = (
        climate_df
        .groupby(["governorate", "governorate_ar", "region", "year"])
        .agg(
            et0_annual_mm=("et0_fao_mm", "sum"),
            precip_annual_mm=("precipitation_mm", "sum"),
            temp_annual_mean=("temp_mean", "mean"),
            humidity_annual_mean=("humidity_pct", "mean"),
        )
        .reset_index()
    )

    rows = []
    for _, gov_row in annual_et0.iterrows():
        for crop_name, kc in CROP_KC_VALUES.items():
            # Average Kc across the season
            kc_avg = (kc["kc_ini"] + kc["kc_mid"] + kc["kc_end"]) / 3

            # Crop water need (mm/year, scaled by season length)
            season_fraction = kc["season_days"] / 365.0
            et_crop_mm = gov_row["et0_annual_mm"] * kc_avg * season_fraction

            # Effective rainfall (mm during crop season)
            effective_rain = gov_row["precip_annual_mm"] * season_fraction * 0.8  # 80% efficiency

            # Irrigation water need (mm)
            irrigation_need_mm = max(0, et_crop_mm - effective_rain)

            # Actual irrigation water (accounting for efficiency losses)
            egypt_eff = IRRIGATION_EFFICIENCY["egypt_average"]
            drip_eff = IRRIGATION_EFFICIENCY["drip"]

            actual_irrigation_flood = irrigation_need_mm / egypt_eff
            actual_irrigation_drip = irrigation_need_mm / drip_eff

            # Convert mm to m³/hectare (1 mm = 10 m³/ha)
            water_m3_per_ha_flood = actual_irrigation_flood * 10
            water_m3_per_ha_drip = actual_irrigation_drip * 10

            rows.append({
                "governorate": gov_row["governorate"],
                "governorate_ar": gov_row["governorate_ar"],
                "region": gov_row["region"],
                "year": gov_row["year"],
                "crop": crop_name,
                "crop_season": kc["season"],
                "kc_avg": round(kc_avg, 2),
                "et0_annual_mm": round(gov_row["et0_annual_mm"], 1),
                "et_crop_mm": round(et_crop_mm, 1),
                "precip_annual_mm": round(gov_row["precip_annual_mm"], 1),
                "effective_rain_mm": round(effective_rain, 1),
                "irrigation_need_mm": round(irrigation_need_mm, 1),
                "water_m3_per_ha_flood": round(water_m3_per_ha_flood, 0),
                "water_m3_per_ha_drip": round(water_m3_per_ha_drip, 0),
                "water_saving_drip_pct": round((1 - drip_eff / egypt_eff) * -100, 1) if egypt_eff > 0 else 0,
                "temp_annual_mean": round(gov_row["temp_annual_mean"], 1),
                "humidity_annual_mean": round(gov_row["humidity_annual_mean"], 1),
            })

    water_df = pd.DataFrame(rows)
    csv_path = os.path.join(OUT_DIR, "governorate_water_consumption.csv")
    water_df.to_csv(csv_path, index=False)
    logger.info("Saved %d rows (water consumption) to %s", len(water_df), csv_path)
    return water_df


def read_faostat_local(folder="./data/faostat"):
    """
    Read FAOSTAT CSV files that user downloaded manually.
    Place files in ./data/faostat/
    """
    import glob
    path = os.path.abspath(folder)
    if not os.path.isdir(path):
        os.makedirs(path, exist_ok=True)
        logger.info("Created %s — place FAOSTAT CSV files here", path)
        return pd.DataFrame()

    files = glob.glob(os.path.join(path, "*.csv"))
    if not files:
        logger.info("No FAOSTAT CSV files found in %s", path)
        return pd.DataFrame()

    dfs = []
    for f in files:
        try:
            d = pd.read_csv(f, encoding="utf-8")
            d["__source_file"] = os.path.basename(f)
            dfs.append(d)
            logger.info("Read FAOSTAT file: %s (%d rows)", os.path.basename(f), len(d))
        except Exception as e:
            logger.error("Failed to read %s: %s", f, e)

    if not dfs:
        return pd.DataFrame()

    combined = pd.concat(dfs, ignore_index=True, sort=False)
    out_path = os.path.join(OUT_DIR, "faostat_combined.csv")
    combined.to_csv(out_path, index=False)
    logger.info("Saved FAOSTAT combined: %d rows to %s", len(combined), out_path)
    return combined


def read_capmas_local(folder="./data/capmas"):
    """
    Read CAPMAS Excel files that user downloaded manually.
    Place files in ./data/capmas/
    """
    import glob
    path = os.path.abspath(folder)
    if not os.path.isdir(path):
        os.makedirs(path, exist_ok=True)
        logger.info("Created %s — place CAPMAS Excel files here", path)
        return pd.DataFrame()

    files = glob.glob(os.path.join(path, "*.xls*"))
    if not files:
        logger.info("No CAPMAS Excel files found in %s", path)
        return pd.DataFrame()

    dfs = []
    for f in files:
        try:
            d = pd.read_excel(f)
            d["__source_file"] = os.path.basename(f)
            dfs.append(d)
            logger.info("Read CAPMAS file: %s (%d rows)", os.path.basename(f), len(d))
        except Exception as e:
            logger.error("Failed to read %s: %s", f, e)

    if not dfs:
        return pd.DataFrame()

    combined = pd.concat(dfs, ignore_index=True, sort=False)
    out_path = os.path.join(OUT_DIR, "capmas_combined.csv")
    combined.to_csv(out_path, index=False)
    logger.info("Saved CAPMAS combined: %d rows to %s", len(combined), out_path)
    return combined


# ── Run Everything ───────────────────────────────────────────

def run_full_collection():
    """Run the complete data collection pipeline."""
    logger.info("=" * 60)
    logger.info("  Egyptian Agriculture — Full Data Collection")
    logger.info("=" * 60)

    # 1. Climate data (all governorates, 5 years)
    logger.info("\n[1/4] Collecting climate data...")
    climate_df = collect_all_governorate_climate()

    # 2. Soil data (all governorates, 5 years)
    logger.info("\n[2/4] Collecting soil data...")
    soil_df = collect_all_governorate_soil()

    # 3. Water consumption model
    logger.info("\n[3/4] Calculating water consumption...")
    water_df = calculate_water_consumption(climate_df)

    # 4. Local data (FAOSTAT + CAPMAS)
    logger.info("\n[4/4] Reading local data files...")
    faostat_df = read_faostat_local()
    capmas_df = read_capmas_local()

    logger.info("\n" + "=" * 60)
    logger.info("  Collection Summary:")
    logger.info("  Climate:    %d rows", len(climate_df) if not climate_df.empty else 0)
    logger.info("  Soil:       %d rows", len(soil_df) if not soil_df.empty else 0)
    logger.info("  Water:      %d rows", len(water_df) if not water_df.empty else 0)
    logger.info("  FAOSTAT:    %d rows", len(faostat_df) if not faostat_df.empty else 0)
    logger.info("  CAPMAS:     %d rows", len(capmas_df) if not capmas_df.empty else 0)
    logger.info("=" * 60)

    return {
        "climate": climate_df,
        "soil": soil_df,
        "water": water_df,
        "faostat": faostat_df,
        "capmas": capmas_df,
    }


if __name__ == "__main__":
    run_full_collection()
