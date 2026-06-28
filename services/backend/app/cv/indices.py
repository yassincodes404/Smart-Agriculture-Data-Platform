import numpy as np

def compute_ndvi(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    denominator = nir + red
    with np.errstate(divide='ignore', invalid='ignore'):
        ndvi = np.where(denominator > 0, (nir - red) / denominator, 0.0)
    return np.clip(ndvi, -1.0, 1.0)

def compute_dvi(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    return nir - red

def compute_evi(nir: np.ndarray, red: np.ndarray, blue: np.ndarray) -> np.ndarray:
    denominator = nir + 6.0 * red - 7.5 * blue + 1.0
    with np.errstate(divide='ignore', invalid='ignore'):
        evi = np.where(denominator != 0, 2.5 * (nir - red) / denominator, 0.0)
    return np.clip(evi, -1.0, 1.0)

def compute_ndwi(nir: np.ndarray, swir: np.ndarray) -> np.ndarray:
    denominator = nir + swir
    with np.errstate(divide='ignore', invalid='ignore'):
        ndwi = np.where(denominator > 0, (nir - swir) / denominator, 0.0)
    return np.clip(ndwi, -1.0, 1.0)

def compute_savi(nir: np.ndarray, red: np.ndarray, L: float = 0.5) -> np.ndarray:
    denominator = nir + red + L
    with np.errstate(divide='ignore', invalid='ignore'):
        savi = np.where(denominator > 0, ((nir - red) / denominator) * (1.0 + L), 0.0)
    return np.clip(savi, -1.0, 1.0)

def compute_gndvi(nir: np.ndarray, green: np.ndarray) -> np.ndarray:
    denominator = nir + green
    with np.errstate(divide='ignore', invalid='ignore'):
        gndvi = np.where(denominator > 0, (nir - green) / denominator, 0.0)
    return np.clip(gndvi, -1.0, 1.0)
