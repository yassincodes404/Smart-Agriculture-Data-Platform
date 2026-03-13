# Smart Agriculture Data Platform — Source Package
"""
test_sources.py — Data Source Smoke Tests

Tests connectivity to agricultural data sources and returns pandas DataFrames.
Sources that require credentials return placeholder DataFrames with instructions.
Sources without credentials use free, open APIs that work out of the box.
"""

import os
import sys
import tempfile
import glob
import zipfile
import json
import logging
from datetime import datetime, timedelta

import requests
import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("source_tester")


def _df_placeholder(msg):
    """Return a 1-row DataFrame containing a helpful message."""
    return pd.DataFrame({"status": ["missing_or_manual"], "message": [msg]})


# ================================================================
#  FREE SOURCES (no credentials needed)
# ================================================================

# ----------------------------
# 1. NASA POWER (weather)
# ----------------------------
def test_nasa_power(lat=30.0444, lon=31.2357, start="20230101", end="20230131", community="RE"):
    """
    NASA POWER daily weather data — free, no auth required.
    Returns temperature, precipitation, and solar radiation for a location.
    """
    try:
        base = "https://power.larc.nasa.gov/api/temporal/daily/point"
        params = {
            "parameters": "T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN",
            "community": community,
            "longitude": lon,
            "latitude": lat,
            "start": start,
            "end": end,
            "format": "JSON",
        }
        logger.info("NASA POWER: requesting %s", params)
        r = requests.get(base, params=params, timeout=30)
        if r.status_code != 200:
            try:
                logger.warning("NASA POWER returned %s: %s", r.status_code, r.text[:400])
            except Exception:
                pass
            r.raise_for_status()

        j = r.json()
        parameters = j.get("properties", {}).get("parameter", {})

        if "T2M" not in parameters:
            return _df_placeholder("NASA POWER didn't return T2M for this point/period.")

        df = pd.DataFrame(parameters["T2M"].items(), columns=["date", "temperature_2m"])
        if "PRECTOTCORR" in parameters:
            df["precipitation"] = df["date"].map(parameters["PRECTOTCORR"])
        if "ALLSKY_SFC_SW_DWN" in parameters:
            df["solar_radiation"] = df["date"].map(parameters["ALLSKY_SFC_SW_DWN"])

        df["date"] = pd.to_datetime(df["date"])
        df.attrs["source"] = "NASA POWER"
        return df
    except Exception as e:
        logger.exception("NASA POWER test failed")
        return _df_placeholder(f"NASA POWER error: {e}")


# ----------------------------
# 2. Open-Meteo (climate reanalysis)
# ----------------------------
def test_open_meteo(lat=30.0444, lon=31.2357, start="2023-01-01", end="2023-01-31"):
    """
    Open-Meteo historical weather API — free, no auth required.
    Great for agriculture: temperature, precipitation, evapotranspiration, soil moisture.
    """
    try:
        url = (
            f"https://archive-api.open-meteo.com/v1/archive"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date={start}&end_date={end}"
            f"&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,"
            f"precipitation_sum,et0_fao_evapotranspiration,"
            f"windspeed_10m_max,shortwave_radiation_sum"
            f"&timezone=Africa/Cairo"
        )
        logger.info("Open-Meteo: requesting climate data for (%s, %s)", lat, lon)
        r = requests.get(url, timeout=15)
        r.raise_for_status()

        j = r.json()
        daily = j.get("daily", {})
        if "time" not in daily:
            return _df_placeholder("Open-Meteo returned no daily data.")

        df = pd.DataFrame({
            "date": pd.to_datetime(daily["time"]),
            "temp_mean": daily.get("temperature_2m_mean"),
            "temp_max": daily.get("temperature_2m_max"),
            "temp_min": daily.get("temperature_2m_min"),
            "precipitation_mm": daily.get("precipitation_sum"),
            "et0_fao_mm": daily.get("et0_fao_evapotranspiration"),
            "wind_max_kmh": daily.get("windspeed_10m_max"),
            "solar_radiation_mj": daily.get("shortwave_radiation_sum"),
        })
        df.attrs["source"] = "Open-Meteo Climate"
        return df
    except Exception as e:
        logger.exception("Open-Meteo test failed")
        return _df_placeholder(f"Open-Meteo error: {e}")


