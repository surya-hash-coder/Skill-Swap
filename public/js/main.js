// Enhanced main.js with better error handling

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase is available
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded. Please check script order.');
        showToast('Error loading application. Please refresh the page.', 'error');
        return;
    }
    
    try {
        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyBfxk-WtnAh2nASrRkQ_c_4HIed3En5B5c",
            authDomain: "skillswap-e8081.firebaseapp.com",
            projectId: "skillswap-e8081",
            storageBucket: "skillswap-e8081.firebasestorage.app",
            messagingSenderId: "906362319041",
            appId: "1:906362319041:web:4acbab15eedba776762440"
        };

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        } else {
            firebase.app(); // if already initialized, use that one
        }

        console.log('Firebase initialized successfully');
        
        // Initialize app features
        initializeDarkMode();
        initializeAuthListener();
        
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showToast('Error initializing application', 'error');
    }
});

// Global variables
let currentUser = null;

// Dark Mode Toggle
function initializeDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    if (darkModeToggle) {
        document.documentElement.setAttribute('data-bs-theme', currentTheme);
        darkModeToggle.checked = currentTheme === 'dark';
        
        darkModeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.documentElement.setAttribute('data-bs-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.setAttribute('data-bs-theme', 'light');
                localStorage.setItem('theme', 'light');
            }
        });
    }
}

// Toast Notification System
function showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    const toastId = 'toast-' + Date.now();
    
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas ${getToastIcon(type)} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Remove toast from DOM after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

function getToastIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    return icons[type] || 'fa-info-circle';
}

// Authentication State Listener
// Authentication State Listener
function initializeAuthListener() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('Firebase Auth not available');
        setTimeout(initializeAuthListener, 100); // Retry after 100ms
        return;
    }
    
    firebase.auth().onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        currentUser = user;
        
        if (user) {
            // User is signed in
            console.log('User details:', {
                uid: user.uid,
                email: user.email,
                emailVerified: user.emailVerified,
                displayName: user.displayName
            });
            
            if (!user.emailVerified) {
                console.log('Email not verified');
                if (!window.location.pathname.includes('auth.html')) {
                    showToast('Please verify your email address', 'warning');
                    // Don't redirect from auth page if email not verified
                }
            } else {
                console.log('Email verified');
                // If on auth page and verified, redirect to dashboard
                if (window.location.pathname.includes('auth.html')) {
                    console.log('Redirecting to dashboard from auth page');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000);
                }
            }
            
            // Update UI for authenticated user
            updateAuthUI(user);
        } else {
            // User is signed out
            console.log('User signed out');
            
            // If not on auth page or index page, redirect to auth
            if (!window.location.pathname.includes('auth.html') && 
                !window.location.pathname.includes('index.html') &&
                window.location.pathname !== '/') {
                console.log('Redirecting to auth page');
                window.location.href = 'auth.html';
            }
            
            // Update UI for unauthenticated user
            updateAuthUI(null);
        }
    });
}
function updateAuthUI(user) {
    const authButtons = document.querySelector('.navbar .d-flex');
    
    if (authButtons) {
        if (user) {
            authButtons.innerHTML = `
                <div class="form-check form-switch me-3">
                    <input class="form-check-input" type="checkbox" id="darkModeToggle">
                    <label class="form-check-label text-white" for="darkModeToggle">
                        <i class="fas fa-moon"></i>
                    </label>
                </div>
                <div class="dropdown">
                    <button class="btn btn-light dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        <i class="fas fa-user me-2"></i>${user.displayName || 'User'}
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="dashboard.html"><i class="fas fa-tachometer-alt me-2"></i>Dashboard</a></li>
                        <li><a class="dropdown-item" href="profile.html"><i class="fas fa-user-edit me-2"></i>Profile</a></li>
                        <li><a class="dropdown-item" href="sessions.html"><i class="fas fa-calendar me-2"></i>Sessions</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" onclick="logout()"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
                    </ul>
                </div>
            `;
            // Re-initialize dark mode for the new toggle
            initializeDarkMode();
        } else {
            authButtons.innerHTML = `
                <div class="form-check form-switch me-3">
                    <input class="form-check-input" type="checkbox" id="darkModeToggle">
                    <label class="form-check-label text-white" for="darkModeToggle">
                        <i class="fas fa-moon"></i>
                    </label>
                </div>
                <button class="btn btn-outline-light me-2" onclick="location.href='auth.html'">Login</button>
                <button class="btn btn-light" onclick="location.href='auth.html?mode=signup'">Sign Up</button>
            `;
            // Re-initialize dark mode for the new toggle
            initializeDarkMode();
        }
    }
}

// Logout function
async function logout() {
    try {
        await firebase.auth().signOut();
        showToast('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (error) {
        showToast('Error logging out: ' + error.message, 'error');
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

// Add loading states to buttons
document.addEventListener('click', function(e) {
    if (e.target.type === 'submit' || e.target.closest('button[type="submit"]')) {
        const button = e.target.type === 'submit' ? e.target : e.target.closest('button[type="submit"]');
        if (button) {
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="loading-spinner me-2"></span>Loading...';
            button.disabled = true;
            
            // Revert after 5 seconds if still loading
            setTimeout(() => {
                if (button.disabled) {
                    button.innerHTML = originalText;
                    button.disabled = false;
                }
            }, 5000);
        }
    }
});

// Export for use in other modules
window.showToast = showToast;
window.logout = logout;
window.formatDate = formatDate;
window.debounce = debounce;