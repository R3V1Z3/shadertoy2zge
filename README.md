Shadertoy to ZGameEditor converter. The goal of this project is a fast and accurate one-shot conversion of Shadertoy shaders to ZGameEditor project files. Just paste in your Shadertoy code and it should spit out a fully functional .zgeproj file.

For those unaware, [ZGameEditor](https://www.zgameeditor.org/) is an open-source game engine. And it's also been fully integrated as an [FL Studio plugin](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/ZGameEditor%20Visualizer.htm), a very powerful composer for audio visualization.

ZGameEditor provides a built-in language for creating games, visualizations and more. But it also supports GLSL shaders and can handle a lot of Shadertoy code out-of-the-box. This converter aims to greatly simplify porting of shaders.

## Project Roadmap
What it does currently:
- Adds user provided Shadertoy code into the appropriate spot in a template.
- Ensures texture calls are replaced with ZGE's texture2D.
- Extracts and adds to project file, user provided name and author from comments ala // ZGEname: Blur ZGEauthor: R3V1Z3
- Provides a download link of the resulting project via data uri.

## Notes
This project's inception relied heavily on ChatGPT. I know JavaScript well enough to code it from scratch, but I'm not quick with it. ChatGPT made it possible in roughly one night.