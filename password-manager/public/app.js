// UI Functions
function toggleForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    const forms = [loginForm, registerForm];
    forms.forEach(form => {
        form.style.opacity = '0';
        setTimeout(() => {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
            form.style.opacity = '1';
        }, 300);
    });
}

function showPasswordSection() {
    const authSection = document.getElementById('auth-section');
    const passwordSection = document.getElementById('password-section');
    
    authSection.style.opacity = '0';
    setTimeout(() => {
        authSection.style.display = 'none';
        passwordSection.style.display = 'block';
        setTimeout(() => {
            passwordSection.style.opacity = '1';
        }, 50);
    }, 300);
    
    loadPasswords();
}

function showAuthSection() {
    const authSection = document.getElementById('auth-section');
    const passwordSection = document.getElementById('password-section');
    
    passwordSection.style.opacity = '0';
    setTimeout(() => {
        passwordSection.style.display = 'none';
        authSection.style.display = 'block';
        setTimeout(() => {
            authSection.style.opacity = '1';
        }, 50);
    }, 300);
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
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.style.opacity = '1';
                resolve(result);
            }, 200);
        };

        cancelBtn.onclick = () => closeDialog(false);
        confirmBtn.onclick = () => closeDialog(true);
        
        overlay.style.display = 'flex';
    });
}

function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.style.display = 'none';
            toast.style.opacity = '1';
        }, 300);
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
            showToast('Registration successful! Please login.', 'success');
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
            showToast('Login successful!', 'success');
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
    showAuthSection();
    showToast('Logged out successfully', 'info');
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
            showToast('Password saved successfully!', 'success');
            event.target.reset();
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
    
    if (passwords.length === 0) {
        container.innerHTML = '<p class="no-passwords">No passwords saved yet. Add your first password above!</p>';
        return;
    }

    passwords.forEach(({ site, username, password }) => {
        const item = document.createElement('div');
        item.className = 'password-item';
        item.innerHTML = `
            <div class="password-details">
                <div class="site-name">${site}</div>
                <div class="username">${username}</div>
            </div>
            <div class="password-actions">
                <button onclick="togglePasswordVisibility(this, '${password}')" class="show-password">
                    <i class="ri-eye-line"></i>
                </button>
                <button onclick="copyToClipboard('${password}')" class="copy-password">
                    <i class="ri-file-copy-line"></i>
                </button>
                <button onclick="deletePassword('${site}')" class="delete-password">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

async function deletePassword(site) {
    const confirmed = await showDialog('Delete Password', `Are you sure you want to delete the password for ${site}?`);
    
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/passwords/${encodeURIComponent(site)}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Password deleted successfully', 'success');
            loadPasswords();
        } else {
            const data = await response.json();
            await showDialog('Error', data.error || 'Failed to delete password', false);
        }
    } catch (error) {
        await showDialog('Error', 'Error deleting password', false);
    }
}

function togglePasswordVisibility(button, password) {
    const icon = button.querySelector('i');
    if (icon.classList.contains('ri-eye-line')) {
        icon.classList.replace('ri-eye-line', 'ri-eye-off-line');
        button.setAttribute('data-tooltip', 'Hide password');
        button.innerHTML = `<i class="ri-eye-off-line"></i> ${password}`;
    } else {
        icon.classList.replace('ri-eye-off-line', 'ri-eye-line');
        button.setAttribute('data-tooltip', 'Show password');
        button.innerHTML = `<i class="ri-eye-line"></i>`;
    }
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Password copied to clipboard!', 'success');
    } catch (err) {
        showToast('Failed to copy password', 'error');
    }
}

function filterPasswords(event) {
    const searchTerm = event.target.value.toLowerCase();
    const items = document.querySelectorAll('.password-item');
    
    items.forEach(item => {
        const site = item.querySelector('.site-name').textContent.toLowerCase();
        const username = item.querySelector('.username').textContent.toLowerCase();
        
        if (site.includes(searchTerm) || username.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Add smooth transitions for initial load
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 50);
});
