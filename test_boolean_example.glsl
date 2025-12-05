// Title: Boolean Test Shader
// Author: Test User

// Boolean parameters
bool ZGEEnableGlow = true;
bool ZGEInvertColors = false;
bool ZGEShowGrid = true; // @separator

// Float parameters
float ZGEGridSize = 10.0; // Range: 5.0, 50.0
float ZGEBrightness = 1.0; // Range: 0.0, 2.0

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 col = vec3(uv, 0.5 + 0.5 * sin(iTime));
    
    // Apply brightness adjustment
    col *= ZGEBrightness;
    
    // Use boolean for glow effect
    if (ZGEEnableGlow > 0.5) {
        float glow = 0.5 + 0.5 * sin(iTime * 2.0);
        col += vec3(glow * 0.2);
    }
    
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
