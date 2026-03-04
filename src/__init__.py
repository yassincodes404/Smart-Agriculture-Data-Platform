# Smart Agriculture Data Platform — Source Package
"""
test_sources.py

Purpose:
 - Test connectivity to all agri data sources and return pandas DataFrames (or helpful placeholders).
 - Meant as a diagnostic / smoke-test for your ingestion pipeline.

Requirements:
 - Python 3.11 recommended
 - pip install requests pandas numpy earthengine-api cdsapi xarray netCDF4 geopandas rasterio fiona shapely pyproj openpyxl boto3
 - Place credentials (if any) under ./credentials (see each function for details)
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




# ----------------------------
# Egyptian Ministry of Agriculture DB test
# ----------------------------
def test_moa_database():
    """
    Connects to Ministry of Agriculture internal database.
    Requires credentials file: ./credentials/moa_db.json
    
    Example structure:
    {
        "db_type": "postgres",   # or "mssql"
        "host": "10.0.0.15",
        "port": 5432,
        "database": "agriculture_db",
        "user": "readonly_user",
        "password": "your_password"
    }
    """

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
                host=creds["host"],
                port=creds["port"],
                database=creds["database"],
                user=creds["user"],
                password=creds["password"],
            )

        elif db_type == "mssql":
            import pyodbc
            conn_str = (
                f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                f"SERVER={creds['host']},{creds['port']};"
                f"DATABASE={creds['database']};"
                f"UID={creds['user']};"
                f"PWD={creds['password']}"
            )
            conn = pyodbc.connect(conn_str)

        else:
            return _df_placeholder("Unsupported DB type. Use 'postgres' or 'mssql'.")

        query = """
        SELECT 
            crop_name,
            governorate,
            cultivated_area_hectare,
            production_tons,
            planting_date,
            harvest_date
        FROM crop_production
        WHERE planting_date >= '2022-01-01'
        LIMIT 100
        """

        df = pd.read_sql(query, conn)
        conn.close()

        if df.empty:
            return _df_placeholder("MOA DB connected but returned no rows.")

        df.attrs["source"] = "Ministry of Agriculture DB"
        return df

    except Exception as e:
        logger.exception("MOA DB test failed")
        return _df_placeholder(f"MOA DB error: {e}")
def _df_placeholder(msg):
    """Return a 1-row DataFrame containing a helpful message (for manual steps/credentials)."""
    return pd.DataFrame({"status": ["missing_or_manual"], "message": [msg]})


# ----------------------------
# FAOSTAT (fenixservices) test
# ----------------------------
def test_faostat(area="Egypt", item=None, year=None):
    """
    Tries FAOSTAT bulk-download API.
    Falls back to the SWS domain CSV endpoint if the old fenixservices URL fails.
    """
    try:
        # Primary: FAOSTAT bulk CSV (more reliable)
        bulk_url = "https://www.fao.org/faostat/en/#data/QCL"
        # We use the new REST API with area_codes for Egypt=59
        base = "https://www.fao.org/faostat/api/v1/en/data/QCL"
        params = {"area": "59"}  # Egypt country code
        if year:
            params["year"] = str(year)
        logger.info("FAOSTAT: requesting %s params=%s", base, params)
        r = requests.get(base, params=params, timeout=30)
        if r.status_code != 200:
            # Fallback: try fenixservices
            base2 = "https://fenixservices.fao.org/faostat/api/v1/en/data/QCL"
            logger.info("FAOSTAT fallback: %s", base2)
            r = requests.get(base2, params=params, timeout=30)
        r.raise_for_status()
        j = r.json()
        data = j.get("data") or j.get("Data") or []
        if not data:
            return _df_placeholder("FAOSTAT returned no rows for query. Try different area/item/year.")
        df = pd.DataFrame(data)
        df.attrs["source"] = "FAOSTAT"
        return df
    except Exception as e:
        logger.exception("FAOSTAT test failed")
        return _df_placeholder(f"FAOSTAT error: {e}")


# ----------------------------
# Egypt Open Data (CKAN) test
# ----------------------------
def test_egypt_opendata():
    """
    Tries multiple Egyptian open-data portals.
    """
    urls = [
        "https://egypt.opendataforafrica.org/api/3/action/package_list",
        "https://data.gov.eg/api/3/action/package_list",
    ]
    for base in urls:
        try:
            logger.info("Egypt Open Data: trying %s", base)
            r = requests.get(base, timeout=15)
            if r.status_code != 200:
                continue
            j = r.json()
            if not j.get("success"):
                continue
            packages = j.get("result", [])[:50]
            df = pd.DataFrame({"package_id": packages})
            df.attrs["source"] = "Egypt Open Data"
            return df
        except Exception as e:
            logger.warning("Egypt Open Data URL %s failed: %s", base, e)
            continue
    return _df_placeholder("Egypt Open Data: no portal responded. May require VPN or manual access.")


# ----------------------------
# NASA POWER (weather) test
# ----------------------------
def test_nasa_power(lat=30.0444, lon=31.2357, start="20230101", end="20230110", community="RE"):
    """
    Robust NASA POWER sample for a short period.
    Returns a DataFrame with date, temperature_2m, precipitation (if present), solar_radiation (if present)
    """
    try:
        base = "https://power.larc.nasa.gov/api/temporal/daily/point"
        params = {
            "parameters": "T2M,PRECTOT,ALLSKY_SFC_SW_DWN",
            "community": community,
            "longitude": lon,
            "latitude": lat,
            "start": start,
            "end": end,
            "format": "JSON",
        }
        logger.info("NASA POWER: requesting sample %s", params)
        r = requests.get(base, params=params, timeout=30)
        if r.status_code != 200:
            # print server message if available
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
        if "PRECTOT" in parameters:
            df["precipitation"] = df["date"].map(parameters["PRECTOT"])
        else:
            df["precipitation"] = None
        if "ALLSKY_SFC_SW_DWN" in parameters:
            df["solar_radiation"] = df["date"].map(parameters["ALLSKY_SFC_SW_DWN"])
        else:
            df["solar_radiation"] = None
        df["date"] = pd.to_datetime(df["date"])
        df.attrs["source"] = "NASA POWER"
        return df
    except Exception as e:
        logger.exception("NASA POWER test failed")
        return _df_placeholder(f"NASA POWER error: {e}")


# ----------------------------
# Google Earth Engine NDVI test
# ----------------------------
def test_gee_ndvi(region_coords=[30.5, 30.5, 31.5, 31.5], start="2023-07-01", end="2023-07-31"):
    """
    Uses Earth Engine to compute a small time-series (daily or monthly) of NDVI mean over a region.
    Requires earthengine-api authentication. If not authenticated, returns an instructive placeholder DataFrame.
    """
    try:
        import ee
    except Exception as e:
        logger.warning("earthengine-api not installed or import failed: %s", e)
        return _df_placeholder("earthengine-api is not installed or import failed. pip install earthengine-api and authenticate.")

    try:
        # initialize (will raise if not authenticated)
        ee.Initialize()
    except Exception as e:
        logger.exception("EE initialization failed")
        return _df_placeholder("Earth Engine auth required. Run `earthengine authenticate` on the host or mount credentials.")

    try:
        region = ee.Geometry.Rectangle(region_coords)
        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR")
            .filterBounds(region)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        )

        def ndvi_from_img(img):
            ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
            # attach date as property
            date = ee.Date(img.get("system:time_start")).format("YYYY-MM-dd")
            return ndvi.set("date", date)

        # map and compute mean NDVI per image then pull to client (small sample)
        imgs = collection.limit(12)  # keep small for test
        def extract_mean(img):
            nd = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
            stats = nd.reduceRegion(ee.Reducer.mean(), region, scale=10, maxPixels=1e9)
            date = ee.Date(img.get("system:time_start")).format("YYYY-MM-dd")
            return ee.Feature(None, {"date": date, "ndvi": stats.get("NDVI")})

        feats = imgs.map(extract_mean).filter(ee.Filter.notNull(["ndvi"]))
        feats_list = feats.getInfo().get("features", [])

        rows = []
        for f in feats_list:
            props = f.get("properties", {})
            rows.append({"date": props.get("date"), "ndvi": props.get("ndvi")})
        if not rows:
            return _df_placeholder("GEE returned zero NDVI features for the sample query (check dates/region/auth).")
        df = pd.DataFrame(rows)
        df["date"] = pd.to_datetime(df["date"])
        df.attrs["source"] = "GEE Sentinel-2 NDVI"
        return df
    except Exception as e:
        logger.exception("GEE NDVI test failed")
        return _df_placeholder(f"GEE NDVI error: {e}")


# ----------------------------
# SMAP (via GEE) test
# ----------------------------
def test_smap_gee(region_coords=[30.5, 30.5, 31.5, 31.5], start="2023-01-01", end="2023-01-31"):
    try:
        import ee
    except Exception as e:
        return _df_placeholder("earthengine-api not installed or import failed.")

    try:
        ee.Initialize()
    except Exception as e:
        return _df_placeholder("Earth Engine auth required (smap).")

    try:
        region = ee.Geometry.Rectangle(region_coords)
        coll = ee.ImageCollection("NASA_USDA/HSL/SMAP10KM_soil_moisture").filterDate(start, end).filterBounds(region)
        img = coll.mean()
        stat = img.reduceRegion(reducer=ee.Reducer.mean(), geometry=region, scale=10000, maxPixels=1e9)
        val = stat.getInfo()
        if not val:
            return _df_placeholder("SMAP (GEE) returned no values for the region/date.")
        df = pd.DataFrame([val])
        df.attrs["source"] = "SMAP GEE"
        return df
    except Exception as e:
        logger.exception("SMAP GEE test failed")
        return _df_placeholder(f"SMAP GEE error: {e}")


# ----------------------------
# ERA5 via CDS API test
# ----------------------------
def test_era5_cds(area=[32, 24, 22, 36], year="2023"):
    """
    Requires a working ~/.cdsapirc or CDSAPI env var (CDSAPI_KEY).
    The function will attempt to retrieve a very small file (single day or limited variables).
    """
    try:
        import cdsapi
        import xarray as xr
    except Exception as e:
        logger.warning("cdsapi/xarray not available: %s", e)
        return _df_placeholder("cdsapi/xarray not installed. pip install cdsapi xarray netCDF4 and configure .cdsapirc.")

    # Check if API key is configured
    api_key = os.environ.get("CDSAPI_KEY", "")
    if not api_key:
        return _df_placeholder("CDSAPI_KEY not set. Register at https://cds.climate.copernicus.eu and set CDSAPI_KEY in .env")

    try:
        # Use the correct v3 API URL
        api_url = os.environ.get("CDSAPI_URL", "https://cds.climate.copernicus.eu/api")
        c = cdsapi.Client(url=api_url, key=api_key)
    except Exception as e:
        logger.exception("CDSAPI client creation failed")
        return _df_placeholder("CDSAPI client failed. Ensure CDSAPI_URL and CDSAPI_KEY are correctly set in .env")

    # We'll try to request a single day to keep it small
    try:
        tmpfile = os.path.join(tempfile.gettempdir(), f"era5_test_{year}.nc")
        logger.info("Requesting small ERA5 file -> %s (may take a few seconds)", tmpfile)
        c.retrieve(
            "reanalysis-era5-single-levels",
            {
                "product_type": "reanalysis",
                "variable": ["2m_temperature"],
                "year": year,
                "month": "01",
                "day": "01",
                "time": "12:00",
                "format": "netcdf",
                "area": area,  # north, west, south, east
            },
            tmpfile,
        )
        ds = xr.open_dataset(tmpfile)
        # extract a tiny summary
        da = ds["t2m"]
        mean_val = float(da.mean().values)
        df = pd.DataFrame({"variable": ["t2m"], "mean": [mean_val]})
        df.attrs["source"] = "ERA5 CDS"
        return df
    except Exception as e:
        logger.exception("ERA5 CDS test failed")
        return _df_placeholder(f"ERA5 CDS error: {e}")


# ----------------------------
# CAPMAS Excel folder test (local)
# ----------------------------
def test_capmas_local(folder="./data/capmas"):
    """
    CAPMAS has no public API (usually). The recommended pattern is: place official Excel(s) into data/capmas/.
    This function reads any Excel files found and concatenates them for inspection.
    """
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
                logger.exception("Failed to read CAPMAS file %s: %s", f, e)
        if not dfs:
            return _df_placeholder("Failed to read any CAPMAS Excel files (corrupt or unsupported format).")
        df_all = pd.concat(dfs, ignore_index=True, sort=False)
        df_all.attrs["source"] = "CAPMAS local"
        return df_all
    except Exception as e:
        logger.exception("CAPMAS local test failed")
        return _df_placeholder(f"CAPMAS error: {e}")


# ----------------------------
# GADM shapefile test (attempt download common host)
# ----------------------------
def test_gadm(country_iso="EGY"):
    """
    Attempts to download a GADM zip for Egypt (common hosting at geodata.ucdavis.edu).
    If network blocked or file not found, returns placeholder with instructions.
    """
    # common URL pattern (may change in future)
    urls = [
        f"https://geodata.ucdavis.edu/gadm/gadm4.1/shp/gadm41_{country_iso}_shp.zip",
        f"https://geodata.ucdavis.edu/gadm/gadm3.6/shp/gadm36_{country_iso}_shp.zip",
    ]
    tmpdir = tempfile.mkdtemp(prefix="gadm_")
    for url in urls:
        try:
            logger.info("Attempting to download GADM from %s", url)
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
            # find a shapefile
            shp_files = glob.glob(os.path.join(tmpdir, "*.shp"))
            if not shp_files:
                # try nested folders
                shp_files = glob.glob(os.path.join(tmpdir, "**", "*.shp"), recursive=True)
            if not shp_files:
                return _df_placeholder("Downloaded GADM but no .shp found inside zip.")
            try:
                import geopandas as gpd
            except Exception:
                return _df_placeholder("geopandas not installed. pip install geopandas fiona shapely pyproj")
            gdf = gpd.read_file(shp_files[0])
            gdf.attrs["source"] = "GADM"
            # return small sample
            return pd.DataFrame(gdf.head(20))
        except Exception as e:
            logger.exception("GADM attempt failed for url %s", url)
            continue
    return _df_placeholder("GADM download failed. Either network blocked or URL changed. You can place a local GADM shapefile into ./data/gadm/ and update code.")


# ----------------------------
# FEWS NET / Crop Explorer test (web page check)
# ----------------------------
def test_fewsnet(url="https://fews.net/data/agroclimatology-data"):
    """
    FEWSNET often hosts lists or downloads behind the page; here we simply check page and try to find CSV/XLS links.
    """
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        html = r.text[:5000]
        # quick heuristic to find downloadable links to csv/xlsx
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
# FAOSTAT (metadata / alternative) or other country-level sources
# ----------------------------
# (We already added FAOSTAT above; you can add more endpoints similarly)


# ----------------------------
# Runner
# ----------------------------
def run_all_tests():
    results = {}
    logger.info("Starting source tests...")

    # FAOSTAT
    results["faostat"] = test_faostat(area="Egypt", year=2022)

    # Egypt Open Data
    results["egypt_opendata"] = test_egypt_opendata()

    # NASA POWER
    results["nasa_power"] = test_nasa_power()

    # GEE NDVI
    results["gee_ndvi"] = test_gee_ndvi()

    # SMAP via GEE
    results["smap_gee"] = test_smap_gee()

    # ERA5 CDS
    results["era5_cds"] = test_era5_cds()

    # CAPMAS local folder
    results["capmas_local"] = test_capmas_local(folder="./data/capmas")

    # GADM
    results["gadm"] = test_gadm(country_iso="EGY")

    # FEWSNET
    results["fewsnet"] = test_fewsnet()

    logger.info("Source tests completed. Summary:")
    for k, df in results.items():
        try:
            nrows = len(df)
        except Exception:
            nrows = "unknown"
        logger.info(" - %s : rows=%s  (source attr=%s)", k, nrows, getattr(df, "attrs", {}).get("source"))

    return results


if __name__ == "__main__":
    res = run_all_tests()
    # print brief textual summary and save each DataFrame to ./data/tests as parquet/csv for inspection
    outdir = "./data/tests"
    os.makedirs(outdir, exist_ok=True)
    for name, df in res.items():
        safe_name = name.replace("/", "_")
        try:
            # small DF => save csv (human view)
            df.to_csv(os.path.join(outdir, f"{safe_name}.csv"), index=False)
        except Exception:
            try:
                df.to_json(os.path.join(outdir, f"{safe_name}.json"))
            except Exception:
                logger.exception("Failed to persist result for %s", name)
    logger.info("All test outputs saved to %s", outdir)
    print("Done. See logs above and files in ./data/tests/")

    