# ----------------------------
# 3. Open-Meteo Soil Moisture
# ----------------------------
def test_open_meteo_soil(lat=30.0444, lon=31.2357, start="2023-01-01", end="2023-01-31"):
    """
    Open-Meteo soil moisture and soil temperature — free, no auth required.
    """
    try:
        url = (
            f"https://archive-api.open-meteo.com/v1/archive"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date={start}&end_date={end}"
            f"&hourly=soil_temperature_0_to_7cm,soil_moisture_0_to_7cm,"
            f"soil_moisture_7_to_28cm,soil_moisture_28_to_100cm"
            f"&timezone=Africa/Cairo"
        )
        logger.info("Open-Meteo Soil: requesting soil data for (%s, %s)", lat, lon)
        r = requests.get(url, timeout=15)
        r.raise_for_status()

        j = r.json()
        hourly = j.get("hourly", {})
        if "time" not in hourly:
            return _df_placeholder("Open-Meteo returned no hourly soil data.")

        df = pd.DataFrame({
            "datetime": pd.to_datetime(hourly["time"]),
            "soil_temp_0_7cm": hourly.get("soil_temperature_0_to_7cm"),
            "soil_moisture_0_7cm": hourly.get("soil_moisture_0_to_7cm"),
            "soil_moisture_7_28cm": hourly.get("soil_moisture_7_to_28cm"),
            "soil_moisture_28_100cm": hourly.get("soil_moisture_28_to_100cm"),
        })
        # Aggregate to daily for a smaller dataset
        df["date"] = df["datetime"].dt.date
        daily = df.groupby("date").mean(numeric_only=True).reset_index()
        daily.attrs["source"] = "Open-Meteo Soil"
        return daily
    except Exception as e:
        logger.exception("Open-Meteo Soil test failed")
        return _df_placeholder(f"Open-Meteo Soil error: {e}")


# ----------------------------
# 4. FEWS NET (food security)
# ----------------------------
def test_fewsnet(url="https://fews.net/data/agroclimatology-data"):
    """
    FEWS NET page check — looks for downloadable links.
    """
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        html = r.text[:5000]
        links = []
        for token in ["csv", "xls", "xlsx", ".zip"]:
            if token in html.lower():
                links.append(token)
        df = pd.DataFrame({"url_checked": [url], "found_tokens": [",".join(links)], "status": ["ok"]})
        df.attrs["source"] = "FEWS NET (page check)"
        return df
    except Exception as e:
        logger.exception("FEWSNET check failed")
        return _df_placeholder(f"FEWSNET error: {e}")


# ----------------------------
# 5. GADM (admin boundaries)
# ----------------------------
def test_gadm(country_iso="EGY"):
    """
    Downloads GADM shapefile for Egypt. Free, no auth required.
    """
    urls = [
        f"https://geodata.ucdavis.edu/gadm/gadm4.1/shp/gadm41_{country_iso}_shp.zip",
        f"https://geodata.ucdavis.edu/gadm/gadm3.6/shp/gadm36_{country_iso}_shp.zip",
    ]
    tmpdir = tempfile.mkdtemp(prefix="gadm_")
    for url in urls:
        try:
            logger.info("GADM: downloading from %s", url)
            r = requests.get(url, stream=True, timeout=60)
            if r.status_code != 200:
                logger.warning("GADM url %s returned %s", url, r.status_code)
                continue
            zpath = os.path.join(tmpdir, "gadm.zip")
            with open(zpath, "wb") as fh:
                for chunk in r.iter_content(1024 * 64):
                    fh.write(chunk)
            with zipfile.ZipFile(zpath, "r") as z:
                z.extractall(tmpdir)
            shp_files = glob.glob(os.path.join(tmpdir, "*.shp"))
            if not shp_files:
                shp_files = glob.glob(os.path.join(tmpdir, "**", "*.shp"), recursive=True)
            if not shp_files:
                return _df_placeholder("Downloaded GADM but no .shp found inside zip.")
            try:
                import geopandas as gpd
            except Exception:
                return _df_placeholder("geopandas not installed.")
            gdf = gpd.read_file(shp_files[0])
            gdf.attrs["source"] = "GADM"
            return pd.DataFrame(gdf.head(30))
        except Exception as e:
            logger.exception("GADM attempt failed for url %s", url)
            continue
    return _df_placeholder("GADM download failed. Network blocked or URL changed.")


# ================================================================
#  CREDENTIAL-REQUIRED SOURCES
# ================================================================

