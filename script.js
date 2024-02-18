document.getElementById('convertButton').addEventListener('click', async function() {
    const inputCode = document.getElementById('inputCode').value;
    let outputCode = inputCode.replaceAll('texture(', 'texture2D(');

    try {
        const response = await fetch('/templates/basic.zgeproj');
        if (!response.ok) throw new Error('Network response was not ok.');

        let t = await response.text();
        const startMarker = "//ShaderToy code start.";
        const endMarker = "//ShaderToy code end.";

        if(t.includes(startMarker) && t.includes(endMarker)) {
            const startIndex = t.indexOf(startMarker) + startMarker.length;
            const endIndex = t.lastIndexOf(endMarker);
            t = t.substring(0, startIndex) + '\n' + outputCode + '\n' + t.substring(endIndex);
        }

        outputCode = t;
        document.getElementById('outputCode').value = outputCode;
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
        downloadButton.textContent = 'Download Converted Code';
        document.querySelector('.container').appendChild(downloadButton);
    }
    
    // Set the download link with the converted code
    const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(outputCode);
    downloadButton.setAttribute('href', dataUri);
    downloadButton.setAttribute('download', 'ZGEshader.zgeproj');
    
    // Change button to an anchor to support download attribute
    downloadButton.outerHTML = downloadButton.outerHTML.replace(/^<button/, '<a').replace(/button>$/, 'a>');

});
