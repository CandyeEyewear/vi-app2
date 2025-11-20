# Creating the Splash Screen Image

## Design Specifications
- **Background**: Blue (#2196F3 - brand color)
- **Logo**: "VIbe" in blue text within a white circle
- **Footer**: "from Volunteers Inc" in small white text at bottom

## Option 1: Convert SVG to PNG (Recommended)

I've created `assets/splash.svg` which you can convert to PNG.

### Using Online Tool:
1. Go to https://cloudconvert.com/svg-to-png or https://convertio.co/svg-png/
2. Upload `assets/splash.svg`
3. Set dimensions: **1284 x 2778** (iPhone 14 Pro Max size)
4. Download and save as `assets/splash.png`

### Using Command Line (if you have ImageMagick):
```bash
magick convert -background none -resize 1284x2778 assets/splash.svg assets/splash.png
```

### Using Node.js (if you have sharp installed):
```bash
npx sharp-cli -i assets/splash.svg -o assets/splash.png --width 1284 --height 2778
```

## Option 2: Create in Design Tool

If you prefer to create it manually:

1. **Create new image**: 1284 x 2778 pixels
2. **Background**: Fill with #2196F3 (blue)
3. **White Circle**: 
   - Center horizontally
   - Position vertically around 1200px from top
   - Radius: ~280px
   - Fill: #FFFFFF
4. **VIbe Text**:
   - Font: Bold, Arial or similar sans-serif
   - Size: ~120px
   - Color: #2196F3 (blue)
   - Centered in white circle
5. **Footer Text**:
   - "from Volunteers Inc"
   - Font: Regular, ~32px
   - Color: #FFFFFF (white)
   - Position: ~2600px from top (near bottom)
   - Center horizontally

## Update app.json

After creating the PNG, update `app.json`:

```json
"splash": {
  "image": "./assets/splash.png",
  "resizeMode": "cover",
  "backgroundColor": "#2196F3"
}
```

The background color should match the blue in the image.

## Testing

After updating:
```bash
npx expo prebuild --clean
```

Then test on device/simulator to see the new splash screen.

