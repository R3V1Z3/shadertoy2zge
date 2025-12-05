const inputCodeElement = document.getElementById('inputCode');
const iChannelConfigDiv = document.getElementById('ichannelConfig');

// Function to show/hide iChannel config rows based on input code
function updateIChannelVisibility() {
    const code = inputCodeElement.value;
    for (let i = 0; i < 4; i++) {
        const row = document.getElementById(`ichannel${i}Row`);
        if (row) {
            if (code.includes(`iChannel${i}`)) {
                row.style.display = 'block';
            } else {
                row.style.display = 'none';
            }
        }
    }
}

// Add event listener to inputCode textarea
inputCodeElement.addEventListener('input', updateIChannelVisibility);

// Call it once on page load in case there's pre-filled code (e.g. browser refresh)
updateIChannelVisibility();

let notificationTimeout; // To manage hiding the notification bar

// Helper function for notifications
function displayNotification(message, type = 'info') { // type can be 'info', 'warning', 'error'
    const notification = document.getElementById('notification');
    
    // Append new message
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.className = `notification-message notification-${type}`; // Add classes for styling
    notification.appendChild(messageElement);

    notification.classList.remove('hidden'); // Make sure it's visible

    // Clear previous timeout if exists
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }

    // Set timeout to hide the notification bar after a delay
    notificationTimeout = setTimeout(() => {
        notification.classList.add('hidden');
        notification.innerHTML = ''; // Clear messages when hiding
    }, 7000); // Increased time for warnings, and clears all messages
}


