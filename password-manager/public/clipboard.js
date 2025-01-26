document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const clipboardText = document.getElementById('clipboardText');
    const copyBtn = document.getElementById('copyBtn');
    const saveBtn = document.getElementById('saveBtn');
    const clearBtn = document.getElementById('clearBtn');
    const clipHistory = document.getElementById('clipHistory');
    const settingsBtn = document.getElementById('settingsBtn');
    const shareBtn = document.getElementById('shareBtn');
    const changeRoomBtn = document.getElementById('changeRoomBtn');
    const shareModal = document.getElementById('shareModal');
    const changeRoomModal = document.getElementById('changeRoomModal');
    const shareRoomId = document.getElementById('shareRoomId');
    const newRoomId = document.getElementById('newRoomId');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const copyRoomId = document.getElementById('copyRoomId');
    const closeModalBtns = document.querySelectorAll('.close-btn');
    const connectionStatus = document.getElementById('connectionStatus');
    const roomIdDisplay = document.getElementById('roomId');
    const activeUsersDisplay = document.getElementById('activeUsers');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // Constants
    const DEFAULT_ROOM = 'SHARED-CLIPBOARD-01';

    // Socket.io connection
    const socket = io();
    let currentRoom = null;

    // Join room function
    function joinRoom(roomId) {
        if (currentRoom === roomId) return;
        
        const oldRoom = currentRoom;
        currentRoom = roomId;
        
        if (oldRoom) {
            socket.emit('leaveRoom', oldRoom);
            clipboardText.value = '';
        }
        
        socket.emit('joinRoom', roomId);
        roomIdDisplay.textContent = roomId;
        shareRoomId.value = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        
        // Load history for new room
        loadHistory();
        
        // Update URL without reloading
        const url = new URL(window.location);
        url.searchParams.set('room', roomId);
        window.history.pushState({}, '', url);
    }

    // Connect to room from URL or use default
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room') || DEFAULT_ROOM;
    joinRoom(roomId);

    // Socket event handlers
    socket.on('connect', () => {
        updateConnectionStatus(true);
    });

    socket.on('disconnect', () => {
        updateConnectionStatus(false);
    });

    socket.on('clipboardUpdate', (text) => {
        if (text !== clipboardText.value) {
            clipboardText.value = text;
            showNotification('New clipboard content received');
        }
    });

    socket.on('roomUsers', (count) => {
        activeUsersDisplay.textContent = count;
    });

    // Event Listeners
    clipboardText.addEventListener('input', debounce(() => {
        const text = clipboardText.value;
        socket.emit('updateClipboard', { room: currentRoom, text });
    }, 500));

    copyBtn.addEventListener('click', async () => {
        const text = clipboardText.value.trim();
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            showNotification('Copied to clipboard!');
        } catch (err) {
            showNotification('Failed to copy text', true);
            console.error('Failed to copy text:', err);
        }
    });

    saveBtn.addEventListener('click', () => {
        const text = clipboardText.value.trim();
        if (!text) {
            showNotification('Nothing to save', true);
            return;
        }
        addToHistory(text);
        showNotification('Saved to history!');
    });

    clearBtn.addEventListener('click', () => {
        clipboardText.value = '';
        socket.emit('updateClipboard', { room: currentRoom, text: '' });
        clipboardText.focus();
    });

    shareBtn.addEventListener('click', () => {
        shareModal.classList.add('active');
    });

    changeRoomBtn.addEventListener('click', () => {
        changeRoomModal.classList.add('active');
        newRoomId.value = '';
        setTimeout(() => newRoomId.focus(), 100);
    });

    joinRoomBtn.addEventListener('click', () => {
        const newRoom = newRoomId.value.trim().toUpperCase();
        if (!newRoom) {
            showNotification('Please enter a room ID', true);
            return;
        }
        joinRoom(newRoom);
        changeRoomModal.classList.remove('active');
        showNotification(`Joined room ${newRoom}`);
    });

    newRoomId.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinRoomBtn.click();
        }
    });

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            shareModal.classList.remove('active');
            changeRoomModal.classList.remove('active');
        });
    });

    copyRoomId.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(shareRoomId.value);
            showNotification('Room link copied!');
        } catch (err) {
            showNotification('Failed to copy room link', true);
        }
    });

    clearHistoryBtn.addEventListener('click', () => {
        clearHistory();
        showNotification('History cleared');
    });

    // Handle clicking outside modals
    window.addEventListener('click', (e) => {
        if (e.target === shareModal) {
            shareModal.classList.remove('active');
        }
        if (e.target === changeRoomModal) {
            changeRoomModal.classList.remove('active');
        }
    });

    // Settings button (vault access)
    settingsBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Utility Functions
    function generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    function updateConnectionStatus(connected) {
        connectionStatus.innerHTML = connected
            ? '<i class="ri-wifi-line"></i> Connected'
            : '<i class="ri-wifi-off-line"></i> Disconnected';
        connectionStatus.style.color = connected
            ? 'var(--success-color)'
            : 'var(--error-color)';
    }

    function showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <i class="ri-${isError ? 'error-warning-line' : 'checkbox-circle-line'}"></i>
            ${message}
        `;
        notification.style.color = isError ? 'var(--error-color)' : 'var(--success-color)';
        
        document.getElementById('notifications').appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Clipboard History Management
    const MAX_HISTORY_ITEMS = 10;
    let clipboardHistory = [];

    function loadHistory() {
        const savedHistory = localStorage.getItem(`clipboardHistory_${currentRoom}`);
        if (savedHistory) {
            clipboardHistory = JSON.parse(savedHistory);
            updateHistoryDisplay();
        }
    }

    function saveHistory() {
        localStorage.setItem(`clipboardHistory_${currentRoom}`, JSON.stringify(clipboardHistory));
    }

    function addToHistory(text) {
        if (!text) return;
        
        // Remove duplicate if exists
        clipboardHistory = clipboardHistory.filter(item => item !== text);
        
        // Add new item to the beginning
        clipboardHistory.unshift(text);
        
        // Keep only MAX_HISTORY_ITEMS
        if (clipboardHistory.length > MAX_HISTORY_ITEMS) {
            clipboardHistory.pop();
        }
        
        saveHistory();
        updateHistoryDisplay();
    }

    function clearHistory() {
        clipboardHistory = [];
        saveHistory();
        updateHistoryDisplay();
    }

    function updateHistoryDisplay() {
        clipHistory.innerHTML = '';
        clipboardHistory.forEach((text) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const textPreview = document.createElement('span');
            textPreview.textContent = text.length > 50 ? text.substring(0, 50) + '...' : text;
            
            const useButton = document.createElement('button');
            useButton.className = 'text-btn';
            useButton.innerHTML = '<i class="ri-arrow-left-line"></i> Use';
            
            historyItem.appendChild(textPreview);
            historyItem.appendChild(useButton);
            
            useButton.addEventListener('click', (e) => {
                e.stopPropagation();
                clipboardText.value = text;
                socket.emit('updateClipboard', { room: currentRoom, text });
                showNotification('Text restored from history');
            });
            
            clipHistory.appendChild(historyItem);
        });
    }

    // Initialize
    loadHistory();
});
