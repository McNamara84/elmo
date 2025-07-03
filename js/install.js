document.querySelectorAll('.install-btn').forEach(button => {
    button.addEventListener('click', async function () { // Made function async
        const action = this.dataset.action;
        const statusMessage = document.getElementById('statusMessage');

        // Disable all buttons during installation
        document.querySelectorAll('.install-btn').forEach(btn => btn.disabled = true);

        // Show loading message
        statusMessage.className = 'alert alert-info';
        statusMessage.textContent = 'Installation in progress... Please wait.';
        statusMessage.classList.remove('d-none');
        statusMessage.innerHTML = `<div class="mb-2">Installation in progress... Please wait.</div><div class="progress"><div class="progress-bar bg-info" role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div></div>`;


        let installationSuccess = false;

        try {
            // Step 1: Perform database installation (basic or complete)
            // If action is 'populate-and-xml', we force 'complete' for the database part
            const dbAction = (action === 'populate-and-xml') ? 'complete' : action;

            // Corrected path for install.php (it's in the parent directory relative to js/)
            let response = await fetch('../install.php', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=' + encodeURIComponent(dbAction)
            });
            let data = await response.json(); // This is where JSON parsing happens

            // Update status message for DB installation
            if (data.progress !== undefined) {
                statusMessage.innerHTML = `
                    <div class="mb-2">${data.message}</div>
                    <div class="progress">
                        <div class="progress-bar ${data.status === 'error' ? 'bg-danger' : (data.status === 'success' ? 'bg-success' : 'bg-info')}" 
                             role="progressbar" 
                             style="width: ${data.progress}%" 
                             aria-valuenow="${data.progress}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                            ${Math.round(data.progress)}%
                        </div>
                    </div>`;
            } else {
                statusMessage.textContent = data.message;
                statusMessage.className = 'alert alert-' + (data.status === 'success' ? 'success' : 'danger');
            }

            if (data.status === 'success' && data.progress === 100) {
                installationSuccess = true;
                // If it was just basic/complete, hide buttons and finish
                if (action !== 'populate-and-xml') {
                    document.querySelectorAll('.installation-option').forEach(option => {
                        option.style.display = 'none';
                    });
                }
            } else {
                // DB installation failed
                statusMessage.className = 'alert alert-danger';
                statusMessage.textContent = 'Database installation failed: ' + (data.message || 'Unknown error. Check server logs.');
                document.querySelectorAll('.install-btn').forEach(btn => btn.disabled = false);
                return; // Stop here if DB installation fails
            }

            // Step 2: If action is 'populate-and-xml' and DB was successful, generate XML
            if (action === 'populate-and-xml' && installationSuccess) {
                statusMessage.innerHTML = `<div class="mb-2">Database populated. Now generating XML files...</div><div class="progress"><div class="progress-bar bg-primary" role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div></div>`;

                // Corrected path for generate_xml.php (it's in the parent directory relative to js/)
                let xmlResponse = await fetch('../generate_xml.php', { 
                    method: 'POST', // Use POST if your PHP script expects it, otherwise GET
                    // No body needed if it just triggers generation for all
                });
                let xmlData = await xmlResponse.json(); // This is where JSON parsing happens

                // Update status for XML generation
                if (xmlData.progress !== undefined) {
                    let progressBarClass = 'bg-info';
                    if (xmlData.status === 'error') {
                        progressBarClass = 'bg-danger';
                    } else if (xmlData.status === 'success') {
                        progressBarClass = 'bg-success';
                    } else if (xmlData.status === 'warning') {
                        progressBarClass = 'bg-warning'; // For partial success
                    }

                    statusMessage.innerHTML = `
                        <div class="mb-2">${xmlData.message}</div>
                        <div class="progress">
                            <div class="progress-bar ${progressBarClass}" 
                                 role="progressbar" 
                                 style="width: ${xmlData.progress}%" 
                                 aria-valuenow="${xmlData.progress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                                ${Math.round(xmlData.progress)}%
                            </div>
                        </div>
                        ${xmlData.details && xmlData.details.length > 0 ? `<div class="mt-2 text-start small"><pre>${xmlData.details.join('\n')}</pre></div>` : ''}
                        `;
                } else {
                    statusMessage.textContent = xmlData.message;
                    statusMessage.className = 'alert alert-' + (xmlData.status === 'success' ? 'success' : (xmlData.status === 'warning' ? 'warning' : 'danger'));
                }

                if (xmlData.status === 'error') {
                    document.querySelectorAll('.install-btn').forEach(btn => btn.disabled = false);
                } else if (xmlData.progress === 100) {
                    document.querySelectorAll('.installation-option').forEach(option => {
                        option.style.display = 'none';
                    });
                }
            }

        } catch (error) {
            statusMessage.className = 'alert alert-danger';
            statusMessage.textContent = 'Operation failed: ' + error.message + '. Please check browser console and server logs.';
            console.error('Fetch error:', error);
            document.querySelectorAll('.install-btn').forEach(btn => btn.disabled = false);
        }
    });
});
