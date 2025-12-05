# Boolean Parameter Support

## Overview
The Shadertoy2ZGE converter now supports boolean parameters alongside float parameters. Booleans are stored as floats (0.0 = false, 1.0 = true) in ZGE's parameter system and automatically receive a checkbox UI control.

## Syntax

### Basic Boolean Declaration
```glsl
bool ZGEMyFlag = true;
bool ZGEEnableEffect = false;
```

### Boolean with Custom Tags
```glsl
bool ZGEInvertColors = true; // @color invert
```

Note: The `@checkbox` tag is automatically added to all boolean parameters.

## How It Works

1. **In Your Shader Code**: Declare booleans with the `ZGE` prefix
   ```glsl
   bool ZGEEnableGlow = true;
   ```

2. **Converted to Uniform**: The converter creates a float uniform
   ```glsl
   uniform float ZGEEnableGlow;
   ```

3. **Usage in Shader**: Use as a float comparison or convert to bool
   ```glsl
   // Direct comparison
   if (ZGEEnableGlow > 0.5) {
       // Apply glow effect
   }
   
   // Or convert to bool
   bool enableGlow = ZGEEnableGlow > 0.5;
   if (enableGlow) {
       // Apply glow effect
   }
   ```

4. **ZGE UI**: Displays as a checkbox control in ZGameEditor/FL Studio

## Example Shader

```glsl
// Title: Boolean Demo
// Author: Your Name

bool ZGEInvertColors = false;
bool ZGEShowGrid = true;
float ZGEGridSize = 10.0; // Range: 1.0, 50.0

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 col = vec3(uv, 0.5);
    
    // Use boolean for color inversion
    if (ZGEInvertColors > 0.5) {
        col = 1.0 - col;
    }
    
    // Use boolean for grid overlay
    if (ZGEShowGrid > 0.5) {
        vec2 grid = mod(fragCoord, ZGEGridSize);
        if (grid.x < 1.0 || grid.y < 1.0) {
            col = mix(col, vec3(1.0), 0.3);
        }
    }
    
    fragColor = vec4(col, 1.0);
}
```

## Accepted Boolean Values

The converter recognizes these as **true** (1.0):
- `true`
- `1`
- `1.0`

And these as **false** (0.0):
- `false`
- `0`
- `0.0`

Any other value will trigger a warning and default to false (0.0).

## Technical Details

- **Storage**: Booleans are stored in the same `Parameters` array as floats
- **Encoding**: Converted to IEEE 754 float (4 bytes each) and compressed with DEFLATE
- **GLSL Limitation**: GLSL doesn't support bool uniforms from application, so floats are used
- **UI Control**: The `@checkbox` tag ensures ZGE displays a checkbox instead of a slider
- **No Range**: Booleans ignore any Range comments (they're always 0.0 or 1.0)

## Migration Note

If you have existing code that uses floats as boolean flags (0.0/1.0), you can now convert them to proper bool declarations for clearer intent and automatic checkbox UI.

# Boolean Support Implementation Summary

## Changes Made

### 1. Updated Regex Pattern (`script.js` line ~70)
- Changed from: `/float ZGE(\w+)\s*=\s*([^;]+);...`
- Changed to: `/(float|bool) ZGE(\w+)\s*=\s*([^;]+);...`
- Now captures both float and bool type declarations

### 2. Enhanced Parameter Extraction (`script.js` line ~80-115)
- Stores parameter type (`float` or `bool`)
- Automatically adds `@checkbox` tag to boolean parameters
- Updates line removal regex to handle both `float` and `bool`

### 3. Boolean Value Parsing (`script.js` line ~355-370)
- Converts boolean string values to float:
  - `true`, `1`, `1.0` → `1.0`
  - `false`, `0`, `0.0` → `0.0`
  - Invalid values → `0.0` (with warning)

### 4. Value Encoding (`script.js` line ~375-380)
- Booleans skip range scaling (already 0.0 or 1.0)
- Stored directly in Parameters array as floats

### 5. ShaderVariable Generation (`script.js` line ~300)
- Booleans bypass range remapping formulas
- Direct reference to Parameters array value

## How It Works

1. **Declaration**: Users write `bool ZGEMyFlag = true;`
2. **Uniform**: Converted to `uniform float ZGEMyFlag;` (GLSL requirement)
3. **Storage**: Stored as 0.0 (false) or 1.0 (true) in ZGE's Parameters array
4. **Encoding**: IEEE 754 float format, DEFLATE compressed with Pako.js
5. **UI**: Displays as checkbox (via `@checkbox` tag)
6. **Usage**: `if (ZGEMyFlag > 0.5)` or `bool flag = ZGEMyFlag > 0.5;`

## Why This Approach?

- **Seamless Integration**: Uses existing float infrastructure
- **No Breaking Changes**: Float parameters work exactly as before
- **ZGE Compatible**: Fits ZGE's parameter system perfectly
- **GLSL Compatible**: GLSL doesn't support bool uniforms from application
- **Efficient**: Same compression/encoding as floats (4 bytes each)
- **User-Friendly**: Automatic checkbox UI via tags

## Testing

Test shader included: `test_boolean_example.glsl`
- Demonstrates 3 boolean parameters
- Shows usage patterns (glow, invert, grid)
- Combines with float parameters

## Documentation

- `BOOLEAN_USAGE.md`: Comprehensive guide for users
- `README.md`: Updated to mention boolean support