document.getElementById('convertButton').addEventListener('click', async function() {
    // Clear previous notifications
    const notification = document.getElementById('notification');
    notification.innerHTML = ''; // Clear content
    notification.classList.add('hidden'); // Hide it
    if (notificationTimeout) {
        clearTimeout(notificationTimeout); // Clear any pending timeout
    }

    const rawInputCode = inputCodeElement.value;
    let zgedelta = false; // Flag for ZGEDelta speed parameter
    let title = "ZGEshader"; // Default shader title
    let author = "Shader author"; // Default shader author
    const ZGEvars = []; // Array to store ZGE custom parameters
    let finalOutputCode = ""; // Store the final output code for download/copy
    
    // Automatically convert texture() to texture2D() for ZGE compatibility
    const processedInputCode = rawInputCode.replaceAll('texture(', 'texture2D(');

    // 1. Extract ZGE custom parameters, title, author, and zgedelta flag
    // Also build the initial shader code string for ZGE uniforms and the main shader body.
    let zgeUniformDeclarationsString = "";
    let userShaderBody = "";
    const lines = processedInputCode.split('\n');

    const zgeVarRegex = /(float|bool) ZGE(\w+)\s*=\s*([^;]+);(?:\s*\/\/\s*Range:\s*(-?[0-9]+\.?[0-9]*),\s*(-?[0-9]+\.?[0-9]*))?(?:.*?\s*@(.+))?/g;
    let lineMatches;

    lines.forEach(function(line) {
        let lineIsZGEVar = false;
        // Check for ZGE variable definitions using the regex
        // We need to reset lastIndex for each line if using a global regex in a loop,
        // or just re-declare the regex locally, or don't use exec in a loop this way.
        // Simpler: test and then extract if it matches.
        if (zgeVarRegex.test(line)) {
            // Reset regex for next use or re-exec to get capture groups
            zgeVarRegex.lastIndex = 0; 
            lineMatches = zgeVarRegex.exec(line);
            if (lineMatches) {
                const varType = lineMatches[1]; // 'float' or 'bool'
                const varId = lineMatches[2];
                const varValue = lineMatches[3].trim();
                const rangeFrom = lineMatches[4] ? lineMatches[4].trim() : undefined;
                const rangeTo = lineMatches[5] ? lineMatches[5].trim() : undefined;
                let tags = lineMatches[6] ? lineMatches[6].trim() : undefined;
                
                // Booleans are stored as floats in ZGE (0.0 or 1.0)
                zgeUniformDeclarationsString += `uniform float ZGE${varId};\n`;
                
                // Auto-add @checkbox tag for bool types if not already present
                if (varType === 'bool' && (!tags || !tags.includes('checkbox'))) {
                    tags = tags ? `${tags} checkbox` : 'checkbox';
                }
                
                ZGEvars.push({
                    id: varId,
                    type: varType,
                    value: varValue,
                    rangeFrom: rangeFrom,
                    rangeTo: rangeTo,
                    tags: tags,
                });
                lineIsZGEVar = true; // This line is a ZGE var, so don't add to userShaderBody
            }
        }

        // Extract Title, Author, ZGEDelta from comments
        if (line.includes("//")) {
            const lcaseLine = line.toLowerCase();
            let titleIndex = lcaseLine.indexOf("title:");
            if (titleIndex !== -1) {
                title = line.substring(titleIndex + 6).trim(); // "title:".length is 6
                return; // Don't add this comment line to userShaderBody
            }
            let authorIndex = lcaseLine.indexOf("author:");
            if (authorIndex !== -1) {
                author = line.substring(authorIndex + 7).trim(); // "author:".length is 7
                return; // Don't add this comment line to userShaderBody
            }
            let zgedeltaIndex = lcaseLine.indexOf("zgedelta");
            if (zgedeltaIndex !== -1) {
                zgedelta = true;
                return; // Don't add this comment line to userShaderBody
            }
        }
        if (!lineIsZGEVar) {
            userShaderBody += line + '\n';
        }
    });
    
    // Notify if no ZGE parameters found (can be done after parsing all lines)
    if (ZGEvars.length === 0) {
        displayNotification('Info: No custom shader parameters (e.g., float ZGEmyVar = 1.0;) were found in your code. If you expected parameters, please check the syntax.', 'info');
    }

    // 2. Fetch and process the ZGE project template
    try {
        const response = await fetch('./templates/basic.zgeproj');
        if (!response.ok) {
            // More specific error for network vs file not found (though fetch API blurs this)
            throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
        }
        let templateXMLText = await response.text();

        // 3. iChannel Processing: Determine necessary iChannel uniforms and material textures
        let iChannelUniformsDeclaration = ""; // For shader code
        let materialTexturesXMLString = "";   // For ZGEP <Textures>
        let newBitmapsXMLString = "";         // For ZGEP <Content> if new bitmaps are needed
        const definedBitmapResources = new Set(); // Track new bitmaps to avoid duplicates

        for (let i = 0; i < 4; i++) {
            const iChannelRow = document.getElementById(`ichannel${i}Row`);
            // Check if the iChannel UI is visible (meaning iChannelN was detected in shader)
            if (iChannelRow && iChannelRow.style.display !== 'none') {
                const selectedSource = document.getElementById(`ichannel${i}Source`).value;
                const uniformName = `iChannel${i}`;

                if (selectedSource !== "none") {
                    iChannelUniformsDeclaration += `uniform sampler2D ${uniformName};\n`;
                    
                    let textureResourceName; // Name of the bitmap resource in ZGEP
                    switch (selectedSource) {
                        case "feedback":
                            // This refers to ZGE's built-in feedback mechanism.
                            // The template already contains <MaterialTexture Name="FeedbackMaterialTexture" ... />.
                            // We link the shader's iChannelN uniform to this existing "FeedbackMaterialTexture".
                            textureResourceName = "FeedbackMaterialTexture";
                            materialTexturesXMLString += `        <MaterialTexture Name="${uniformName}" Texture="${textureResourceName}" TexCoords="1" TextureSlot="${i}"/>\n`;
                            break;
                        case "bitmap1":
                            // This refers to a predefined "Bitmap1" in the template.
                            textureResourceName = "Bitmap1";
                            materialTexturesXMLString += `        <MaterialTexture Name="${uniformName}" Texture="${textureResourceName}" TexCoords="1" TextureSlot="${i}"/>\n`;
                            break;
                        case "bitmap2_new":
                        case "bitmap3_new":
                        case "bitmap4_new":
                            // User wants to create a new texture resource.
                            const n = parseInt(selectedSource.charAt(6)); // e.g., "bitmap2_new" -> 2
                            textureResourceName = `Bitmap${n}_custom`; // e.g., Bitmap2_custom
                            materialTexturesXMLString += `        <MaterialTexture Name="${uniformName}" Texture="${textureResourceName}" TexCoords="1" TextureSlot="${i}"/>\n`;
                            if (!definedBitmapResources.has(textureResourceName)) {
                                newBitmapsXMLString += `    <Bitmap Name="${textureResourceName}" Width="256" Height="256"><Producers><BitmapCells CellStyle="5"/></Producers></Bitmap>\n`;
                                definedBitmapResources.add(textureResourceName);
                            }
                            break;
                    }
                }
            }
        }

        // 4. Prepare the final shader code for injection
        // Remove any hardcoded Shadertoy iChannel defines or old tex1/tex2 uniforms from user's shader body,
        // as these are now handled dynamically.
        userShaderBody = userShaderBody.replace(/uniform sampler2D tex1;\s*\n?/g, '');
        userShaderBody = userShaderBody.replace(/uniform sampler2D tex2;\s*\n?/g, '');
        userShaderBody = userShaderBody.replace(/#define iChannel0 tex1\s*\n?/g, '');
        userShaderBody = userShaderBody.replace(/#define iChannel1 tex2\s*\n?/g, '');
        
        // Final shader code includes dynamic iChannel uniforms, ZGE var uniforms, and the processed user code.
        const finalShaderCode = iChannelUniformsDeclaration + zgeUniformDeclarationsString + userShaderBody;

        // 5. Modify the ZGEP template ('templateXMLText')
        // 5a. Remove old static texture uniforms and defines from the template's main shader section
        const fragmentShaderMarkerStart = "<FragmentShaderSource>\n<![CDATA[";
        const fragmentShaderMarkerEnd = "]]>\n      </FragmentShaderSource>";
        const fsStartIndex = templateXMLText.indexOf(fragmentShaderMarkerStart);
        const fsEndIndex = templateXMLText.indexOf(fragmentShaderMarkerEnd, fsStartIndex);

        if (fsStartIndex !== -1 && fsEndIndex !== -1) {
            let fsCode = templateXMLText.substring(fsStartIndex + fragmentShaderMarkerStart.length, fsEndIndex);
            // Remove template's default/old iChannel related lines
            fsCode = fsCode.replace(/uniform sampler2D tex1;\s*\n?/g, '');
            fsCode = fsCode.replace(/uniform sampler2D tex2;\s*\n?/g, '');
            fsCode = fsCode.replace(/#define iChannel0 tex1\s*\n?/g, '');
            fsCode = fsCode.replace(/#define iChannel1 tex2\s*\n?/g, '');
            templateXMLText = templateXMLText.substring(0, fsStartIndex + fragmentShaderMarkerStart.length) + fsCode + templateXMLText.substring(fsEndIndex);
        }
        
        // 5b. Replace/create the <Textures> section in <Material Name="mCanvas">
        const materialCanvasStart = '<Material Name="mCanvas" Shader="MainShader">';
        const materialCanvasEnd = '</Material>';
        // Using string literals for search; .search() can also take regex, but here it's literal.
        const texturesStartRegex = /<Textures>/; 
        const texturesEndRegex = /<\/Textures>/; 

        let materialStartIndex = templateXMLText.indexOf(materialCanvasStart);
        if (materialStartIndex !== -1) {
            let materialEndIndex = templateXMLText.indexOf(materialCanvasEnd, materialStartIndex);
            if (materialEndIndex !== -1) {
                // Extract the content between <Material ...> and </Material>
                let materialContent = templateXMLText.substring(materialStartIndex + materialCanvasStart.length, materialEndIndex);
                
                let texturesSectionStartIndex = materialContent.search(texturesStartRegex);
                let texturesSectionEndIndex = materialContent.search(texturesEndRegex);

                // Construct the new <Textures> section with dynamic iChannel mappings
                const newTexturesXMLSection = `\n      <Textures>\n${materialTexturesXMLString}      </Textures>\n    `;

                if (texturesSectionStartIndex !== -1 && texturesSectionEndIndex !== -1) {
                    // Replace existing <Textures> section
                    materialContent = materialContent.substring(0, texturesSectionStartIndex) + newTexturesXMLSection + materialContent.substring(texturesSectionEndIndex + "</Textures>".length);
                } else {
                    // Prepend <Textures> section if it doesn't exist (should be rare for this template)
                    materialContent = newTexturesXMLSection + materialContent; 
                }
                // Reconstruct templateXMLText with modified materialContent
                templateXMLText = templateXMLText.substring(0, materialStartIndex + materialCanvasStart.length) + materialContent + templateXMLText.substring(materialEndIndex);
            }
        }
        
        // 5c. Add new <Bitmap> resources to <Content>
        const contentEndMarker = '</Content>';
        const contentEndIndex = templateXMLText.lastIndexOf(contentEndMarker);
        if (contentEndIndex !== -1 && newBitmapsXMLString) {
            templateXMLText = templateXMLText.substring(0, contentEndIndex) + newBitmapsXMLString + templateXMLText.substring(contentEndIndex);
        }

        // 5d. Splice the final prepared shader code into the template
        const shaderStartMarker = "//ShaderToy code start."; // Marker in template
        const shaderEndMarker = "//ShaderToy code end.";   // Marker in template
        if(templateXMLText.includes(shaderStartMarker) && templateXMLText.includes(shaderEndMarker)) {
            const startIndex = templateXMLText.indexOf(shaderStartMarker) -1; // Position before the marker line
            const endIndex = templateXMLText.indexOf(shaderEndMarker) + shaderEndMarker.length + 1; // Position after the marker line
            templateXMLText = templateXMLText.substring(0, startIndex) + '\n' + finalShaderCode + '\n' + templateXMLText.substring(endIndex);
        }

        // 5e. Update AuthorInfo in template
        const authorStr = '<Constant Name="AuthorInfo" Type="2"/>';
        const authorStrNew = `<Constant Name="AuthorInfo" Type="2" StringValue="${author}"/>`;
        templateXMLText = templateXMLText.replace(authorStr, authorStrNew);

        // 5f. Update Parameters SizeDim1 for ZGE custom variables
        const paramsSizeDimRegex = /<Array Name="Parameters" SizeDim1="(\d+)" Persistent="255">/;
        const numParams = (zgedelta ? 1 : 0) + ZGEvars.length;
        const paramsSizeDimNew = `<Array Name="Parameters" SizeDim1="${numParams}" Persistent="255">`;
        templateXMLText = templateXMLText.replace(paramsSizeDimRegex, paramsSizeDimNew);
        
        // 5g. Generate and insert ShaderVariable XML for ZGE custom parameters
        let shaderVarsXMLString = '<ShaderVariable VariableName="iMouse" VariableRef="uMouse"/>\n'; // Start with iMouse
        ZGEvars.forEach(function(param, index) {
            let paramIndexInArray = index + (zgedelta ? 1 : 0);
            let paramControlRef = `Parameters[${paramIndexInArray}]`;
            shaderVarsXMLString += '        '; // Indentation
            shaderVarsXMLString += `<ShaderVariable Name="ZGE${param.id}" VariableName="ZGE${param.id}" ValuePropRef="`;
            // Booleans don't need range remapping
            if (param.type === 'bool') {
                shaderVarsXMLString += paramControlRef;
            } else if (param.rangeFrom && param.rangeTo) {
                const min = parseFloat(param.rangeFrom);
                const max = parseFloat(param.rangeTo);
                if (min === 0.0 && max === 1.0) {
                    shaderVarsXMLString += paramControlRef;
                } else {
                    shaderVarsXMLString += `(((${paramControlRef} - 0.0) * (${max} - ${min})) / (1.0 - 0.0)) + ${min}`;
                }
            } else {
                shaderVarsXMLString += paramControlRef;
            }
            shaderVarsXMLString += '"/>\n';
        });
        templateXMLText = templateXMLText.replace('<ShaderVariable VariableName="iMouse" VariableRef="uMouse"/>\n', shaderVarsXMLString);

        // 5h. Adjust Speed parameter if zgedelta is used
        if (zgedelta) {
            templateXMLText = templateXMLText.replace("float Speed=1.0;", "float Speed=(Parameters[0]-.5)*4.0;");
        }

        // 6. Parameter Values Encoding (for CDATA block)
        // =================================================================
        function encodeFloatsToCompressedHex(floats) {
            // Ensure input is an array of numbers
            if (!Array.isArray(floats) || !floats.every(f => typeof f === 'number' && !isNaN(f))) {
                console.warn('encodeFloatsToCompressedHex: Input must be an array of valid numbers. Returning empty string.');
                displayNotification('Warning: Could not encode parameter values due to invalid input.', 'warning');
                return "789C"; // Minimal valid DEFLATE block (empty string)
            }
            if (floats.length === 0) {
                return "789C"; // Default for empty params, ZGE expects at least this
            }

            // Step 1 & 2: Convert the floats to an ArrayBuffer in IEEE 754 format
            const buffer = new ArrayBuffer(floats.length * 4); // 4 bytes per float
            const view = new DataView(buffer);
            floats.forEach((float, index) => {
                view.setFloat32(index * 4, float, true); // true for little endian
            });
        
            // Step 3: Compress the byte array using pako (DEFLATE)
            const compressed = pako.deflate(new Uint8Array(buffer));
        
            // Step 4: Convert the compressed data to a hexadecimal string
            return Array.from(compressed).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        // create sizeDim1 array from i.values
        let scaledValues = [];
        if (zgedelta) {scaledValues.push(0.5);} // For ZGE Delta Speed control if enabled

        let scaledParamValues = []; // Values to be encoded for ZGEP
        if (zgedelta) {scaledParamValues.push(0.5);} // Default for ZGEDelta Speed control

        ZGEvars.forEach(function(param) {
            let originalValueFloat;
            
            // Handle boolean values
            if (param.type === 'bool') {
                const boolValue = param.value.toLowerCase();
                if (boolValue === 'true' || boolValue === '1' || boolValue === '1.0') {
                    originalValueFloat = 1.0;
                } else if (boolValue === 'false' || boolValue === '0' || boolValue === '0.0') {
                    originalValueFloat = 0.0;
                } else {
                    displayNotification(`Warning: Boolean parameter ZGE${param.id} has invalid value "${param.value}". Defaulting to false (0.0).`, 'warning');
                    originalValueFloat = 0.0;
                }
            } else {
                originalValueFloat = parseFloat(param.value);
            }
            
            let scaledValue; // This will be in the 0-1 range for ZGEP

            // Booleans don't need range scaling, they're already 0.0 or 1.0
            if (param.type === 'bool') {
                scaledValue = originalValueFloat; // Already 0.0 or 1.0
            } else if (param.rangeFrom !== undefined && param.rangeTo !== undefined) {
                let min = parseFloat(param.rangeFrom);
                let max = parseFloat(param.rangeTo);

                if (isNaN(min) || isNaN(max)) {
                    displayNotification(`Warning: Parameter ZGE${param.id} has invalid range values (Range: ${param.rangeFrom}, ${param.rangeTo}). Using original value ${originalValueFloat} clamped to 0-1.`, 'warning');
                    scaledValue = Math.max(0.0, Math.min(1.0, originalValueFloat)); // Clamp original value
                } else if (min === 0.0 && max === 1.0) {
                    // Value is declared as 0-1. Clamp if it's outside, but don't remap.
                    scaledValue = Math.max(0.0, Math.min(1.0, originalValueFloat));
                    if (originalValueFloat < 0.0 || originalValueFloat > 1.0) {
                         displayNotification(`Info: Parameter ZGE${param.id} (value: ${originalValueFloat.toFixed(3)}) was clamped to ${scaledValue.toFixed(1)} as its range is 0.0-1.0.`, 'info');
                    }
                } else { // Custom range defined, scale to 0-1
                    if (max === min) { // Avoid division by zero
                        scaledValue = (originalValueFloat >= min) ? 1.0 : 0.0;
                    } else {
                        scaledValue = (originalValueFloat - min) / (max - min);
                    }
                    // Clamp the result of scaling to ensure it's within 0-1 for ZGEP
                    if (scaledValue < 0.0 || scaledValue > 1.0) {
                        displayNotification(`Info: Parameter ZGE${param.id} (value: ${originalValueFloat.toFixed(3)}) was outside its defined range [${min}, ${max}]. Scaled value ${scaledValue.toFixed(3)} clamped to 0-1.`, 'info');
                        scaledValue = Math.max(0.0, Math.min(1.0, scaledValue));
                    }
                }
            } else { // No range defined, default target range is 0.0 to 1.0 for ZGEP
                if (originalValueFloat < 0.0 || originalValueFloat > 1.0) {
                    scaledValue = Math.max(0.0, Math.min(1.0, originalValueFloat));
                    displayNotification(`Warning: Parameter ZGE${param.id} (value: ${originalValueFloat.toFixed(3)}) was clamped to ${scaledValue.toFixed(1)} as no custom range was set (defaulting to 0-1 for ZGEP).`, 'warning');
                } else {
                    scaledValue = originalValueFloat;
                }
            }
            scaledParamValues.push(isNaN(scaledValue) ? 0.0 : +scaledValue); // Ensure valid number, default to 0.0 if NaN
        });
        const encodedHexValues = encodeFloatsToCompressedHex(scaledParamValues);
        templateXMLText = templateXMLText.replace('<![CDATA[789C]]>', `<![CDATA[${encodedHexValues}]]>`);
        // =================================================================

        // 7. Parameter Names for CDATA (ParamHelpConst)
        let paramNamesCDATA = '<![CDATA[';
        if (zgedelta) {paramNamesCDATA += 'Speed\n';}
        
        // Helper function to format ZGE variable names for display (e.g., "zgeMyVar" to "My Var")
        function formatParamNameForDisplay(str) {
            // Remove "ZGE" prefix if present
            const nameWithoutPrefix = str.startsWith('ZGE') ? str.substring(3) : str;
            const words = nameWithoutPrefix.split(/(?=[A-Z])/); // Split by capital letters
            return words.map((word, index) => {
              // Capitalize first word, rest are already capitalized appropriately
              if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
              return word;
            }).join(' ');
        }

        ZGEvars.forEach(function(param) {
            let tagsString = "";
            if (param.tags) {
                // Split tags by space and prefix each with @
                const tagArray = param.tags.split(/\s+/);
                tagsString = ' ' + tagArray.map(tag => '@' + tag).join(' ');
            }
            paramNamesCDATA += formatParamNameForDisplay(param.id) + tagsString + '\n';
        });
        // Ensure at least one entry if ZGEvars is empty but zgedelta is not, or a default for empty.
        if (ZGEvars.length === 0 && !zgedelta) {
            // If no params and no zgedelta, ZGE might expect a default like "Alpha" or just an empty CDATA
            // The original template had "Alpha", let's keep a placeholder if completely empty.
            // However, the regex for ParamHelpConst might be specific.
            // For now, if it's empty, it will just be "<![CDATA[]]>" which is fine.
            // If ZGEvars is empty and no zgedelta, it will be an empty CDATA.
            // If zgedelta is true and ZGEvars is empty, it will be "<![CDATA[Speed\n]]>".
        }
         paramNamesCDATA += ']]>'; // Close CDATA
        templateXMLText = templateXMLText.replace('<![CDATA[Alpha\n]]>', paramNamesCDATA);


        // Final output assignment
        finalOutputCode = templateXMLText;
        document.getElementById('outputCode').value = finalOutputCode;

    } catch (error) {
        console.error('Processing error:', error);
        displayNotification(`Error during conversion: ${error.message}. Check console for details.`, 'error');
        return; // Halt conversion process
    }
    
    // Display the "Operation completed!" notification (or it might be overwritten by warnings)
    // It's better if displayNotification is the single source of truth for the notification bar.
    // So, if there were no warnings, show "Operation completed!"
    const notificationElement = document.getElementById('notification');
    if (notificationElement.innerHTML === '' || notificationElement.classList.contains('hidden')) {
         // If no warnings were added, or it was hidden, show completion.
         // However, displayNotification now manages its own timeout.
         // We can add a success message if no warnings.
         let hasWarnings = false;
         notificationElement.querySelectorAll('.notification-message').forEach(msgElement => {
             if (msgElement.classList.contains('notification-warning')) {
                 hasWarnings = true;
             }
         });
         if (!hasWarnings) {
            displayNotification('Operation completed!', 'info');
         }
    } else if (!notificationElement.classList.contains('hidden') && notificationElement.innerHTML !== '') {
        // If there are warnings, append the success message.
        displayNotification('Operation completed!', 'info');
    }


    // Create or update the copy button
    let copyButton = document.getElementById('copyButton');
    let downloadButton = document.getElementById('downloadButton');
    if (!copyButton) { // If the button doesn't exist, create it
        copyButton = document.createElement('button');
        copyButton.id = 'copyButton';
        copyButton.textContent = '🗐 Copy';
        document.querySelector('#content').appendChild(copyButton);
        // Create download button
        downloadButton = document.createElement('button');
        downloadButton.id = 'downloadButton';
        downloadButton.textContent = '⇩ Download ZGE Project';
        document.querySelector('#content').appendChild(downloadButton);
    }
    
    // Set the download link with the converted code
    const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(finalOutputCode);
    downloadButton.setAttribute('href', dataUri);
    downloadButton.setAttribute('download', author + ' ' + title + '.zgeproj');
    copyButton.onclick = function() {
        navigator.clipboard.writeText(finalOutputCode);
        alert("Copied");
    }
    
    // Change button to an anchor to support download attribute
    downloadButton.outerHTML = downloadButton.outerHTML.replace(/^<button/, '<a class="button"').replace(/button>$/, 'a>');

});
