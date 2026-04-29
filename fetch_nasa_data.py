import os
import gzip
import urllib.request
import numpy as np

# Create figure-data dir if not exists
os.makedirs("figure-data", exist_ok=True)

DATASETS = {
    "nasa_ndvi": "https://neo.gsfc.nasa.gov/archive/csv/MOD_NDVI_M/MOD_NDVI_M_2024-07.CSV.gz",
    "nasa_sst": "https://neo.gsfc.nasa.gov/archive/csv/MYD28M/MYD28M_2024-07.CSV.gz",
    "nasa_chlorophyll": "https://neo.gsfc.nasa.gov/archive/csv/MY1DMM_CHLORA/MY1DMM_CHLORA_2024-07.CSV.gz",
    "nasa_lst": "https://neo.gsfc.nasa.gov/archive/csv/MOD_LSTD_M/MOD_LSTD_M_2024-07.CSV.gz",
    "nasa_ozone": "https://neo.gsfc.nasa.gov/archive/csv/AURA_OZONE_M/AURA_OZONE_M_2024-07.CSV.gz",
    "nasa_precip": "https://neo.gsfc.nasa.gov/archive/csv/GPM_3IMERGM/GPM_3IMERGM_2024-07.CSV.gz"
}

TARGET_W, TARGET_H = 360, 180

print("Downloading and processing NASA data...")
for name, url in DATASETS.items():
    print(f"Processing {name} from {url}")
    # Download
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            with gzip.GzipFile(fileobj=response) as uncompressed:
                # Load as numpy array
                # The data is separated by commas
                print(f"  Parsing full resolution CSV for {name}...")
                data = np.loadtxt(uncompressed, delimiter=',')
                
        # Handle 99999.0 missing values
        data[data == 99999.0] = np.nan
        
        # Original size is likely 3600x1800 or 1440x720. Let's downsample using nanmean.
        orig_h, orig_w = data.shape
        bin_h = orig_h // TARGET_H
        bin_w = orig_w // TARGET_W
        
        print(f"  Resampling from {orig_w}x{orig_h} to {TARGET_W}x{TARGET_H}...")
        
        # If the dimensions don't divide perfectly, just slice it
        data_crop = data[:TARGET_H * bin_h, :TARGET_W * bin_w]
        
        # Reshape and take mean over blocks
        resampled = np.nanmean(
            data_crop.reshape(TARGET_H, bin_h, TARGET_W, bin_w),
            axis=(1, 3)
        )
        
        # Save output
        out_path = f"figure-data/{name}.csv"
        # use an empty string for nans to keep csv small
        np.savetxt(out_path, resampled, delimiter=',', fmt="%.4g")
        print(f"  Saved {out_path}.")
        
    except Exception as e:
        print(f"  Error processing {name}: {e}")

print("Generating Astro Mock data...")
# Astro data (pseudo FITS log scaled data)
# Large dynamic range: mostly near 0-10 background noise, galaxy disk ~100-1000, core ~1e5, some point sources 1e6
h, w = 200, 300
y, x = np.mgrid[0:h, 0:w]

# Background + noise
astro = np.random.normal(5, 2, size=(h, w)).clip(0) 

# Core and disk
cy, cx = h//2, w//2
dist_sq = (x - cx)**2/3 + (y - cy)**2  # Elliptical disk
disk = 1000 * np.exp(-dist_sq / 1000)
core = 1e5 * np.exp(-dist_sq / 50)

# Add spiral arms roughly
theta = np.arctan2(y - cy, x - cx)
r = np.sqrt(dist_sq)
arms = 500 * np.exp(-(r - 20 * theta)**2 / 100) * (r < 80)
arms += 500 * np.exp(-(r - 20 * (theta + np.pi))**2 / 100) * (r < 80)

astro += disk + core + arms

# Point sources
num_stars = 30
sx = np.random.randint(0, w, num_stars)
sy = np.random.randint(0, h, num_stars)
intensities = 10 ** np.random.uniform(3, 6, num_stars)
for i in range(num_stars):
    astro[sy[i], sx[i]] += intensities[i]

np.savetxt("figure-data/astro_mock.csv", astro, delimiter=',', fmt="%.3e")
print("Saved figure-data/astro_mock.csv")
print("Done!")
