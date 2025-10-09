// Dashboard functionality
let userProfile = null;
let sessions = [];
let users = [];

document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard: DOM loaded');
    
    // Check authentication first
    firebase.auth().onAuthStateChanged((user) => {
        console.log('Dashboard: Auth state changed', user ? 'User logged in' : 'User logged out');
        
        if (!user) {
            console.log('No user, redirecting to auth');
            window.location.href = 'auth.html';
            return;
        }
        
        console.log('User authenticated:', user.uid, user.email);
        
        if (!user.emailVerified) {
            showToast('Please verify your email address', 'warning');
        }
        
        initializeDashboard();
    });
});

async function initializeDashboard() {
    console.log('Dashboard: Initializing dashboard...');
    
    try {
        await loadUserProfile();
        
        // Check if user is new to customize their experience
        const isNewUser = await checkIfNewUser(firebase.auth().currentUser.uid);
        
        if (isNewUser) {
            // For new users, focus on profile completion and guidance
            await loadSuggestedMatches(); // Still show potential matches
            updateStats();
            
            // Customize the empty state messages for new users
            customizeForNewUser();
        } else {
            // For returning users, load everything normally
            await loadUpcomingSessions();
            await loadSuggestedMatches();
            await loadRecentActivity();
            updateStats();
        }
        
        console.log('Dashboard: Initialization completed successfully');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        handleFirestoreError(error);
    }
}

async function loadUserProfile() {
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('No authenticated user');
        return;
    }

    console.log('Loading user profile for:', user.uid);
    
    try {
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .get();

        console.log('User profile document exists:', userDoc.exists);

        if (userDoc.exists) {
            userProfile = userDoc.data();
            console.log('User profile loaded:', userProfile);
            
            // Check if user is new (no sessions and minimal profile)
            const isNewUser = await checkIfNewUser(user.uid);
            
            if (isNewUser) {
                document.getElementById('userName').textContent = 'Welcome!';
                showNewUserWelcome();
            } else {
                document.getElementById('userName').textContent = `Welcome back, ${userProfile.displayName || 'User'}!`;
            }
        } else {
            console.log('User profile does not exist, creating...');
            // Create user profile if it doesn't exist
            await createUserProfile(user);
            
            // New user - show welcome message
            document.getElementById('userName').textContent = 'Welcome!';
            showNewUserWelcome();
            
            await loadUserProfile(); // Reload
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        if (error.code === 'permission-denied') {
            showToast('Database permissions not set up yet. Please contact administrator.', 'error');
        }
        throw error;
    }
}

// Check if user is new
async function checkIfNewUser(userId) {
    try {
        // Check if user has any sessions
        const sessionsSnapshot = await firebase.firestore()
            .collection('sessions')
            .where('participants', 'array-contains', userId)
            .limit(1)
            .get();

        const hasSessions = !sessionsSnapshot.empty;
        
        // Check if user has completed their profile (has skills added)
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(userId)
            .get();
            
        if (userDoc.exists) {
            const userData = userDoc.data();
            const hasSkills = (userData.skillsToTeach && userData.skillsToTeach.length > 0) || 
                             (userData.skillsToLearn && userData.skillsToLearn.length > 0);
            
            // User is considered new if they have no sessions and minimal profile
            return !hasSessions && !hasSkills;
        }
        
        return true; // If we can't determine, assume new user
        
    } catch (error) {
        console.error('Error checking if user is new:', error);
        return true; // Assume new user if there's an error
    }
}

// Show new user welcome
function showNewUserWelcome() {
    // Update the dashboard header for new users
    const dashboardHeader = document.querySelector('.dashboard-header');
    if (dashboardHeader) {
        const subtitle = dashboardHeader.querySelector('p.lead');
        if (subtitle) {
            subtitle.textContent = "Let's set up your profile and find your first skill match!";
            subtitle.style.fontSize = '1.1rem';
            subtitle.style.fontWeight = '500';
        }
    }
    
    // Show a welcome toast
    showToast('🎉 Welcome to SkillSwap! Complete your profile to get started.', 'success');
    
    // Show new user guide
    setTimeout(() => {
        showNewUserGuide();
    }, 2000);
}

