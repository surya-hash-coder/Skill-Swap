// Enhanced Authentication System
class AuthManager {
    constructor() {
        this.currentForm = 'login';
        this.isProcessing = false;
        this.init();
    }

    init() {
        this.initializeFirebase();
        this.initializeEventListeners();
        this.checkAuthenticationState();
        this.checkUrlParams();
    }

    initializeFirebase() {
        try {
            const firebaseConfig = {
                apiKey: "AIzaSyBfxk-WtnAh2nASrRkQ_c_4HIed3En5B5c",
                authDomain: "skillswap-e8081.firebaseapp.com",
                projectId: "skillswap-e8081",
                storageBucket: "skillswap-e8081.firebasestorage.app",
                messagingSenderId: "906362319041",
                appId: "1:906362319041:web:4acbab15eedba776762440"
            };

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.showToast('Error initializing application', 'error');
        }
    }

    initializeEventListeners() {
        // Form switching
        this.setupFormSwitching();
        
        // Form submissions
        this.setupFormSubmissions();
        
        // Password visibility toggle
        this.setupPasswordToggle();
        
        // Enter key support
        this.setupEnterKeySupport();
    }

    setupFormSwitching() {
        document.getElementById('switchToSignup')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchForm('signup');
        });

        document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchForm('login');
        });

        document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchForm('forgot');
        });

        document.getElementById('backToLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchForm('login');
        });
    }

    setupFormSubmissions() {
        document.getElementById('loginFormElement')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signupFormElement')?.addEventListener('submit', (e) => this.handleSignup(e));
        document.getElementById('forgotPasswordFormElement')?.addEventListener('submit', (e) => this.handleForgotPassword(e));
    }

    setupPasswordToggle() {
        document.querySelectorAll('.toggle-password').forEach(button => {
            button.addEventListener('click', (e) => {
                const targetId = e.target.closest('.toggle-password').getAttribute('data-target');
                const passwordInput = document.getElementById(targetId);
                const icon = e.target.closest('.toggle-password').querySelector('i');
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        });
    }

    setupEnterKeySupport() {
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.type !== 'textarea' && e.target.type !== 'submit') {
                e.preventDefault();
                const activeForm = document.querySelector('.auth-form.active');
                const submitButton = activeForm?.querySelector('button[type="submit"]');
                if (submitButton && !this.isProcessing) {
                    submitButton.click();
                }
            }
        });
    }

    checkAuthenticationState() {
        firebase.auth().onAuthStateChanged((user) => {
            console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
            
            if (user && user.emailVerified && window.location.pathname.includes('auth.html')) {
                console.log('User already authenticated, redirecting to dashboard...');
                this.redirectToDashboard();
            }
        });
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        
        if (mode === 'signup') {
            this.switchForm('signup');
        }
    }

    switchForm(formType) {
        if (this.isProcessing) return;
        
        // Hide all forms
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });

        // Show selected form
        const formMap = {
            'login': 'loginForm',
            'signup': 'signupForm',
            'forgot': 'forgotPasswordForm'
        };

        const formId = formMap[formType];
        if (formId) {
            document.getElementById(formId).classList.add('active');
            this.currentForm = formType;
            
            // Clear forms when switching
            this.clearFormErrors();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        if (this.isProcessing) return;

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const button = e.target.querySelector('button[type="submit"]');

        // Validation
        if (!this.validateEmail(email)) {
            this.showToast('Please enter a valid email address', 'error');
            return;
        }

        if (!password) {
            this.showToast('Please enter your password', 'error');
            return;
        }

        this.setLoadingState(button, true);

        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            if (!user.emailVerified) {
                this.showToast('Please verify your email address before signing in', 'warning');
                await firebase.auth().signOut();
                this.setLoadingState(button, false);
                return;
            }

            this.showToast('Welcome back! Redirecting...', 'success');
            
            // Create user profile if it doesn't exist
            await this.ensureUserProfile(user);
            
            // Redirect after short delay
            setTimeout(() => this.redirectToDashboard(), 1500);

        } catch (error) {
            console.error('Login error:', error);
            this.handleAuthError(error, 'login');
            this.setLoadingState(button, false);
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        if (this.isProcessing) return;

        const firstName = document.getElementById('signupFirstName').value.trim();
        const lastName = document.getElementById('signupLastName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;
        const button = e.target.querySelector('button[type="submit"]');

        // Validation
        if (!firstName || !lastName) {
            this.showToast('Please enter your first and last name', 'error');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showToast('Please enter a valid email address', 'error');
            return;
        }

        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters long', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showToast('Passwords do not match', 'error');
            return;
        }

        this.setLoadingState(button, true);

        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Update profile with display name
            await user.updateProfile({
                displayName: `${firstName} ${lastName}`
            });

            // Send email verification
            await user.sendEmailVerification();

            // Create user profile in Firestore
            await this.createUserProfile(user, { firstName, lastName, email });

            this.showToast('Account created! Please check your email for verification.', 'success');
            
            // Switch to login form after delay
            setTimeout(() => {
                this.switchForm('login');
                this.setLoadingState(button, false);
            }, 3000);

        } catch (error) {
            console.error('Signup error:', error);
            this.handleAuthError(error, 'signup');
            this.setLoadingState(button, false);
        }
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        if (this.isProcessing) return;

        const email = document.getElementById('forgotEmail').value.trim();
        const button = e.target.querySelector('button[type="submit"]');

        if (!this.validateEmail(email)) {
            this.showToast('Please enter a valid email address', 'error');
            return;
        }

        this.setLoadingState(button, true);

        try {
            await firebase.auth().sendPasswordResetEmail(email);
            this.showToast('Password reset email sent! Check your inbox.', 'success');
            
            // Clear form and switch back to login
            e.target.reset();
            setTimeout(() => {
                this.switchForm('login');
                this.setLoadingState(button, false);
            }, 2000);

        } catch (error) {
            console.error('Password reset error:', error);
            this.handleAuthError(error, 'reset');
            this.setLoadingState(button, false);
        }
    }

    async signInWithGoogle() {
        if (this.isProcessing) return;

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');

            this.showToast('Connecting to Google...', 'info');
            
            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;

            // Create or update user profile
            await this.ensureUserProfile(user);

            this.showToast('Successfully signed in with Google!', 'success');
            this.redirectToDashboard();

        } catch (error) {
            console.error('Google sign-in error:', error);
            
            if (error.code === 'auth/popup-closed-by-user') {
                this.showToast('Google sign-in was cancelled', 'warning');
            } else {
                this.handleAuthError(error, 'google');
            }
        }
    }

    async ensureUserProfile(user) {
        try {
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                await this.createUserProfile(user, {
                    firstName: user.displayName?.split(' ')[0] || 'User',
                    lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
                    email: user.email
                });
            }
        } catch (error) {
            console.error('Error ensuring user profile:', error);
        }
    }

    async createUserProfile(user, userData) {
        try {
            await firebase.firestore().collection('users').doc(user.uid).set({
                uid: user.uid,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                displayName: user.displayName || `${userData.firstName} ${userData.lastName}`,
                bio: '',
                skillsToTeach: [],
                skillsToLearn: [],
                availability: {},
                profilePhoto: user.photoURL || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                emailVerified: user.emailVerified
            });
        } catch (error) {
            console.error('Error creating user profile:', error);
            throw error;
        }
    }

    handleAuthError(error, context) {
        let errorMessage = 'An error occurred. Please try again.';
        
        switch (error.code) {
            // Common errors
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password accounts are not enabled. Please contact support.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
                
            // Login specific
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
                
            // Signup specific
            case 'auth/email-already-in-use':
                errorMessage = 'An account with this email already exists.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please choose a stronger password.';
                break;
                
            // Google auth specific
            case 'auth/popup-closed-by-user':
                errorMessage = 'Sign-in was cancelled.';
                break;
            case 'auth/popup-blocked':
                errorMessage = 'Sign-in popup was blocked. Please allow popups for this site.';
                break;
            case 'auth/unauthorized-domain':
                errorMessage = 'This domain is not authorized for OAuth operations.';
                break;
                
            // Reset password specific
            case 'auth/missing-email':
                errorMessage = 'Please enter your email address.';
                break;
        }
        
        this.showToast(errorMessage, 'error');
    }

    setLoadingState(button, isLoading) {
        this.isProcessing = isLoading;
        
        if (button) {
            const btnText = button.querySelector('.btn-text');
            const btnLoading = button.querySelector('.btn-loading');
            
            if (isLoading) {
                btnText.style.display = 'none';
                btnLoading.style.display = 'inline';
                button.disabled = true;
            } else {
                btnText.style.display = 'inline';
                btnLoading.style.display = 'none';
                button.disabled = false;
            }
        }
    }

    clearFormErrors() {
        // Clear any existing error states
        document.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    redirectToDashboard() {
        window.location.href = 'dashboard.html';
    }

    showToast(message, type = 'success') {
        // Create toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        const toastId = 'toast-' + Date.now();
        const typeIcons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="fas ${typeIcons[type] || 'fa-info-circle'} me-2"></i>
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 4000 });
        toast.show();
        
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.authManager = new AuthManager();
});

// Global functions for HTML onclick handlers
function signInWithGoogle() {
    if (window.authManager) {
        window.authManager.signInWithGoogle();
    }
}
