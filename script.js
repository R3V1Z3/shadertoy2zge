document.getElementById('convertButton').addEventListener('click', function() {
    const inputCode = document.getElementById('inputCode').value;
    const outputCode = inputCode.replaceAll('texture(', 'texture2D(');
    document.getElementById('outputCode').value = outputCode;
    
    // Display the notification
    const notification = document.getElementById('notification');
    notification.classList.remove('hidden');
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000); // Hide the notification after 3 seconds
});