# ----------------------------
# 6. Google Earth Engine NDVI
# ----------------------------
def test_gee_ndvi(region_coords=[30.5, 30.5, 31.5, 31.5], start="2023-07-01", end="2023-07-31"):
    """
    Sentinel-2 NDVI via GEE — requires Earth Engine authentication.
    Run: earthengine authenticate
    """
    try:
        import ee
    except Exception:
        return _df_placeholder("earthengine-api not installed. pip install earthengine-api")

    try:
        ee.Initialize()
    except Exception:
        return _df_placeholder(
            "Earth Engine auth required. Run 'earthengine authenticate' or mount service-account key to /app/secrets/gee-sa-key.json"
        )

    try:
        region = ee.Geometry.Rectangle(region_coords)
        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR")
            .filterBounds(region)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        )

        def extract_mean(img):
            nd = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
            stats = nd.reduceRegion(ee.Reducer.mean(), region, scale=10, maxPixels=1e9)
            date = ee.Date(img.get("system:time_start")).format("YYYY-MM-dd")
            return ee.Feature(None, {"date": date, "ndvi": stats.get("NDVI")})

        feats = collection.limit(12).map(extract_mean).filter(ee.Filter.notNull(["ndvi"]))
        feats_list = feats.getInfo().get("features", [])

        rows = [{"date": f["properties"]["date"], "ndvi": f["properties"]["ndvi"]} for f in feats_list]
        if not rows:
            return _df_placeholder("GEE returned zero NDVI features for the query.")
        df = pd.DataFrame(rows)
        df["date"] = pd.to_datetime(df["date"])
        df.attrs["source"] = "GEE Sentinel-2 NDVI"
        return df
    except Exception as e:
        logger.exception("GEE NDVI test failed")
        return _df_placeholder(f"GEE NDVI error: {e}")


# ----------------------------
# 7. SMAP via GEE
# ----------------------------
def test_smap_gee(region_coords=[30.5, 30.5, 31.5, 31.5], start="2023-01-01", end="2023-01-31"):
    """SMAP soil moisture via GEE — requires Earth Engine authentication."""
    try:
        import ee
    except Exception:
        return _df_placeholder("earthengine-api not installed.")
    try:
        ee.Initialize()
    except Exception:
        return _df_placeholder("Earth Engine auth required (SMAP).")

    try:
        region = ee.Geometry.Rectangle(region_coords)
        coll = ee.ImageCollection("NASA_USDA/HSL/SMAP10KM_soil_moisture").filterDate(start, end).filterBounds(region)
        img = coll.mean()
        val = img.reduceRegion(reducer=ee.Reducer.mean(), geometry=region, scale=10000, maxPixels=1e9).getInfo()
        if not val:
            return _df_placeholder("SMAP (GEE) returned no values.")
        df = pd.DataFrame([val])
        df.attrs["source"] = "SMAP GEE"
        return df
    except Exception as e:
        logger.exception("SMAP GEE test failed")
        return _df_placeholder(f"SMAP GEE error: {e}")


# ----------------------------
# 8. ERA5 via CDS API
# ----------------------------
def test_era5_cds(area=[32, 24, 22, 36], year="2023"):
    """ERA5 reanalysis — requires CDSAPI_KEY in .env."""
    try:
        import cdsapi
        import xarray as xr
    except Exception:
        return _df_placeholder("cdsapi/xarray not installed.")

    api_key = os.environ.get("CDSAPI_KEY", "")
    if not api_key:
        return _df_placeholder(
            "CDSAPI_KEY not set. Register at https://cds.climate.copernicus.eu and add CDSAPI_KEY to .env"
        )

    try:
        api_url = os.environ.get("CDSAPI_URL", "https://cds.climate.copernicus.eu/api")
        c = cdsapi.Client(url=api_url, key=api_key)
        tmpfile = os.path.join(tempfile.gettempdir(), f"era5_test_{year}.nc")
        logger.info("ERA5: requesting small file -> %s", tmpfile)
        c.retrieve(
            "reanalysis-era5-single-levels",
            {
                "product_type": "reanalysis",
                "variable": ["2m_temperature"],
                "year": year, "month": "01", "day": "01", "time": "12:00",
                "format": "netcdf",
                "area": area,
            },
            tmpfile,
        )
        ds = xr.open_dataset(tmpfile)
        mean_val = float(ds["t2m"].mean().values)
        df = pd.DataFrame({"variable": ["t2m"], "mean": [mean_val]})
        df.attrs["source"] = "ERA5 CDS"
        return df
    except Exception as e:
        logger.exception("ERA5 CDS test failed")
        return _df_placeholder(f"ERA5 CDS error: {e}")


# ----------------------------
# 9. FAOSTAT
# ----------------------------
def test_faostat(area="Egypt", year=2022):
    """FAOSTAT crop production data. May timeout from Docker containers."""
    try:
        base = "https://fenixservices.fao.org/faostat/api/v1/en/data/QCL"
        params = {"area": "59", "output_type": "objects"}
        if year:
            params["year"] = str(year)
        logger.info("FAOSTAT: requesting %s", base)
        r = requests.get(base, params=params, timeout=60)
        r.raise_for_status()
        j = r.json()
        data = j.get("data") or j.get("Data") or []
        if not data:
            return _df_placeholder("FAOSTAT returned no data. Server may be slow — try again later.")
        df = pd.DataFrame(data)
        df.attrs["source"] = "FAOSTAT"
        return df
    except Exception as e:
        logger.exception("FAOSTAT test failed")
        return _df_placeholder(f"FAOSTAT error: {e}")