// Show new user guide modal
function showNewUserGuide() {
    // Check if we've shown the guide before
    const hasSeenGuide = localStorage.getItem('hasSeenSkillSwapGuide');
    
    if (!hasSeenGuide) {
        const guideHTML = `
            <div class="modal fade" id="newUserGuideModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">🎉 Welcome to SkillSwap!</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row text-center">
                                <div class="col-md-4 mb-4">
                                    <div class="feature-icon bg-primary text-white rounded-circle mx-auto mb-3" style="width: 70px; height: 70px; display: flex; align-items: center; justify-content: center;">
                                        <i class="fas fa-user-edit fa-lg"></i>
                                    </div>
                                    <h6>Complete Your Profile</h6>
                                    <p class="text-muted small">Add skills you can teach and want to learn</p>
                                </div>
                                <div class="col-md-4 mb-4">
                                    <div class="feature-icon bg-success text-white rounded-circle mx-auto mb-3" style="width: 70px; height: 70px; display: flex; align-items: center; justify-content: center;">
                                        <i class="fas fa-search fa-lg"></i>
                                    </div>
                                    <h6>Find Matches</h6>
                                    <p class="text-muted small">Discover users with complementary skills</p>
                                </div>
                                <div class="col-md-4 mb-4">
                                    <div class="feature-icon bg-warning text-white rounded-circle mx-auto mb-3" style="width: 70px; height: 70px; display: flex; align-items: center; justify-content: center;">
                                        <i class="fas fa-video fa-lg"></i>
                                    </div>
                                    <h6>Start Learning</h6>
                                    <p class="text-muted small">Schedule sessions and begin your journey</p>
                                </div>
                            </div>
                            <div class="text-center mt-4">
                                <a href="profile.html" class="btn btn-primary btn-lg">
                                    <i class="fas fa-user-edit me-2"></i>Complete Your Profile
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', guideHTML);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('newUserGuideModal'));
        modal.show();
        
        // Mark as seen
        localStorage.setItem('hasSeenSkillSwapGuide', 'true');
        
        // Remove modal from DOM after hiding
        document.getElementById('newUserGuideModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
}

// Customize dashboard for new users
function customizeForNewUser() {
    // Update empty states with more encouraging messages
    const upcomingSessionsList = document.getElementById('upcomingSessionsList');
    if (upcomingSessionsList) {
        upcomingSessionsList.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-calendar-plus text-primary fa-3x mb-3"></i>
                <h5 class="text-muted">Schedule Your First Session</h5>
                <p class="text-muted small mb-3">Start your skill-sharing journey by booking your first session</p>
                <button class="btn btn-primary mt-2" onclick="location.href='sessions.html?action=schedule'">
                    <i class="fas fa-plus me-2"></i>Schedule Session
                </button>
            </div>
        `;
    }
    
    const recentActivityList = document.getElementById('recentActivityList');
    if (recentActivityList) {
        recentActivityList.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-star text-warning fa-2x mb-3"></i>
                <h6 class="text-muted">Your Journey Starts Here</h6>
                <p class="text-muted small">Complete your profile and schedule sessions to see your activity here</p>
            </div>
        `;
    }
}

async function createUserProfile(user) {
    console.log('Creating user profile for:', user.uid);
    
    try {
        const userData = {
            uid: user.uid,
            firstName: user.displayName?.split(' ')[0] || 'User',
            lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
            displayName: user.displayName || 'User',
            email: user.email,
            bio: '',
            skillsToTeach: ['Web Development', 'JavaScript', 'HTML/CSS'], // Default skills
            skillsToLearn: ['Graphic Design', 'Digital Marketing', 'Data Analysis'], // Default skills to learn
            availability: {
                monday_morning: true,
                wednesday_afternoon: true,
                friday_evening: true
            },
            profilePhoto: user.photoURL || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .set(userData);
            
        console.log('User profile created successfully');
        showToast('Profile created successfully!', 'success');
    } catch (error) {
        console.error('Error creating user profile:', error);
        showToast('Error creating profile: ' + error.message, 'error');
        throw error;
    }
}

async function loadUpcomingSessions() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    console.log('Loading upcoming sessions for user:', user.uid);
    
    try {
        const now = new Date();
        const sessionsSnapshot = await firebase.firestore()
            .collection('sessions')
            .where('participants', 'array-contains', user.uid)
            .where('startTime', '>=', now)
            .orderBy('startTime', 'asc')
            .limit(5)
            .get();

        console.log('Sessions query completed, found:', sessionsSnapshot.size, 'sessions');
        
        sessions = [];
        const sessionsList = document.getElementById('upcomingSessionsList');
        
        if (sessionsSnapshot.empty) {
            console.log('No upcoming sessions found');
            sessionsList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-calendar-times text-muted fa-3x mb-3"></i>
                    <p class="text-muted">No upcoming sessions</p>
                    <button class="btn btn-primary mt-2" onclick="location.href='sessions.html?action=schedule'">
                        Schedule Your First Session
                    </button>
                </div>
            `;
            return;
        }

        let sessionsHTML = '';
        let sessionLoadPromises = [];

        for (const doc of sessionsSnapshot.docs) {
            const session = { id: doc.id, ...doc.data() };
            sessions.push(session);

            // Get other participant's name
            const otherParticipantId = session.participants.find(pid => pid !== user.uid);
            
            // Create promise for loading user data
            const userPromise = firebase.firestore()
                .collection('users')
                .doc(otherParticipantId)
                .get()
                .then(otherUserDoc => {
                    return otherUserDoc.exists ? otherUserDoc.data().displayName : 'User';
                })
                .catch(error => {
                    console.warn('Could not load user data for:', otherParticipantId, error);
                    return 'User';
                });

            sessionLoadPromises.push(userPromise.then(otherUserName => {
                const sessionTime = new Date(session.startTime.seconds * 1000);
                const timeString = sessionTime.toLocaleDateString() + ' ' + sessionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                sessionsHTML += `
                    <div class="session-card session-status-upcoming p-3 mb-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="fw-bold mb-1">${session.skill}</h6>
                                <p class="text-muted mb-1">With ${otherUserName}</p>
                                <small class="text-muted">
                                    <i class="fas fa-clock me-1"></i>${timeString}
                                </small>
                            </div>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <ul class="dropdown-menu">
                                    <li><a class="dropdown-item" href="#" onclick="joinSession('${session.id}')">
                                        <i class="fas fa-video me-2"></i>Join Session
                                    </a></li>
                                    <li><a class="dropdown-item" href="chat.html?userId=${otherParticipantId}">
                                        <i class="fas fa-comment me-2"></i>Message
                                    </a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger" href="#" onclick="cancelSession('${session.id}')">
                                        <i class="fas fa-times me-2"></i>Cancel
                                    </a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
            }));
        }

        // Wait for all user data to load
        await Promise.all(sessionLoadPromises);
        sessionsList.innerHTML = sessionsHTML;
        
        console.log('Sessions loaded successfully');

    } catch (error) {
        console.error('Error loading sessions:', error);
        document.getElementById('upcomingSessionsList').innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-exclamation-triangle text-warning fa-2x mb-3"></i>
                <p class="text-muted">Unable to load sessions</p>
                <p class="text-muted small">${getErrorMessage(error)}</p>
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="location.reload()">
                    <i class="fas fa-redo me-1"></i>Retry
                </button>
            </div>
        `;
        throw error;
    }
}

async function loadSuggestedMatches() {
    const user = firebase.auth().currentUser;
    if (!user || !userProfile) {
        console.log('User not authenticated or profile not loaded');
        return;
    }

    console.log('Loading suggested matches for user:', user.uid);
    
    try {
        const matchesList = document.getElementById('suggestedMatchesList');
        
        // Get users who have skills that match what current user wants to learn
        const skillsToLearn = userProfile.skillsToLearn || [];
        
        console.log('Skills to learn:', skillsToLearn);
        
        if (skillsToLearn.length === 0) {
            matchesList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-search text-muted fa-3x mb-3"></i>
                    <p class="text-muted">Add skills you want to learn to see matches</p>
                    <button class="btn btn-primary mt-2" onclick="location.href='profile.html'">
                        Update Profile
                    </button>
                </div>
            `;
            return;
        }

        // Query for users who can teach skills the current user wants to learn
        const usersSnapshot = await firebase.firestore()
            .collection('users')
            .where('skillsToTeach', 'array-contains-any', skillsToLearn)
            .where('uid', '!=', user.uid)
            .limit(6)
            .get();

        console.log('Matches query completed, found:', usersSnapshot.size, 'potential matches');
        
        users = [];
        let matchesHTML = '';

        if (usersSnapshot.empty) {
            matchesList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-users-slash text-muted fa-3x mb-3"></i>
                    <p class="text-muted">No matches found. Try adding more skills!</p>
                </div>
            `;
            return;
        }

        for (const doc of usersSnapshot.docs) {
            const userData = { id: doc.id, ...doc.data() };
            users.push(userData);

            const commonSkills = userData.skillsToTeach.filter(skill => 
                skillsToLearn.includes(skill)
            ).slice(0, 3);

            matchesHTML += `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex align-items-start">
                            <img src="${userData.profilePhoto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userData.displayName) + '&background=4F46E5&color=fff'}" 
                                 alt="${userData.displayName}" 
                                 class="rounded-circle me-3" 
                                 width="50" 
                                 height="50">
                            <div class="flex-grow-1">
                                <h6 class="fw-bold mb-1">${userData.displayName}</h6>
                                <p class="text-muted small mb-2">${userData.bio || 'No bio provided'}</p>
                                <div class="mb-2">
                                    ${commonSkills.map(skill => `
                                        <span class="badge bg-primary me-1 mb-1">${skill}</span>
                                    `).join('')}
                                </div>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-sm btn-outline-primary" onclick="scheduleSession('${userData.id}')">
                                        <i class="fas fa-calendar-plus me-1"></i>Schedule
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="openChat('${userData.id}')">
                                        <i class="fas fa-comment me-1"></i>Message
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        matchesList.innerHTML = matchesHTML;

        // Add search functionality
        const searchInput = document.getElementById('searchSkills');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(function(e) {
                filterMatches(e.target.value);
            }, 300));
        }

        console.log('Matches loaded successfully');

    } catch (error) {
        console.error('Error loading matches:', error);
        document.getElementById('suggestedMatchesList').innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-exclamation-triangle text-warning fa-2x mb-3"></i>
                <p class="text-muted">Unable to load matches</p>
                <p class="text-muted small">${getErrorMessage(error)}</p>
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="location.reload()">
                    <i class="fas fa-redo me-1"></i>Retry
                </button>
            </div>
        `;
        throw error;
    }
}

async function loadRecentActivity() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    console.log('Loading recent activity for user:', user.uid);
    
    try {
        // Get recent sessions (completed and upcoming)
        const sessionsSnapshot = await firebase.firestore()
            .collection('sessions')
            .where('participants', 'array-contains', user.uid)
            .orderBy('startTime', 'desc')
            .limit(10)
            .get();

        console.log('Recent activity query completed, found:', sessionsSnapshot.size, 'sessions');
        
        const activityList = document.getElementById('recentActivityList');
        let activityHTML = '';

        if (sessionsSnapshot.empty) {
            activityHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-history text-muted fa-2x mb-3"></i>
                    <p class="text-muted">No recent activity</p>
                    <p class="text-muted small">Schedule your first session to get started!</p>
                </div>
            `;
        } else {
            for (const doc of sessionsSnapshot.docs) {
                const session = doc.data();
                const sessionTime = new Date(session.startTime.seconds * 1000);
                const timeAgo = getTimeAgo(sessionTime);
                
                // Get other participant
                const otherParticipantId = session.participants.find(pid => pid !== user.uid);
                let otherUserName = 'User';
                
                try {
                    const otherUserDoc = await firebase.firestore()
                        .collection('users')
                        .doc(otherParticipantId)
                        .get();
                    otherUserName = otherUserDoc.exists ? otherUserDoc.data().displayName : 'User';
                } catch (error) {
                    console.warn('Could not load user data for recent activity:', otherParticipantId);
                }

                const isUpcoming = sessionTime > new Date();
                
                activityHTML += `
                    <div class="d-flex align-items-center py-2 border-bottom">
                        <div class="flex-shrink-0">
                            <div class="rounded-circle bg-light d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                <i class="fas ${isUpcoming ? 'fa-clock text-warning' : 'fa-check-circle text-success'}"></i>
                            </div>
                        </div>
                        <div class="flex-grow-1 ms-3">
                            <p class="mb-1">
                                ${isUpcoming ? 'Upcoming' : 'Completed'} session for <strong>${session.skill}</strong> with ${otherUserName}
                            </p>
                            <small class="text-muted">${timeAgo}</small>
                        </div>
                    </div>
                `;
            }
        }

        activityList.innerHTML = activityHTML;
        console.log('Recent activity loaded successfully');
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
        throw error;
    }
}

function handleFirestoreError(error) {
    console.error('Firestore Error Details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
    });
    
    const errorMessage = getErrorMessage(error);
    showToast(errorMessage, 'error');
    
    // Show detailed error in console for debugging
    if (error.code === 'permission-denied') {
        console.error('PERMISSION DENIED - Please check:');
        console.error('1. Firestore Rules in Firebase Console');
        console.error('2. User authentication status');
        console.error('3. Collection/document permissions');
    }
}

function getErrorMessage(error) {
    switch (error.code) {
        case 'permission-denied':
            return 'Database permission denied. Please check security rules.';
        case 'unauthenticated':
            return 'Please log in to access this feature.';
        case 'not-found':
            return 'Data not found.';
        case 'already-exists':
            return 'Data already exists.';
        case 'resource-exhausted':
            return 'Quota exceeded. Please try again later.';
        case 'failed-precondition':
            return 'Operation failed. Please try again.';
        case 'aborted':
            return 'Operation was cancelled.';
        case 'out-of-range':
            return 'Invalid operation.';
        case 'unimplemented':
            return 'Feature not available.';
        case 'internal':
            return 'Internal error occurred.';
        case 'unavailable':
            return 'Service unavailable. Please try again later.';
        case 'data-loss':
            return 'Data error occurred.';
        default:
            return 'An unexpected error occurred. Please try again.';
    }
}

function updateStats() {
    if (!userProfile) return;

    console.log('Updating dashboard stats');
    
    // Update stats cards
    document.getElementById('skillsTeachingCount').textContent = (userProfile.skillsToTeach || []).length;
    document.getElementById('skillsLearningCount').textContent = (userProfile.skillsToLearn || []).length;
    document.getElementById('upcomingSessionsCount').textContent = sessions.length;
    
    // For connections count, we'd need to query chats or sessions
    // This is a simplified version
    document.getElementById('connectionsCount').textContent = sessions.length > 0 ? sessions.length * 2 : 0;
}

function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

// Action functions
function scheduleSession(userId) {
    window.location.href = `sessions.html?action=schedule&userId=${userId}`;
}

function openChat(userId) {
    window.location.href = `chat.html?userId=${userId}`;
}

async function joinSession(sessionId) {
    try {
        const sessionDoc = await firebase.firestore()
            .collection('sessions')
            .doc(sessionId)
            .get();
        
        if (sessionDoc.exists) {
            const session = sessionDoc.data();
            // Open Jitsi meeting in new tab
            window.open(session.meetingLink, '_blank');
        }
    } catch (error) {
        console.error('Error joining session:', error);
        showToast('Error joining session', 'error');
    }
}

async function cancelSession(sessionId) {
    if (!confirm('Are you sure you want to cancel this session?')) return;

    try {
        await firebase.firestore()
            .collection('sessions')
            .doc(sessionId)
            .update({
                status: 'cancelled',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        showToast('Session cancelled successfully', 'success');
        // Reload sessions
        await loadUpcomingSessions();
        updateStats();
    } catch (error) {
        console.error('Error cancelling session:', error);
        showToast('Error cancelling session', 'error');
    }
}

function filterMatches(searchTerm) {
    if (!users || users.length === 0) return;

    const filteredUsers = users.filter(user => 
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.skillsToTeach && user.skillsToTeach.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (user.bio && user.bio.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const matchesList = document.getElementById('suggestedMatchesList');
    
    if (filteredUsers.length === 0) {
        matchesList.innerHTML = '<p class="text-muted text-center py-3">No matches found</p>';
        return;
    }

    // Re-render filtered users
    let matchesHTML = '';
    const skillsToLearn = userProfile.skillsToLearn || [];

    filteredUsers.forEach(userData => {
        const commonSkills = userData.skillsToTeach.filter(skill => 
            skillsToLearn.includes(skill)
        ).slice(0, 3);

        matchesHTML += `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex align-items-start">
                        <img src="${userData.profilePhoto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userData.displayName) + '&background=4F46E5&color=fff'}" 
                             alt="${userData.displayName}" 
                             class="rounded-circle me-3" 
                             width="50" 
                             height="50">
                        <div class="flex-grow-1">
                            <h6 class="fw-bold mb-1">${userData.displayName}</h6>
                            <p class="text-muted small mb-2">${userData.bio || 'No bio provided'}</p>
                            <div class="mb-2">
                                ${commonSkills.map(skill => `
                                    <span class="badge bg-primary me-1 mb-1">${skill}</span>
                                `).join('')}
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-outline-primary" onclick="scheduleSession('${userData.id}')">
                                    <i class="fas fa-calendar-plus me-1"></i>Schedule
                                </button>
                                <button class="btn btn-sm btn-outline-secondary" onclick="openChat('${userData.id}')">
                                    <i class="fas fa-comment me-1"></i>Message
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    matchesList.innerHTML = matchesHTML;
}

// Make sure these utility functions are available
if (typeof showToast === 'undefined') {
    function showToast(message, type = 'success') {
        console.log(`Toast [${type}]: ${message}`);
        // Fallback if main.js toast is not available
        alert(`${type.toUpperCase()}: ${message}`);
    }
}

if (typeof debounce === 'undefined') {
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
}
