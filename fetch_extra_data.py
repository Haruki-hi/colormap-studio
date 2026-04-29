import numpy as np
import os
from scipy.special import sph_harm

# Create figure-data dir if not exists
os.makedirs("figure-data", exist_ok=True)

def save_csv(name, data, fmt="%.4g"):
    path = f"figure-data/{name}.csv"
    np.savetxt(path, data, delimiter=',', fmt=fmt)
    print(f"Saved {path}")

def generate_orbital():
    # Hydrogen-like orbital 3d (n=3, l=2, m=0)
    # Simplified version for visualization
    res = 256
    x = np.linspace(-15, 15, res)
    y = np.linspace(-15, 15, res)
    X, Y = np.meshgrid(x, y)
    R = np.sqrt(X**2 + Y**2 + 0.1) # avoid div by zero
    
    # R_32 (radial part)
    rho = 2 * R / 3
    radial = (rho**2) * np.exp(-rho/2)
    
    # Y_20 (angular part at z=0 plane)
    # cos(theta) = z/r, at z=0, cos(theta) = 0
    # Y_20 prop to (3*cos^2 - 1) -> 3*0 - 1 = -1
    angular = -1.0 
    
    psi_sq = (radial * angular)**2
    # Normalize to 0-1 for general use, though raw values are fine
    psi_sq /= np.max(psi_sq)
    save_csv("scientific_orbital", psi_sq)

def generate_magnetic():
    # Dipole magnetic field intensity
    res = 256
    x = np.linspace(-5, 5, res)
    y = np.linspace(-5, 5, res)
    X, Y = np.meshgrid(x, y)
    R = np.sqrt(X**2 + Y**2 + 0.01)
    
    # B field magnitude from a dipole m=(0,1)
    # B = (3*r(m.r) - m) / r^5 components... simpler approach:
    # m = [0, 1], r = [X, Y]
    # m.r = Y
    # Bx = 3*X*Y / R^5
    # By = (3*Y^2 - R^2) / R^5
    Bx = 3 * X * Y / R**5
    By = (3 * Y**2 - R**2) / R**5
    B_mag = np.sqrt(Bx**2 + By**2)
    
    # Clip extreme values for better CSV handling
    B_mag = np.clip(B_mag, 0, 100)
    save_csv("scientific_magnetic", B_mag)

def generate_ct_phantom():
    # Synthetic CT slice (HU scale)
    # Bone: ~1000, Soft tissue: ~40, Blood: ~80, Water: 0, Air: -1000
    res = 256
    ct = np.full((res, res), -1000.0) # Air background
    
    y, x = np.ogrid[:res, :res]
    center = res // 2
    
    # Skull (Circle)
    r_outer = 100
    r_inner = 90
    dist_sq = (x - center)**2 + (y - center)**2
    skull_mask = (dist_sq <= r_outer**2) & (dist_sq > r_inner**2)
    ct[skull_mask] = 1000.0
    
    # Brain (Inside skull)
    brain_mask = (dist_sq <= r_inner**2)
    ct[brain_mask] = 40.0
    
    # Ventricles (some CSF, 0-10 HU)
    v1_mask = ((x - (center-20))**2 + (y - center)**2 <= 15**2)
    v2_mask = ((x - (center+20))**2 + (y - center)**2 <= 15**2)
    ct[v1_mask | v2_mask] = 5.0
    
    # Hemorrhage (high density blood ~80 HU)
    hem_mask = ((x - (center+30))**2 + (y - (center+30))**2 <= 10**2)
    ct[hem_mask] = 85.0
    
    save_csv("scientific_ct_phantom", ct, fmt="%.1f")

def generate_landcover():
    # Categorical data (0-9)
    from scipy.spatial import Voronoi
    res = 256
    n_points = 50
    points = np.random.rand(n_points, 2) * res
    
    # Assign random class to each point
    classes = np.random.randint(0, 10, n_points)
    
    # Grid of points
    grid_y, grid_x = np.mgrid[0:res, 0:res]
    grid_points = np.stack([grid_x.ravel(), grid_y.ravel()], axis=1)
    
    # Find nearest Voronoi point for each grid pixel
    # Simple nearest neighbor
    from scipy.spatial import KDTree
    tree = KDTree(points)
    _, idx = tree.query(grid_points)
    
    landcover = classes[idx].reshape(res, res)
    save_csv("landcover_sample", landcover, fmt="%d")

if __name__ == "__main__":
    print("Generating extra scientific and geospatial data samples...")
    generate_orbital()
    generate_magnetic()
    generate_ct_phantom()
    generate_landcover()
    print("Done!")
