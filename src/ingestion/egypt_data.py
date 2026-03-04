"""
Egyptian Governorates — Coordinates Database
=============================================
All 27 Egyptian governorates with their capital city coordinates,
used for querying climate APIs (Open-Meteo, NASA POWER, etc.)
"""

EGYPT_GOVERNORATES = [
    # ── Lower Egypt (Delta) ──────────────────────────────
    {"name": "Cairo",             "name_ar": "القاهرة",       "lat": 30.0444, "lon": 31.2357, "region": "Urban"},
    {"name": "Alexandria",        "name_ar": "الإسكندرية",    "lat": 31.2001, "lon": 29.9187, "region": "Urban"},
    {"name": "Giza",              "name_ar": "الجيزة",        "lat": 30.0131, "lon": 31.2089, "region": "Urban"},
    {"name": "Qalyubia",          "name_ar": "القليوبية",     "lat": 30.3290, "lon": 31.2421, "region": "Delta"},
    {"name": "Dakahlia",          "name_ar": "الدقهلية",      "lat": 31.0364, "lon": 31.3807, "region": "Delta"},
    {"name": "Sharqia",           "name_ar": "الشرقية",       "lat": 30.5878, "lon": 31.5020, "region": "Delta"},
    {"name": "Gharbia",           "name_ar": "الغربية",       "lat": 30.8754, "lon": 31.0297, "region": "Delta"},
    {"name": "Monufia",           "name_ar": "المنوفية",      "lat": 30.5972, "lon": 30.9876, "region": "Delta"},
    {"name": "Beheira",           "name_ar": "البحيرة",       "lat": 30.8481, "lon": 30.3436, "region": "Delta"},
    {"name": "Kafr_El_Sheikh",    "name_ar": "كفر الشيخ",     "lat": 31.1107, "lon": 30.9388, "region": "Delta"},
    {"name": "Damietta",          "name_ar": "دمياط",         "lat": 31.4175, "lon": 31.8144, "region": "Delta"},
    {"name": "Port_Said",         "name_ar": "بورسعيد",       "lat": 31.2565, "lon": 32.2841, "region": "Canal"},
    {"name": "Ismailia",          "name_ar": "الإسماعيلية",   "lat": 30.5965, "lon": 32.2715, "region": "Canal"},
    {"name": "Suez",              "name_ar": "السويس",        "lat": 29.9668, "lon": 32.5498, "region": "Canal"},
    # ── Upper Egypt ──────────────────────────────────────
    {"name": "Beni_Suef",         "name_ar": "بني سويف",      "lat": 29.0661, "lon": 31.0994, "region": "Upper"},
    {"name": "Fayoum",            "name_ar": "الفيوم",        "lat": 29.3084, "lon": 30.8441, "region": "Upper"},
    {"name": "Minya",             "name_ar": "المنيا",        "lat": 28.0871, "lon": 30.7618, "region": "Upper"},
    {"name": "Assiut",            "name_ar": "أسيوط",         "lat": 27.1809, "lon": 31.1837, "region": "Upper"},
    {"name": "Sohag",             "name_ar": "سوهاج",         "lat": 26.5569, "lon": 31.6948, "region": "Upper"},
    {"name": "Qena",              "name_ar": "قنا",           "lat": 26.1551, "lon": 32.7160, "region": "Upper"},
    {"name": "Luxor",             "name_ar": "الأقصر",        "lat": 25.6872, "lon": 32.6396, "region": "Upper"},
    {"name": "Aswan",             "name_ar": "أسوان",         "lat": 24.0889, "lon": 32.8998, "region": "Upper"},
    # ── Frontier / Desert ────────────────────────────────
    {"name": "Red_Sea",           "name_ar": "البحر الأحمر",  "lat": 27.1783, "lon": 33.7995, "region": "Frontier"},
    {"name": "New_Valley",        "name_ar": "الوادي الجديد", "lat": 25.4390, "lon": 30.0459, "region": "Frontier"},
    {"name": "Matrouh",           "name_ar": "مطروح",         "lat": 31.3525, "lon": 27.2453, "region": "Frontier"},
    {"name": "North_Sinai",       "name_ar": "شمال سيناء",    "lat": 31.1325, "lon": 33.7990, "region": "Frontier"},
    {"name": "South_Sinai",       "name_ar": "جنوب سيناء",    "lat": 28.2294, "lon": 33.6175, "region": "Frontier"},
]

# FAO Crop Coefficients (Kc) — from FAO Irrigation & Drainage Paper 56
# Used to calculate crop water requirement: ETcrop = ET0 × Kc
CROP_KC_VALUES = {
    # Crop name: {"kc_ini": initial, "kc_mid": mid-season, "kc_end": late season, "season_days": typical}
    "Wheat":       {"kc_ini": 0.40, "kc_mid": 1.15, "kc_end": 0.25, "season_days": 150, "season": "winter"},
    "Rice":        {"kc_ini": 1.05, "kc_mid": 1.20, "kc_end": 0.90, "season_days": 150, "season": "summer"},
    "Maize":       {"kc_ini": 0.30, "kc_mid": 1.20, "kc_end": 0.35, "season_days": 130, "season": "summer"},
    "Cotton":      {"kc_ini": 0.35, "kc_mid": 1.20, "kc_end": 0.50, "season_days": 180, "season": "summer"},
    "Sugarcane":   {"kc_ini": 0.40, "kc_mid": 1.25, "kc_end": 0.75, "season_days": 365, "season": "perennial"},
    "Tomatoes":    {"kc_ini": 0.60, "kc_mid": 1.15, "kc_end": 0.80, "season_days": 135, "season": "summer"},
    "Potatoes":    {"kc_ini": 0.50, "kc_mid": 1.15, "kc_end": 0.75, "season_days": 130, "season": "winter"},
    "Onions":      {"kc_ini": 0.70, "kc_mid": 1.05, "kc_end": 0.75, "season_days": 170, "season": "winter"},
    "Clover":      {"kc_ini": 0.40, "kc_mid": 0.95, "kc_end": 0.85, "season_days": 120, "season": "winter"},
    "Citrus":      {"kc_ini": 0.65, "kc_mid": 0.65, "kc_end": 0.65, "season_days": 365, "season": "perennial"},
    "Grapes":      {"kc_ini": 0.30, "kc_mid": 0.85, "kc_end": 0.45, "season_days": 200, "season": "summer"},
    "Olives":      {"kc_ini": 0.65, "kc_mid": 0.70, "kc_end": 0.70, "season_days": 365, "season": "perennial"},
    "Date_Palm":   {"kc_ini": 0.90, "kc_mid": 0.95, "kc_end": 0.95, "season_days": 365, "season": "perennial"},
    "Barley":      {"kc_ini": 0.30, "kc_mid": 1.15, "kc_end": 0.25, "season_days": 130, "season": "winter"},
    "Beans":       {"kc_ini": 0.40, "kc_mid": 1.15, "kc_end": 0.35, "season_days": 110, "season": "winter"},
    "Sunflower":   {"kc_ini": 0.35, "kc_mid": 1.10, "kc_end": 0.35, "season_days": 130, "season": "summer"},
}

# Standard irrigation efficiency benchmarks (FAO AQUASTAT)
IRRIGATION_EFFICIENCY = {
    "surface_flood":  0.50,   # 50% — traditional flood (most common in Egypt)
    "furrow":         0.60,   # 60%
    "sprinkler":      0.75,   # 75%
    "drip":           0.90,   # 90% — modern drip irrigation
    "egypt_average":  0.55,   # 55% — Egypt national average
}
