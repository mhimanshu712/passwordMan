// UI Functions
function toggleForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }
}

function showPasswordSection() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('password-section').style.display = 'block';
    loadPasswords();
}

function showAuthSection() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('password-section').style.display = 'none';
}

// Dialog and Toast Functions
function showDialog(title, message, showCancel = true) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('dialog-overlay');
        const titleEl = document.getElementById('dialog-title');
        const messageEl = document.getElementById('dialog-message');
        const cancelBtn = document.getElementById('dialog-cancel');
        const confirmBtn = document.getElementById('dialog-confirm');

        titleEl.textContent = title;
        messageEl.textContent = message;
        cancelBtn.style.display = showCancel ? 'block' : 'none';

        const closeDialog = (result) => {
            overlay.style.display = 'none';
            resolve(result);
        };

        cancelBtn.onclick = () => closeDialog(false);
        confirmBtn.onclick = () => closeDialog(true);
        overlay.style.display = 'flex';
    });
}

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

// Authentication Functions
async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
        await showDialog('Error', 'Passwords do not match!', false);
        return false;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, masterPassword: password })
        });

        const data = await response.json();
        
        if (response.ok) {
            showToast('Registration successful! Please login.');
            toggleForms();
        } else {
            await showDialog('Error', data.error || 'Registration failed', false);
        }
    } catch (error) {
        await showDialog('Error', 'Error during registration', false);
    }
    return false;
}

async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, masterPassword: password })
        });

        const data = await response.json();
        
        if (response.ok) {
            showToast('Login successful!');
            showPasswordSection();
        } else {
            await showDialog('Error', data.error || 'Login failed', false);
        }
    } catch (error) {
        await showDialog('Error', 'Error during login', false);
    }
    return false;
}

function logout() {
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    showAuthSection();
}

// Password Management Functions
async function handleAddPassword(event) {
    event.preventDefault();
    
    const site = document.getElementById('site').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/passwords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ site, username, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('site').value = '';
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            showToast('Password saved successfully!');
            loadPasswords();
        } else {
            await showDialog('Error', data.error || 'Failed to save password', false);
        }
    } catch (error) {
        await showDialog('Error', 'Error saving password', false);
    }
    return false;
}

async function loadPasswords() {
    try {
        const response = await fetch('/api/passwords');
        const passwords = await response.json();
        
        if (response.ok) {
            displayPasswords(passwords);
        } else {
            await showDialog('Error', 'Failed to load passwords', false);
        }
    } catch (error) {
        await showDialog('Error', 'Error loading passwords', false);
    }
}

function displayPasswords(passwords) {
    const container = document.getElementById('passwords-container');
    container.innerHTML = '';

    passwords.forEach(({ site, username, password }) => {
        const item = document.createElement('div');
        item.className = 'password-item';
        
        item.innerHTML = `
            <div class="password-details">
                <h4>${site}</h4>
                <p>Username: ${username}</p>
                <p>Password: ${'•'.repeat(8)}</p>
            </div>
            <div class="password-actions">
                <button class="show-password" onclick="togglePasswordVisibility(this, '${password}')">Show</button>
                <button class="copy-password" onclick="copyToClipboard('${password}')">Copy</button>
                <button class="delete-password" onclick="deletePassword('${site}')">Delete</button>
            </div>
        `;
        
        container.appendChild(item);
    });
}

async function deletePassword(site) {
    const confirmed = await showDialog('Confirm Delete', 'Are you sure you want to delete this password?');
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/passwords/${encodeURIComponent(site)}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        
        if (response.ok) {
            showToast('Password deleted successfully!');
            loadPasswords();
        } else {
            await showDialog('Error', data.error || 'Failed to delete password', false);
        }
    } catch (error) {
        await showDialog('Error', 'Error deleting password', false);
    }
}

function togglePasswordVisibility(button, password) {
    const passwordText = button.parentElement.parentElement.querySelector('p:last-child');
    if (button.textContent === 'Show') {
        passwordText.textContent = `Password: ${password}`;
        button.textContent = 'Hide';
    } else {
        passwordText.textContent = `Password: ${'•'.repeat(8)}`;
        button.textContent = 'Show';
    }
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Password copied to clipboard!');
    } catch (err) {
        await showDialog('Error', 'Failed to copy password', false);
    }
}
