document.getElementById('convertButton').addEventListener('click', async function() {
    const inputCode = document.getElementById('inputCode').value;
    let zgedelta = false;
    let title = "ZGEshader";
    let author = "Shader author";
    const ZGEvars = [];
    let outputCode = inputCode.replaceAll('texture(', 'texture2D(');
    // Fill vars variable array
    const regex = /float ZGE(\w+)\s*=\s*([^;]+);(?:\s*\/\/\s*Range:\s*(-?[0-9]+\.?[0-9]*),\s*(-?[0-9]+\.?[0-9]*))?(?:\s*\/\/\s*@tags\s*(\w+))?/g;
    let matches;
    let varString = "";
    while ((matches = regex.exec(outputCode)) !== null) {
        // Extracting the range values if they are present
        let rangeFrom = matches[3] ? matches[3].trim() : undefined;
        let rangeTo = matches[4] ? matches[4].trim() : undefined;
        // Extracting the separator value if it is present
        let tags = matches[5] ? matches[5].trim() : undefined;
        
        varString += "uniform float ZGE" + matches[1] + ';\n';
        ZGEvars.push({
            id: matches[1],
            value: matches[2].trim(),
            rangeFrom: rangeFrom,
            rangeTo: rangeTo,
            tags: tags
        });
    }
    
    // Get shader name and author from provided code
    var lines = outputCode.split('\n');
    outputCode = varString;
    lines.forEach(function(line, i, object) {
        // we don't want to re-add these lines if author and title are found
        // as they're added to the project file
        let reAdd = true;
        if (line.includes("//")) {
            // Convert line to lowercase for case-insensitive search
            var lcase = line.toLowerCase();
            var index = lcase.indexOf("title:");
            if (index !== -1) {
                title = line.substring(index + 7).trim();
                reAdd = false;
            }
            index = lcase.indexOf("author:");
            if (index !== -1) {
                author = line.substring(index + 8).trim();
                reAdd = false;
            }
            index = lcase.indexOf("zgedelta");
            if (index !== -1) {
                zgedelta = true;
                reAdd = false;
            }
        }
        // we've already filled the ZGEvars array so lets now remove the lines from the code
        // since they'll be added as uniforms
        if (line.includes("float ZGE")) reAdd = false;
        if (reAdd) outputCode += line + '\n';
    });

    // Splice user code into template
    try {
        const response = await fetch('./templates/basic.zgeproj');
        if (!response.ok) throw new Error('Network response was not ok.');

        let t = await response.text();
        const startMarker = "//ShaderToy code start.";
        const endMarker = "//ShaderToy code end.";

        if(t.includes(startMarker) && t.includes(endMarker)) {
            const startIndex = t.indexOf(startMarker) - 1;
            const endIndex = t.indexOf(endMarker) + endMarker.length + 2;
            t = t.substring(0, startIndex) + '\n' + outputCode + '\n' + t.substring(endIndex);
        }

        // Add shader author into template
        const authorStr = '<Constant Name="AuthorInfo" Type="2"/>';
        let authorStrNew = '<Constant Name="AuthorInfo" Type="2" StringValue="' + author + '"/>';
        t = t.replace(authorStr, authorStrNew);

        // replace sizeDim1 with varString size
        const sizeDim = '<Array Name="Parameters" SizeDim1="1" Persistent="255">';
        let x = 0;
        if (zgedelta) { x = 1;}
        let sizeDimNew = '<Array Name="Parameters" SizeDim1="' + (ZGEvars.length + x) + '" Persistent="255">'
        t = t.replace(sizeDim, sizeDimNew);

        // add variables as parameters
        varString = '<ShaderVariable VariableName="iMouse" VariableRef="uMouse"/>\n';
        ZGEvars.forEach(function(i, index) {
            let ix = index;
            if (zgedelta) ix += 1;
            let p = 'Parameters[' + ix + ']';
            varString += '        ';
            varString += '<ShaderVariable Name="ZGE' + i.id;
            varString += '" VariableName="ZGE' + i.id;
            varString += '" ValuePropRef="';
            // if the range is defined, add it to the string
            if (i.rangeFrom && i.rangeTo) {
                if ( i.rangeFrom == "0.0" && i.rangeTo == "1.0") {
                    varString += p;
                } else {
                    let max = i.rangeTo;
                    let min = i.rangeFrom;
                    varString += `(((${p} - 0.0) * (${max} - ${min})) / (1.0 - 0.0)) + ${min}`;
                }
            } else {
                varString += p;
            }
            varString += '"/>\n';
        });
        t = t.replace('<ShaderVariable VariableName="iMouse" VariableRef="uMouse"/>\n', varString);

        // add zgedelta adjustment for speed if applicable
        if (zgedelta) {
            t = t.replace("float Speed=1.0;", "float Speed=(Parameters[0]-.5)*4.0;");
        }

        // =================================================================
        function encodeFloatsToCompressedHex(floats) {
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
        if (zgedelta) {scaledValues.push(0.5);}
        ZGEvars.forEach(function(i, index) {
            // original shadertoy code uses unscaled values
            // we'll only need to scale values above 1.0
            // or below 0.0 for ZGE to work with them
            let scaledValue = i.value;
            let max = i.rangeTo;
            let min = i.rangeFrom;
            if (max > 1.0 || max < 0.0 || min > 1.0 || min < 0.0) {
                scaledValue = (((i.value - min) * (1.0 - 0.0) ) / (max - min) ) + 0.0;
            }
            scaledValues.push(+scaledValue);
        });
        const encodedHex = encodeFloatsToCompressedHex(scaledValues);
        t = t.replace('<![CDATA[789C]]>', '<![CDATA[' + encodedHex + ']]>');
        // =================================================================

        // add variables to CDATA
        varString = '<![CDATA[';
        if (zgedelta) {varString += 'Speed\n';}
        // quick function to format the variables for easy reading:
        // areaOfEffect to Area Of Effect
        function formatString(str) {
            const words = str.split(/(?=[A-Z])/);
            const caps = words.map((word, index) => {
              if (index === 0) {
                return word.charAt(0).toUpperCase() + word.slice(1);
              }
              return word;
            });
            return caps.join(' ');
        }
        ZGEvars.forEach(function(i) {
            // TODO
            let tags = " " + i.tags;
            varString += formatString(i.id) + tags + '\n';
        });
        t = t.replace('<![CDATA[Alpha\n', varString);

        outputCode = t;
        document.getElementById('outputCode').value = t;
    } catch (error) {
        console.error('Failed to fetch the template:', error);
    }
    
    // Display the notification
    const notification = document.getElementById('notification');
    notification.classList.remove('hidden');
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000); // Hide the notification after 3 seconds

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
    const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(outputCode);
    downloadButton.setAttribute('href', dataUri);
    downloadButton.setAttribute('download', author + ' ' + title + '.zgeproj');
    copyButton.onclick = function() {
        navigator.clipboard.writeText(outputCode);
        alert("Copied");
    }
    
    // Change button to an anchor to support download attribute
    downloadButton.outerHTML = downloadButton.outerHTML.replace(/^<button/, '<a class="button"').replace(/button>$/, 'a>');

});
