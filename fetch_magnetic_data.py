import numpy as np
import os
import json

# Create figure-data dir if not exists
os.makedirs("figure-data", exist_ok=True)

def save_csv(name, data, fmt="%.4g"):
    path = f"figure-data/{name}.csv"
    np.savetxt(path, data, delimiter=',', fmt=fmt)
    print(f"Saved {path}")

def calc_magnetic_field_from_coils():
    res = 256
    # Grid in X-Z plane (Y=0)
    x = np.linspace(-2, 2, res)
    z = np.linspace(-2, 2, res)
    X, Z = np.meshgrid(x, z)
    
    # Coils: list of (center_z, radius, current)
    coils = [
        {'z': -0.5, 'r': 0.8, 'i': 1.0},
        {'z': 0.5, 'r': 0.8, 'i': 1.0}
    ]
    
    # Magnetic field components (simplified for 2D slice at Y=0)
    # Total B magnitude
    B_total = np.zeros_like(X)
    
    # For each coil, we integrate numerically (or use simplified approximation)
    # Let's use a reasonably accurate numerical integration for a circle
    phi = np.linspace(0, 2*np.pi, 100)
    for coil in coils:
        cz = coil['z']
        r = coil['r']
        curr = coil['i']
        
        for p in phi:
            # Source point on coil (X, Y, Z)
            sx = r * np.cos(p)
            sy = r * np.sin(p)
            sz = cz
            
            # Distance vector from source to field points (X, 0, Z)
            dx = X - sx
            dy = 0 - sy
            dz = Z - sz
            dist_sq = dx**2 + dy**2 + dz**2
            dist = np.sqrt(dist_sq)
            
            # dl vector
            dlx = -r * np.sin(p)
            dly = r * np.cos(p)
            dlz = 0
            
            # B ~ dl x r / dist^3
            # Bx_p = (dly * dz - dlz * dy) / dist^3
            # By_p = (dlz * dx - dlx * dz) / dist^3
            # Bz_p = (dlx * dy - dly * dx) / dist^3
            
            # On the Y=0 plane, we care about magnitude
            Bx_p = (dly * dz) / (dist**3 + 1e-6)
            By_p = (dlz * dx - dlx * dz) / (dist**3 + 1e-6)
            Bz_p = (-dly * dx) / (dist**3 + 1e-6)
            
            B_total += np.sqrt(Bx_p**2 + By_p**2 + Bz_p**2)

    # Normalize/Scale
    B_total = np.log1p(B_total) # Log scale often looks better for field lines
    save_csv("scientific_magnetic_coils", B_total)
    
    # Save Coil Geometry for UI overlay
    with open("figure-data/magnetic_coils_geo.json", "w") as f:
        json.dump(coils, f)
    print("Saved figure-data/magnetic_coils_geo.json")

if __name__ == "__main__":
    print("Generating High-Quality Coil Magnetic Field Data...")
    calc_magnetic_field_from_coils()
    print("Done!")
