document.getElementById('convertButton').addEventListener('click', async function() {
    const inputCode = document.getElementById('inputCode').value;
    let ZGEname = "ZGEshader";
    let ZGEauthor = "Shader author";
    const ZGEvars = [];
    let outputCode = inputCode.replaceAll('texture(', 'texture2D(');
    // Fill vars variable array
    const regex = /float ZGE(\w+)\s*=\s*([^;]+);(?:\s*\/\/\s*Range:\s*([0-9.]+),\s*([0-9.]+))?/g;
    let matches;
    let varString = "";
    while ((matches = regex.exec(outputCode)) !== null) {
        // Extracting the range values if they are present
        let rangeFrom = matches[3] ? matches[3].trim() : undefined;
        let rangeTo = matches[4] ? matches[4].trim() : undefined;
        varString += "uniform float " + matches[1] + ';\n';
        ZGEvars.push({
            id: matches[1],
            value: matches[2].trim(),
            rangeFrom: rangeFrom,
            rangeTo: rangeTo,
        });
    }
    // Get shader name and author from provided code
    var lines = outputCode.split('\n');
    outputCode = varString;
    lines.forEach(function(line, i, object) {
        // reAdd indicates whether to re-add this line back into outputCode
        let reAdd = true;
        if (line.includes("//")) {
            var index = line.indexOf("ZGEname:");
            if (index !== -1) {
                ZGEname = line.substring(index + "ZGEname:".length).trim();
                reAdd = false;
            }
            index = line.indexOf("ZGEauthor:");
            if (index !== -1) {
                ZGEauthor = line.substring(index + "ZGEauthor:".length).trim();
                reAdd = false;
            }
        }
        // we've already filled the ZGEvars array so lets now remove the lines from the code
        // since they'll be added as uniforms
        if (line.includes("float ZGE")) reAdd = false;
        if (reAdd) outputCode += line + '\n';
    });
    ZGEvars.forEach(function(i) {
        outputCode = outputCode.replaceAll('ZGE' + i.id, i.id);
    });

    // Splice user code into template
    try {
        const response = await fetch('templates/basic.zgeproj');
        if (!response.ok) throw new Error('Network response was not ok.');

        let t = await response.text();
        const startMarker = "//ShaderToy code start.";
        const endMarker = "//ShaderToy code end.";

        if(t.includes(startMarker) && t.includes(endMarker)) {
            const startIndex = t.indexOf(startMarker) - 1;
            const endIndex = t.indexOf(endMarker) + endMarker.length + 1;
            t = t.substring(0, startIndex) + '\n' + outputCode + '\n' + t.substring(endIndex);
        }

        // Add shader author into template
        let authorString = '<Constant Name="AuthorInfo" Type="2" StringValue="' + ZGEauthor + '"/>';
        t = t.replace(/<Constant Name="AuthorInfo"[^>]*>/, authorString);

        // parse to get the variable name "ZGExxxxxx"

        // add variables as parameters
        varString = '<ShaderVariable VariableName="iMouse" VariableRef="uMouse"/>\n';
        ZGEvars.forEach(function(i) {
            varString += '        ';
            varString += '<ShaderVariable VariableName="' + i.id;
            varString += '" VariableRef="ZGE' + i.id;
            varString += '" Value="' + i.value + '"/>\n';
        });
        t = t.replace('<ShaderVariable VariableName="iMouse" VariableRef="uMouse"/>\n', varString);

        // add variables to CDATA
        varString = '<![CDATA[';
        ZGEvars.forEach(function(i) {
            varString += i.id[0].toUpperCase() + i.id.slice(1) + '\n';
        });
        t = t.replace('<![CDATA[Alpha\n', varString);

        // add variables to code
        varString = 'uMouse=vector4(0.0,0.0,0.0,0.0);\n';
        ZGEvars.forEach(function(i, index) {
            varString += 'ZGE' + i.id + '=';
            // if the range is defined, add it to the string
            if (i.rangeFrom && i.rangeTo) {
                if ( i.rangeFrom == "0.0" && i.rangeTo == "1.0") {
                    varString += 'Parameters[' + index + ']';
                } else {
                    // ( x - min(x) ) / ( max(x) - min(x) )
                    varString += '((' + 'Parameters[' + index + ']' + '-' + i.rangeFrom + ')/(' + i.rangeTo + '-' + i.rangeFrom + '))';
                }
            } else {
                varString += 'Parameters[' + index + ']';
            }
            varString += ';\n';
        });
        t = t.replace('uMouse=vector4(0.0,0.0,0.0,0.0);]]>\n', varString + ']]>\n');

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

    // Create or update the download button
    let downloadButton = document.getElementById('downloadButton');
    if (!downloadButton) { // If the button doesn't exist, create it
        downloadButton = document.createElement('button');
        downloadButton.id = 'downloadButton';
        downloadButton.textContent = '\u2913 Download ZGE Project File';
        document.querySelector('.container').appendChild(downloadButton);
    }
    
    // Set the download link with the converted code
    const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(outputCode);
    downloadButton.setAttribute('href', dataUri);
    downloadButton.setAttribute('download', ZGEname + '.zgeproj');
    
    // Change button to an anchor to support download attribute
    downloadButton.outerHTML = downloadButton.outerHTML.replace(/^<button/, '<a class="button"').replace(/button>$/, 'a>');

});