# ----------------------------
# 10. Egyptian Ministry of Agriculture DB
# ----------------------------
def test_moa_database():
    """Requires credentials file: ./credentials/moa_db.json"""
    cred_path = "./credentials/moa_db.json"
    if not os.path.exists(cred_path):
        return _df_placeholder(
            "MOA DB credentials not found. Create ./credentials/moa_db.json with DB connection info."
        )
    try:
        with open(cred_path, "r") as f:
            creds = json.load(f)
        db_type = creds.get("db_type")
        if db_type == "postgres":
            import psycopg2
            conn = psycopg2.connect(
                host=creds["host"], port=creds["port"],
                database=creds["database"], user=creds["user"], password=creds["password"],
            )
        elif db_type == "mssql":
            import pyodbc
            conn = pyodbc.connect(
                f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                f"SERVER={creds['host']},{creds['port']};"
                f"DATABASE={creds['database']};UID={creds['user']};PWD={creds['password']}"
            )
        else:
            return _df_placeholder("Unsupported DB type. Use 'postgres' or 'mssql'.")

        df = pd.read_sql("SELECT * FROM crop_production WHERE planting_date >= '2022-01-01' LIMIT 100", conn)
        conn.close()
        if df.empty:
            return _df_placeholder("MOA DB connected but returned no rows.")
        df.attrs["source"] = "Ministry of Agriculture DB"
        return df
    except Exception as e:
        logger.exception("MOA DB test failed")
        return _df_placeholder(f"MOA DB error: {e}")


# ----------------------------
# 11. CAPMAS Excel (local)
# ----------------------------
def test_capmas_local(folder="./data/capmas"):
    """Reads local CAPMAS Excel files from data/capmas/."""
    try:
        path = os.path.abspath(folder)
        if not os.path.isdir(path):
            return _df_placeholder(f"CAPMAS: folder {path} not found. Place official Excel files there.")
        files = glob.glob(os.path.join(path, "*.xls*"))
        if not files:
            return _df_placeholder(f"CAPMAS: no Excel files found in {path}.")
        dfs = []
        for f in files:
            try:
                d = pd.read_excel(f)
                d["__source_file"] = os.path.basename(f)
                dfs.append(d)
            except Exception as e:
                logger.exception("Failed to read CAPMAS file %s", f)
        if not dfs:
            return _df_placeholder("Failed to read any CAPMAS Excel files.")
        df_all = pd.concat(dfs, ignore_index=True, sort=False)
        df_all.attrs["source"] = "CAPMAS local"
        return df_all
    except Exception as e:
        logger.exception("CAPMAS local test failed")
        return _df_placeholder(f"CAPMAS error: {e}")


# ================================================================
#  Runner
# ================================================================
def run_all_tests():
    results = {}
    logger.info("Starting source tests...")

    # Free sources (always work)
    results["nasa_power"] = test_nasa_power()
    results["open_meteo_climate"] = test_open_meteo()
    results["open_meteo_soil"] = test_open_meteo_soil()
    results["fewsnet"] = test_fewsnet()
    results["gadm"] = test_gadm(country_iso="EGY")

    # Credential-required sources
    results["gee_ndvi"] = test_gee_ndvi()
    results["smap_gee"] = test_smap_gee()
    results["era5_cds"] = test_era5_cds()
    results["faostat"] = test_faostat(area="Egypt", year=2022)
    results["capmas_local"] = test_capmas_local(folder="./data/capmas")

    # ── Save each result as a CSV ─────────────────────────────
    outdir = "./data/sources"
    os.makedirs(outdir, exist_ok=True)

    logger.info("Source tests completed. Summary:")
    for name, df in results.items():
        nrows = len(df) if hasattr(df, "__len__") else "?"
        is_placeholder = (
            len(df) == 1
            and "status" in df.columns
            and df.iloc[0].get("status") == "missing_or_manual"
        ) if hasattr(df, "columns") else False

        source_label = getattr(df, "attrs", {}).get("source", name)
        status_icon = "⏭️" if is_placeholder else "✅"
        logger.info(" %s %-22s : rows=%-5s  source=%s",
                     status_icon, name, nrows, source_label)

        # Save CSV
        safe_name = name.replace("/", "_").replace(" ", "_")
        csv_path = os.path.join(outdir, f"{safe_name}.csv")
        try:
            df.to_csv(csv_path, index=False)
            logger.info("   -> saved %s (%s rows)", csv_path, nrows)
        except Exception as exc:
            logger.warning("   -> failed to save %s: %s", csv_path, exc)

    logger.info("All CSV files saved to %s/", outdir)
    return results


if __name__ == "__main__":
    run_all_tests()
    print("Done. See CSV files in ./data/sources/")