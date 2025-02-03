document.querySelectorAll('.install-btn').forEach(button => {
    button.addEventListener('click', function () {
        const action = this.dataset.action;
        const statusMessage = document.getElementById('statusMessage');

        // Disable all buttons during installation
        document.querySelectorAll('.install-btn').forEach(btn => btn.disabled = true);

        // Show loading message
        statusMessage.className = 'alert alert-info';
        statusMessage.textContent = 'Installation in progress... Please wait.';
        statusMessage.classList.remove('d-none');

        // Send installation request
        fetch('install.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'action=' + encodeURIComponent(action)
        })
            .then(response => response.json())
            .then(data => {
                const statusMessage = document.getElementById('statusMessage');

                // Show progress information
                if (data.progress !== undefined) {
                    statusMessage.innerHTML = `
    <div class="mb-2">${data.message}</div>
    <div class="progress">
        <div class="progress-bar ${data.status === 'error' ? 'bg-danger' : ''}" 
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
                }

                statusMessage.className = 'alert alert-' +
                    (data.status === 'success' ? 'success' : 'danger');

                if (data.status === 'error') {
                    // Re-enable buttons on error
                    document.querySelectorAll('.install-btn').forEach(btn =>
                        btn.disabled = false
                    );
                } else if (data.progress === 100) {
                    // Hide buttons on successful completion
                    document.querySelectorAll('.installation-option').forEach(option => {
                        option.style.display = 'none';
                    });
                }
            })
            .catch(error => {
                const statusMessage = document.getElementById('statusMessage');
                statusMessage.className = 'alert alert-danger';
                statusMessage.textContent = 'Installation failed: ' + error.message;

                // Re-enable buttons
                document.querySelectorAll('.install-btn').forEach(btn =>
                    btn.disabled = false
                );
            });
    });
});