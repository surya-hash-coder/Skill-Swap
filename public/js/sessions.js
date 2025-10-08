// Sessions management functionality
class SessionsManager {
    constructor() {
        this.userProfile = null;
        this.potentialPartners = [];
        this.sessions = [];
        this.init();
    }

    async init() {
        console.log('Sessions: Initializing sessions manager...');
        
        try {
            await this.checkAuthentication();
            await this.initializeSessions();
            await this.loadPotentialPartners();
            this.checkUrlParams();
            
            console.log('Sessions: Initialization completed successfully');
        } catch (error) {
            console.error('Error initializing sessions:', error);
            this.handleFirestoreError(error);
        }
    }

    async checkAuthentication() {
        return new Promise((resolve, reject) => {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (!user) {
                    this.showToast('Please log in to access sessions', 'error');
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

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const userId = urlParams.get('userId');
        
        console.log('URL Params - action:', action, 'userId:', userId);
        
        if (action === 'schedule') {
            // Use setTimeout to ensure the DOM is fully ready
            setTimeout(() => {
                this.showScheduleModal(userId);
            }, 500);
        }
    }

    async initializeSessions() {
        try {
            await this.loadUserProfile();
            await this.loadAllSessions();
        } catch (error) {
            console.error('Error initializing sessions:', error);
            throw error;
        }
    }

    async loadUserProfile() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .get();

            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                console.log('User profile loaded for sessions:', this.userProfile);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            throw error;
        }
    }

    async loadAllSessions() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            const sessionsSnapshot = await firebase.firestore()
                .collection('sessions')
                .where('participants', 'array-contains', user.uid)
                .orderBy('startTime', 'desc')
                .get();

            this.sessions = [];
            const now = new Date();

            // Categorize sessions
            const upcoming = [];
            const pending = [];
            const completed = [];
            const cancelled = [];

            for (const doc of sessionsSnapshot.docs) {
                const session = { id: doc.id, ...doc.data() };
                this.sessions.push(session);

                const sessionTime = new Date(session.startTime.seconds * 1000);
                
                // Get other participant's info
                const otherParticipantId = session.participants.find(pid => pid !== user.uid);
                const otherUserDoc = await firebase.firestore()
                    .collection('users')
                    .doc(otherParticipantId)
                    .get();
                session.otherParticipant = otherUserDoc.exists ? otherUserDoc.data() : null;

                if (session.status === 'cancelled') {
                    cancelled.push(session);
                } else if (session.status === 'completed') {
                    completed.push(session);
                } else if (session.status === 'pending') {
                    pending.push(session);
                } else if (sessionTime > now) {
                    upcoming.push(session);
                } else {
                    completed.push(session);
                }
            }

            // Render each category
            this.renderSessionsList('upcomingSessionsList', upcoming, 'upcoming');
            this.renderSessionsList('pendingSessionsList', pending, 'pending');
            this.renderSessionsList('completedSessionsList', completed, 'completed');
            this.renderSessionsList('cancelledSessionsList', cancelled, 'cancelled');

        } catch (error) {
            console.error('Error loading sessions:', error);
            this.showToast('Error loading sessions', 'error');
            throw error;
        }
    }

    renderSessionsList(containerId, sessionsList, type) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (sessionsList.length === 0) {
            let message = '';
            switch (type) {
                case 'upcoming':
                    message = 'No upcoming sessions scheduled';
                    break;
                case 'pending':
                    message = 'No pending session requests';
                    break;
                case 'completed':
                    message = 'No completed sessions yet';
                    break;
                case 'cancelled':
                    message = 'No cancelled sessions';
                    break;
            }

            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-calendar-times text-muted fa-3x mb-3"></i>
                    <p class="text-muted">${message}</p>
                    ${type === 'upcoming' ? `
                        <button class="btn btn-primary mt-2" onclick="sessionsManager.showScheduleModal()">
                            Schedule Your First Session
                        </button>
                    ` : ''}
                </div>
            `;
            return;
        }

        let sessionsHTML = '<div class="row g-4">';
        
        sessionsList.forEach(session => {
            const sessionTime = new Date(session.startTime.seconds * 1000);
            const timeString = sessionTime.toLocaleDateString() + ' ' + sessionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const durationString = `${session.duration} minutes`;
            
            sessionsHTML += `
                <div class="col-md-6 col-lg-4">
                    <div class="session-card session-status-${type} p-3 h-100">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="fw-bold text-truncate">${session.skill}</h6>
                            <span class="badge bg-${this.getStatusBadgeColor(type)}">${type}</span>
                        </div>
                        
                        <div class="mb-3">
                            <p class="text-muted small mb-1">
                                <i class="fas fa-user me-1"></i>
                                ${session.otherParticipant ? session.otherParticipant.displayName : 'User'}
                            </p>
                            <p class="text-muted small mb-1">
                                <i class="fas fa-clock me-1"></i>${timeString}
                            </p>
                            <p class="text-muted small">
                                <i class="fas fa-hourglass me-1"></i>${durationString}
                            </p>
                        </div>

                        <div class="d-flex gap-2 flex-wrap">
                            ${type === 'upcoming' ? `
                                <button class="btn btn-sm btn-primary" onclick="sessionsManager.joinSession('${session.id}')">
                                    <i class="fas fa-video me-1"></i>Join
                                </button>
                                <button class="btn btn-sm btn-outline-secondary" onclick="sessionsManager.viewSessionDetails('${session.id}')">
                                    <i class="fas fa-info me-1"></i>Details
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="sessionsManager.cancelSession('${session.id}')">
                                    <i class="fas fa-times me-1"></i>Cancel
                                </button>
                            ` : ''}
                            
                            ${type === 'pending' ? `
                                <button class="btn btn-sm btn-success" onclick="sessionsManager.acceptSession('${session.id}')">
                                    <i class="fas fa-check me-1"></i>Accept
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="sessionsManager.declineSession('${session.id}')">
                                    <i class="fas fa-times me-1"></i>Decline
                                </button>
                            ` : ''}
                            
                            ${['completed', 'cancelled'].includes(type) ? `
                                <button class="btn btn-sm btn-outline-secondary" onclick="sessionsManager.viewSessionDetails('${session.id}')">
                                    <i class="fas fa-info me-1"></i>Details
                                </button>
                                ${type === 'completed' ? `
                                    <button class="btn btn-sm btn-outline-primary" onclick="sessionsManager.rescheduleSession('${session.id}')">
                                        <i class="fas fa-redo me-1"></i>Reschedule
                                    </button>
                                ` : ''}
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        sessionsHTML += '</div>';
        container.innerHTML = sessionsHTML;
    }

    getStatusBadgeColor(status) {
        const colors = {
            upcoming: 'success',
            pending: 'warning',
            completed: 'info',
            cancelled: 'danger'
        };
        return colors[status] || 'secondary';
    }

    async loadPotentialPartners() {
        const user = firebase.auth().currentUser;
        if (!user || !this.userProfile) return;

        try {
            // Get users who have skills that match what current user wants to learn
            const skillsToLearn = this.userProfile.skillsToLearn || [];
            
            if (skillsToLearn.length === 0) return;

            const usersSnapshot = await firebase.firestore()
                .collection('users')
                .where('skillsToTeach', 'array-contains-any', skillsToLearn)
                .where('uid', '!=', user.uid)
                .limit(20)
                .get();

            this.potentialPartners = [];
            usersSnapshot.forEach(doc => {
                this.potentialPartners.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('Loaded potential partners:', this.potentialPartners.length);
        } catch (error) {
            console.error('Error loading potential partners:', error);
        }
    }

    showScheduleModal(preSelectedUserId = null) {
        console.log('Showing schedule modal for user:', preSelectedUserId);
        
        const modalElement = document.getElementById('scheduleModal');
        if (!modalElement) {
            console.error('Schedule modal element not found');
            return;
        }

        const modal = new bootstrap.Modal(modalElement);
        
        // Populate skills dropdown
        const skillsSelect = document.getElementById('sessionSkill');
        const skillsToTeach = this.userProfile?.skillsToTeach || [];
        
        skillsSelect.innerHTML = '<option value="">Select a skill...</option>';
        skillsToTeach.forEach(skill => {
            skillsSelect.innerHTML += `<option value="${skill}">${skill}</option>`;
        });

        // Populate partners dropdown
        const partnersSelect = document.getElementById('sessionPartner');
        partnersSelect.innerHTML = '<option value="">Select a partner...</option>';
        this.potentialPartners.forEach(partner => {
            const selected = preSelectedUserId === partner.id ? 'selected' : '';
            partnersSelect.innerHTML += `<option value="${partner.id}" ${selected}>${partner.displayName}</option>`;
        });

        // Set minimum date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('sessionDate').min = today;

        // Set default time to next hour
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1);
        nextHour.setMinutes(0);
        document.getElementById('sessionTime').value = nextHour.toTimeString().substring(0, 5);

        modal.show();
    }

    async scheduleSession() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const skill = document.getElementById('sessionSkill').value;
        const partnerId = document.getElementById('sessionPartner').value;
        const date = document.getElementById('sessionDate').value;
        const time = document.getElementById('sessionTime').value;
        const duration = document.getElementById('sessionDuration').value;
        const notes = document.getElementById('sessionNotes').value;

        console.log('Scheduling session with:', { skill, partnerId, date, time, duration, notes });

        // Validation
        if (!skill || !partnerId || !date || !time || !duration) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        const sessionDateTime = new Date(`${date}T${time}`);
        if (sessionDateTime <= new Date()) {
            this.showToast('Session must be scheduled for a future time', 'error');
            return;
        }

        try {
            // Generate unique room ID for Jitsi
            const roomId = `SkillSwapRoom${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
            const meetingLink = `https://meet.jit.si/${roomId}`;

            const sessionData = {
                skill: skill,
                participants: [user.uid, partnerId],
                startTime: firebase.firestore.Timestamp.fromDate(sessionDateTime),
                duration: parseInt(duration),
                notes: notes,
                meetingLink: meetingLink,
                status: 'pending',
                createdBy: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                reminderSent: false
            };

            await firebase.firestore()
                .collection('sessions')
                .add(sessionData);

            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('scheduleModal'));
            modal.hide();
            document.getElementById('scheduleForm').reset();

            this.showToast('Session scheduled successfully! Waiting for partner confirmation.', 'success');
            
            // Reload sessions
            await this.loadAllSessions();

        } catch (error) {
            console.error('Error scheduling session:', error);
            this.showToast('Error scheduling session: ' + error.message, 'error');
        }
    }

    async viewSessionDetails(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        const sessionTime = new Date(session.startTime.seconds * 1000);
        const timeString = sessionTime.toLocaleDateString() + ' ' + sessionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const detailsContent = document.getElementById('sessionDetailsContent');
        detailsContent.innerHTML = `
            <div class="mb-3">
                <strong>Skill:</strong> ${session.skill}
            </div>
            <div class="mb-3">
                <strong>Partner:</strong> ${session.otherParticipant ? session.otherParticipant.displayName : 'User'}
            </div>
            <div class="mb-3">
                <strong>Date & Time:</strong> ${timeString}
            </div>
            <div class="mb-3">
                <strong>Duration:</strong> ${session.duration} minutes
            </div>
            <div class="mb-3">
                <strong>Status:</strong> <span class="badge bg-${this.getStatusBadgeColor(session.status)}">${session.status}</span>
            </div>
            ${session.notes ? `
                <div class="mb-3">
                    <strong>Notes:</strong>
                    <p class="mt-1">${session.notes}</p>
                </div>
            ` : ''}
            ${session.meetingLink ? `
                <div class="mb-3">
                    <strong>Meeting Link:</strong>
                    <div class="input-group mt-1">
                        <input type="text" class="form-control" value="${session.meetingLink}" readonly>
                        <button class="btn btn-outline-primary" type="button" onclick="sessionsManager.copyToClipboard('${session.meetingLink}')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            ` : ''}
        `;

        const modal = new bootstrap.Modal(document.getElementById('sessionDetailsModal'));
        modal.show();
    }

    async joinSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        // Open Jitsi meeting in new tab
        window.open(session.meetingLink, '_blank');
        
        // Update session status to active if it's upcoming
        if (session.status === 'upcoming') {
            try {
                await firebase.firestore()
                    .collection('sessions')
                    .doc(sessionId)
                    .update({
                        status: 'active',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                
                // Reload sessions
                await this.loadAllSessions();
            } catch (error) {
                console.error('Error updating session status:', error);
            }
        }
    }

    async cancelSession(sessionId) {
        if (!confirm('Are you sure you want to cancel this session?')) return;

        try {
            await firebase.firestore()
                .collection('sessions')
                .doc(sessionId)
                .update({
                    status: 'cancelled',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            this.showToast('Session cancelled successfully', 'success');
            await this.loadAllSessions();
        } catch (error) {
            console.error('Error cancelling session:', error);
            this.showToast('Error cancelling session', 'error');
        }
    }

    async acceptSession(sessionId) {
        try {
            await firebase.firestore()
                .collection('sessions')
                .doc(sessionId)
                .update({
                    status: 'upcoming',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            this.showToast('Session accepted successfully', 'success');
            await this.loadAllSessions();
        } catch (error) {
            console.error('Error accepting session:', error);
            this.showToast('Error accepting session', 'error');
        }
    }

    async declineSession(sessionId) {
        if (!confirm('Are you sure you want to decline this session?')) return;

        try {
            await firebase.firestore()
                .collection('sessions')
                .doc(sessionId)
                .update({
                    status: 'cancelled',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            this.showToast('Session declined', 'success');
            await this.loadAllSessions();
        } catch (error) {
            console.error('Error declining session:', error);
            this.showToast('Error declining session', 'error');
        }
    }

    async rescheduleSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        // Pre-fill the schedule modal with session details
        this.showScheduleModal();
        
        // Set the form values
        setTimeout(() => {
            document.getElementById('sessionSkill').value = session.skill;
            
            const otherParticipantId = session.participants.find(pid => pid !== firebase.auth().currentUser.uid);
            document.getElementById('sessionPartner').value = otherParticipantId;
            
            // Set date and time from the session
            const sessionTime = new Date(session.startTime.seconds * 1000);
            document.getElementById('sessionDate').value = sessionTime.toISOString().split('T')[0];
            document.getElementById('sessionTime').value = sessionTime.toTimeString().substring(0, 5);
            
            document.getElementById('sessionDuration').value = session.duration;
            document.getElementById('sessionNotes').value = session.notes || '';
        }, 500);
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Meeting link copied to clipboard', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('Meeting link copied to clipboard', 'success');
        });
    }

    handleFirestoreError(error) {
        console.error('Firestore Error:', error);
        
        if (error.code === 'permission-denied') {
            this.showToast('Permission denied. Please check security rules.', 'error');
        } else if (error.code === 'unauthenticated') {
            this.showToast('Please log in to access this feature', 'error');
            window.location.href = 'auth.html';
        } else {
            this.showToast('Error loading data. Please try again.', 'error');
        }
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

// Initialize sessions manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.sessionsManager = new SessionsManager();
});

// Global functions for HTML onclick handlers
function showScheduleModal() {
    if (window.sessionsManager) {
        window.sessionsManager.showScheduleModal();
    }
}

function scheduleSession() {
    if (window.sessionsManager) {
        window.sessionsManager.scheduleSession();
    }
}

function viewSessionDetails(sessionId) {
    if (window.sessionsManager) {
        window.sessionsManager.viewSessionDetails(sessionId);
    }
}

function joinSession(sessionId) {
    if (window.sessionsManager) {
        window.sessionsManager.joinSession(sessionId);
    }
}

function cancelSession(sessionId) {
    if (window.sessionsManager) {
        window.sessionsManager.cancelSession(sessionId);
    }
}

function acceptSession(sessionId) {
    if (window.sessionsManager) {
        window.sessionsManager.acceptSession(sessionId);
    }
}

function declineSession(sessionId) {
    if (window.sessionsManager) {
        window.sessionsManager.declineSession(sessionId);
    }
}

function rescheduleSession(sessionId) {
    if (window.sessionsManager) {
        window.sessionsManager.rescheduleSession(sessionId);
    }
}

function copyToClipboard(text) {
    if (window.sessionsManager) {
        window.sessionsManager.copyToClipboard(text);
    }
}