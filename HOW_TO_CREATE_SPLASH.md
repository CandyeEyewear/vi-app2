# How to Create the Splash Screen Image

I've created `assets/splash.svg` with your design. Here's how to convert it to PNG:

## Quick Method: Online Converter (Easiest)

1. **Go to an online SVG to PNG converter:**
   - https://cloudconvert.com/svg-to-png
   - https://convertio.co/svg-png/
   - https://svgtopng.com/

2. **Upload** `assets/splash.svg`

3. **Set dimensions:** 
   - Width: **1284** pixels
   - Height: **2778** pixels
   - (This is iPhone 14 Pro Max size - will scale for other devices)

4. **Download** and save as `assets/splash.png` (replace the existing file)

5. **Done!** The `app.json` is already configured with the blue background color.

## Alternative: Using Browser

1. Open `assets/splash.svg` in Chrome/Firefox
2. Right-click → Inspect
3. In DevTools, right-click the SVG → Copy image
4. Paste into an image editor (Photoshop, GIMP, etc.)
5. Export as PNG: 1284 x 2778 pixels
6. Save as `assets/splash.png`

## Design Details

- **Background**: Blue (#2196F3)
- **Logo**: "VIbe" in blue text, centered in white circle
- **Footer**: "from Volunteers Inc" in small white text at bottom
- **Size**: 1284 x 2778 (iPhone 14 Pro Max - will scale automatically)

## After Creating the PNG

Run this to rebuild with the new splash screen:

```bash
npx expo prebuild --clean
```

Then test on your device/simulator!

## What I've Already Done

✅ Created `assets/splash.svg` with your design  
✅ Updated `app.json` to use blue background (#2196F3)  
✅ Created conversion script (if you can install sharp)

The SVG is ready - just convert it to PNG using one of the methods above!

