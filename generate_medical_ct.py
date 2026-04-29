import numpy as np
import os

def draw_ellipse(img, x0, y0, a, b, theta, value, mode='add'):
    rows, cols = img.shape
    y, x = np.ogrid[-y0:rows-y0, -x0:cols-x0]
    
    theta_rad = np.radians(theta)
    cos_t = np.cos(theta_rad)
    sin_t = np.sin(theta_rad)
    
    x_rot = x * cos_t + y * sin_t
    y_rot = -x * sin_t + y * cos_t
    
    mask = (x_rot**2 / a**2) + (y_rot**2 / b**2) <= 1
    
    if mode == 'add':
        img[mask] += value
    elif mode == 'set':
        img[mask] = value

def generate_shepp_logan(size=256):
    img = np.zeros((size, size))
    # Standard Shepp-Logan parameters: A, a, b, x0, y0, theta
    # Scale coordinates and sizes to the image size
    img_center = size / 2
    
    def add_ell(A, a, b, x0, y0, theta):
        # Coordinates in [-1, 1]
        x0_p = int(img_center + x0 * img_center)
        y0_p = int(img_center - y0 * img_center) # y is inverted
        a_p = a * img_center
        b_p = b * img_center
        draw_ellipse(img, x0_p, y0_p, a_p, b_p, theta, A, mode='add')

    # Base head
    add_ell(2.0,   0.69,   0.92,   0,      0,       0)
    add_ell(-0.98, 0.6624, 0.8740, 0,      -0.0184, 0)
    add_ell(-0.02, 0.1100, 0.3100, 0.22,   0,       -18)
    add_ell(-0.02, 0.1600, 0.4100, -0.22,  0,       18)
    add_ell(0.01,  0.2100, 0.2500, 0,      0.35,    0)
    add_ell(0.01,  0.0460, 0.0460, 0,      0.1,     0)
    add_ell(0.01,  0.0460, 0.0460, 0,      -0.1,    0)
    add_ell(0.01,  0.0460, 0.0230, -0.08,  -0.605,  0)
    add_ell(0.01,  0.0230, 0.0230, 0,      -0.606,  0)
    add_ell(0.01,  0.0230, 0.0460, 0.06,   -0.605,  0)
    
    # Scale to typical HU range for CT (-1000 to +1000ish)
    img_hu = (img - 1.0) * 1000.0
    img_hu[img == 0] = -1000 # Air background
    
    return img_hu

def generate_medical_brain_ct(size=256):
    # Create realistic-looking simple brain CT
    img = np.full((size, size), -1000.0) # Air
    
    c = size // 2
    
    # 1. Skull
    draw_ellipse(img, c, c, size*0.4, size*0.48, 0, 1500, mode='set')
    # Inner skull boundary -> Brain matter
    draw_ellipse(img, c, c, size*0.37, size*0.45, 0, 35, mode='set') # Brain tissue (35 HU)
    
    # 2. Ventricles (0-15 HU)
    draw_ellipse(img, c, c-size*0.05, size*0.05, size*0.15, 10, 5, mode='set')
    draw_ellipse(img, c, c+size*0.05, size*0.05, size*0.15, -10, 5, mode='set')
    
    # 3. Hemorrhage (50-80 HU)
    draw_ellipse(img, c+size*0.15, c-size*0.15, size*0.1, size*0.06, -30, 75, mode='set')
    
    # 4. Add some noise for realism
    noise = np.random.normal(0, 5, (size, size))
    # Only add noise where it is not air
    img[img > -900] += noise[img > -900]
    
    return img

def main():
    phantom = generate_shepp_logan()
    brain = generate_medical_brain_ct()
    
    output_dir = 'figure-data'
    os.makedirs(output_dir, exist_ok=True)
    
    np.savetxt(os.path.join(output_dir, 'scientific_ct_phantom.csv'), phantom, delimiter=',', fmt='%.1f')
    np.savetxt(os.path.join(output_dir, 'medical_brain_ct.csv'), brain, delimiter=',', fmt='%.1f')
    print("Files generated successfully.")

if __name__ == '__main__':
    main()
