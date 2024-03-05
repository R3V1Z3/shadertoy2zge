Shadertoy to ZGameEditor converter. The goal of this web app is an easy, one-shot conversion of Shadertoy shaders to ZGameEditor project files. Just paste in your Shadertoy code and it should spit out a fully functional .zgeproj file.

For those unaware, [ZGameEditor](https://www.zgameeditor.org/) is an open-source game engine. And it's also been fully integrated as an [FL Studio plugin](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/ZGameEditor%20Visualizer.htm), a very powerful composer for audio visualization.

ZGameEditor provides a built-in language for creating games, visualizations and more. But it also supports GLSL shaders and can handle a lot of Shadertoy code out-of-the-box. This converter aims to greatly simplify porting of shaders.

## What it does currently
- Adds user provided Shadertoy code into the appropriate spot in a template.
- Ensures texture calls are replaced with ZGE's texture2D.
- Extracts and adds to project file, user provided name and author from comments like // Title: Blur Author: R3V1Z3
- Extracts any float variable declarations prefixed with ZGE (ex: ZGEtimeFactor, ZGEratio), adds them as uniforms and creates respective parameters to adjust their values.
- If keyword **ZGEdelta** is included in any comments, a Speed slider will be added that will adjust deltaTime so as to speed up or reverse time for graphic processing.
- Provides a download link of the resulting project via data uri.

## Extraction of float variables

The tool will attempt to extract variables defined as floats, with the prefix ZGE, in order to use them as uniforms that can be adjusted with sliders in ZGameEditor.

For example:
```
float ZGEspeed = 2.0; // Range: 0.0, 4.0
float ZGErandomness = 0.5; // Range 0.0, 2.0
```

It extracts those variables at the float definitions, removing the respective lines from the shader code since those definitions will be added as uniforms instead. It then adds those variables as uniforms.

For example, it adds the above variables as uniforms in the shader code:
```
uniform float ZGEspeed;
uniform float ZGErandomness;
```

It then adds those variables as parameters in ZGameEditor along with formulas to normalize the slider values based on specified Ranges.