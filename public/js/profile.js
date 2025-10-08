// Profile management functionality
class ProfileManager {
    constructor() {
        this.userProfile = null;
        this.originalProfile = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            await this.checkAuthentication();
            await this.initializeProfile();
            this.initializePhotoUpload();
            this.initializeAvailability();
            this.initializeEventListeners();
            this.isInitialized = true;
        } catch (error) {
            console.error('Error initializing profile:', error);
            this.showToast('Error loading profile', 'error');
        }
    }

    async checkAuthentication() {
        return new Promise((resolve, reject) => {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (!user) {
                    this.showToast('Please log in to access your profile', 'error');
                    setTimeout(() => {
                        window.location.href = 'auth.html';
                    }, 2000);
                    reject(new Error('User not authenticated'));
                    return;
                }

                if (!user.emailVerified) {
                    this.showToast('Please verify your email address', 'warning');
                }
                resolve(user);
            });
        });
    }

    async initializeProfile() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            console.log('Loading user profile...');
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .get();

            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                this.originalProfile = JSON.parse(JSON.stringify(this.userProfile));
                
                console.log('Profile loaded:', this.userProfile);
                
                // Update profile photo if available
                if (this.userProfile.profilePhoto) {
                    document.getElementById('profilePhoto').src = this.userProfile.profilePhoto;
                } else {
                    // Use avatar based on display name
                    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userProfile.displayName)}&background=4F46E5&color=fff`;
                    document.getElementById('profilePhoto').src = avatarUrl;
                }
                
                document.getElementById('displayName').textContent = this.userProfile.displayName || 'User';
                document.getElementById('userEmail').textContent = user.email;
            } else {
                console.log('Creating new user profile...');
                // Create initial profile if doesn't exist
                this.userProfile = {
                    uid: user.uid,
                    firstName: user.displayName?.split(' ')[0] || '',
                    lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
                    displayName: user.displayName || '',
                    email: user.email,
                    bio: '',
                    skillsToTeach: [],
                    skillsToLearn: [],
                    availability: {},
                    profilePhoto: '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await firebase.firestore()
                    .collection('users')
                    .doc(user.uid)
                    .set(this.userProfile);
                    
                this.originalProfile = JSON.parse(JSON.stringify(this.userProfile));
            }

            this.populateProfileForm();
            
        } catch (error) {
            console.error('Error loading user profile:', error);
            throw error;
        }
    }

    populateProfileForm() {
        if (!this.userProfile) {
            console.error('User profile not loaded');
            return;
        }

        console.log('Populating form with profile:', this.userProfile);

        // Basic information
        document.getElementById('firstName').value = this.userProfile.firstName || '';
        document.getElementById('lastName').value = this.userProfile.lastName || '';
        document.getElementById('bio').value = this.userProfile.bio || '';

        // Initialize arrays if they don't exist
        if (!this.userProfile.skillsToTeach) this.userProfile.skillsToTeach = [];
        if (!this.userProfile.skillsToLearn) this.userProfile.skillsToLearn = [];
        if (!this.userProfile.availability) this.userProfile.availability = {};

        // Skills to teach
        this.renderSkillsList('teachSkillsList', this.userProfile.skillsToTeach, 'teach');

        // Skills to learn
        this.renderSkillsList('learnSkillsList', this.userProfile.skillsToLearn, 'learn');

        // Availability
        this.renderAvailability();
    }

    renderSkillsList(containerId, skills, type) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }

        if (!skills || skills.length === 0) {
            container.innerHTML = '<p class="text-muted small">No skills added yet</p>';
            return;
        }

        container.innerHTML = skills.map(skill => `
            <div class="skill-tag">
                ${this.escapeHtml(skill)}
                <button type="button" class="btn-close btn-close-white ms-2" onclick="profileManager.removeSkill('${type}', '${this.escapeHtml(skill)}')"></button>
            </div>
        `).join('');
    }

    renderAvailability() {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const timeSlots = ['morning', 'afternoon', 'evening'];
        
        const availabilityForm = document.getElementById('availabilityForm');
        if (!availabilityForm) {
            console.error('Availability form not found');
            return;
        }

        let availabilityHTML = '';
        
        days.forEach(day => {
            availabilityHTML += `
                <div class="col-md-6 mb-3">
                    <div class="card border-0 shadow-sm">
                        <div class="card-body">
                            <h6 class="card-title text-capitalize fw-bold">${day}</h6>
                            ${timeSlots.map(slot => {
                                const key = `${day}_${slot}`;
                                const isChecked = this.userProfile.availability && this.userProfile.availability[key] === true;
                                return `
                                    <div class="form-check">
                                        <input class="form-check-input availability-checkbox" type="checkbox" 
                                               id="${key}" data-key="${key}" ${isChecked ? 'checked' : ''}>
                                        <label class="form-check-label text-capitalize" for="${key}">
                                            ${slot}
                                        </label>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
        
        availabilityForm.innerHTML = availabilityHTML;
        
        // Initialize availability event listeners
        this.initializeAvailabilityCheckboxes();
    }

    initializeAvailabilityCheckboxes() {
        const checkboxes = document.querySelectorAll('.availability-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const key = e.target.getAttribute('data-key');
                if (!this.userProfile.availability) {
                    this.userProfile.availability = {};
                }
                this.userProfile.availability[key] = e.target.checked;
            });
        });
    }

    initializePhotoUpload() {
        const photoUpload = document.getElementById('photoUpload');
        if (!photoUpload) {
            console.error('Photo upload element not found');
            return;
        }

        photoUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.showToast('Please select an image file', 'error');
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                this.showToast('Image must be smaller than 5MB', 'error');
                return;
            }

            try {
                await this.uploadProfilePhoto(file);
            } catch (error) {
                console.error('Error uploading photo:', error);
                this.showToast('Error uploading photo', 'error');
            }
        });
    }

    initializeEventListeners() {
        // Enter key support for skill inputs
        document.getElementById('newTeachSkill')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTeachSkill();
            }
        });

        document.getElementById('newLearnSkill')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addLearnSkill();
            }
        });

        // Button click handlers
        document.getElementById('newTeachSkill')?.addEventListener('input', this.debounce(() => {
            this.updateSkillSuggestions('teach');
        }, 300));

        document.getElementById('newLearnSkill')?.addEventListener('input', this.debounce(() => {
            this.updateSkillSuggestions('learn');
        }, 300));
    }

    async uploadProfilePhoto(file) {
        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            // Create storage reference
            const storage = firebase.storage();
            const storageRef = storage.ref();
            const fileExtension = file.name.split('.').pop();
            const photoRef = storageRef.child(`profile-photos/${user.uid}/profile.${fileExtension}`);

            // Show loading state
            this.showToast('Uploading profile photo...', 'info');

            // Upload file
            const snapshot = await photoRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();

            // Update profile with new photo URL
            this.userProfile.profilePhoto = downloadURL;
            document.getElementById('profilePhoto').src = downloadURL;

            // Save profile to update photo URL
            await this.saveProfile();

            this.showToast('Profile photo updated successfully', 'success');
        } catch (error) {
            console.error('Error uploading profile photo:', error);
            throw error;
        }
    }

    // Skill management functions
    addTeachSkill() {
        if (!this.userProfile) {
            this.showToast('Profile not loaded. Please try again.', 'error');
            return;
        }

        const input = document.getElementById('newTeachSkill');
        const skill = input.value.trim();
        
        if (!skill) {
            this.showToast('Please enter a skill', 'warning');
            return;
        }

        if (!this.userProfile.skillsToTeach) {
            this.userProfile.skillsToTeach = [];
        }

        if (this.userProfile.skillsToTeach.includes(skill)) {
            this.showToast('Skill already added', 'warning');
            return;
        }

        this.userProfile.skillsToTeach.push(skill);
        this.renderSkillsList('teachSkillsList', this.userProfile.skillsToTeach, 'teach');
        input.value = '';
        input.focus();
    }

    addLearnSkill() {
        if (!this.userProfile) {
            this.showToast('Profile not loaded. Please try again.', 'error');
            return;
        }

        const input = document.getElementById('newLearnSkill');
        const skill = input.value.trim();
        
        if (!skill) {
            this.showToast('Please enter a skill', 'warning');
            return;
        }

        if (!this.userProfile.skillsToLearn) {
            this.userProfile.skillsToLearn = [];
        }

        if (this.userProfile.skillsToLearn.includes(skill)) {
            this.showToast('Skill already added', 'warning');
            return;
        }

        this.userProfile.skillsToLearn.push(skill);
        this.renderSkillsList('learnSkillsList', this.userProfile.skillsToLearn, 'learn');
        input.value = '';
        input.focus();
    }

    removeSkill(type, skill) {
        if (!this.userProfile) {
            this.showToast('Profile not loaded. Please try again.', 'error');
            return;
        }

        const decodedSkill = this.decodeHtml(skill);
        
        if (type === 'teach') {
            this.userProfile.skillsToTeach = this.userProfile.skillsToTeach.filter(s => s !== decodedSkill);
            this.renderSkillsList('teachSkillsList', this.userProfile.skillsToTeach, 'teach');
        } else if (type === 'learn') {
            this.userProfile.skillsToLearn = this.userProfile.skillsToLearn.filter(s => s !== decodedSkill);
            this.renderSkillsList('learnSkillsList', this.userProfile.skillsToLearn, 'learn');
        }
        
        this.showToast('Skill removed', 'info');
    }

    // Form handling
    resetForm() {
        if (confirm('Are you sure you want to reset all changes?')) {
            this.userProfile = JSON.parse(JSON.stringify(this.originalProfile));
            this.populateProfileForm();
            this.showToast('Form reset successfully', 'success');
        }
    }

    async saveProfile() {
        const user = firebase.auth().currentUser;
        if (!user || !this.userProfile) {
            this.showToast('Profile not loaded. Please try again.', 'error');
            return;
        }

        // Validate required fields
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        
        if (!firstName || !lastName) {
            this.showToast('First name and last name are required', 'error');
            return;
        }

        try {
            // Update display name in Firebase Auth
            const displayName = `${firstName} ${lastName}`;
            await user.updateProfile({
                displayName: displayName
            });

            // Update profile data
            this.userProfile.firstName = firstName;
            this.userProfile.lastName = lastName;
            this.userProfile.displayName = displayName;
            this.userProfile.bio = document.getElementById('bio').value.trim();
            this.userProfile.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

            // Collect availability from checkboxes
            this.userProfile.availability = {};
            const availabilityCheckboxes = document.querySelectorAll('#availabilityForm input[type="checkbox"]');
            availabilityCheckboxes.forEach(checkbox => {
                this.userProfile.availability[checkbox.id] = checkbox.checked;
            });

            // Save to Firestore
            await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .update(this.userProfile);

            this.originalProfile = JSON.parse(JSON.stringify(this.userProfile));
            document.getElementById('displayName').textContent = displayName;

            // Update avatar if no custom photo
            if (!this.userProfile.profilePhoto) {
                const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4F46E5&color=fff`;
                document.getElementById('profilePhoto').src = avatarUrl;
            }

            this.showToast('Profile updated successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving profile:', error);
            this.showToast('Error saving profile: ' + error.message, 'error');
        }
    }

    updateSkillSuggestions(type) {
        // This can be enhanced to show skill suggestions from a predefined list
        console.log('Updating suggestions for:', type);
    }

    // Utility functions
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    decodeHtml(html) {
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    }

    debounce(func, wait) {
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

// Initialize profile manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.profileManager = new ProfileManager();
});

// Global functions for HTML onclick handlers
function addTeachSkill() {
    if (window.profileManager) {
        window.profileManager.addTeachSkill();
    }
}

function addLearnSkill() {
    if (window.profileManager) {
        window.profileManager.addLearnSkill();
    }
}

function removeSkill(type, skill) {
    if (window.profileManager) {
        window.profileManager.removeSkill(type, skill);
    }
}

function resetForm() {
    if (window.profileManager) {
        window.profileManager.resetForm();
    }
}

function saveProfile() {
    if (window.profileManager) {
        window.profileManager.saveProfile();
    }
}