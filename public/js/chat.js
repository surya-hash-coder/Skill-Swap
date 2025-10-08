// Real-time chat functionality - Fixed variable naming conflicts
class ChatManager {
    constructor() {
        this.currentChatUser = null;
        this.conversations = [];
        this.currentChatId = null;
        this.unsubscribeMessages = null;
        this.init();
    }

    async init() {
        console.log('Chat: Initializing chat manager...');
        
        try {
            await this.checkAuthentication();
            await this.loadConversations();
            this.setupRealTimeListeners();
            this.checkUrlParams();
            
            console.log('Chat: Initialization completed successfully');
        } catch (error) {
            console.error('Error initializing chat:', error);
            this.showToast('Error loading messages', 'error');
        }
    }

    async checkAuthentication() {
        return new Promise((resolve, reject) => {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (!user) {
                    this.showToast('Please log in to access messages', 'error');
                    setTimeout(() => {
                        window.location.href = 'auth.html';
                    }, 2000);
                    reject(new Error('User not authenticated'));
                    return;
                }
                
                this.currentChatUser = user;
                resolve(user);
            });
        });
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId');
        
        if (userId) {
            this.startChatWithUser(userId);
        }
    }

    async loadConversations() {
        if (!this.currentChatUser) return;

        try {
            console.log('Loading conversations for user:', this.currentChatUser.uid);
            
            // Get all sessions where current user is a participant
            const sessionsSnapshot = await firebase.firestore()
                .collection('sessions')
                .where('participants', 'array-contains', this.currentChatUser.uid)
                .get();

            this.conversations = [];
            const uniqueUserIds = new Set();

            for (const doc of sessionsSnapshot.docs) {
                const session = doc.data();
                const otherParticipantId = session.participants.find(pid => pid !== this.currentChatUser.uid);
                
                if (otherParticipantId && !uniqueUserIds.has(otherParticipantId)) {
                    uniqueUserIds.add(otherParticipantId);
                    
                    // Get user details
                    const userDoc = await firebase.firestore()
                        .collection('users')
                        .doc(otherParticipantId)
                        .get();
                    
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        
                        // Get last message for this conversation
                        const chatId = this.generateChatId(this.currentChatUser.uid, otherParticipantId);
                        const lastMessage = await this.getLastMessage(chatId);
                        
                        this.conversations.push({
                            userId: otherParticipantId,
                            userData: userData,
                            lastMessage: lastMessage,
                            chatId: chatId,
                            unread: await this.getUnreadCount(chatId)
                        });
                    }
                }
            }

            this.renderConversationsList();
            
        } catch (error) {
            console.error('Error loading conversations:', error);
            throw error;
        }
    }

    generateChatId(userId1, userId2) {
        // Generate consistent chat ID regardless of user order
        return [userId1, userId2].sort().join('_');
    }

    async getLastMessage(chatId) {
        try {
            const messagesSnapshot = await firebase.firestore()
                .collection('chats')
                .doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            if (!messagesSnapshot.empty) {
                return messagesSnapshot.docs[0].data();
            }
            return null;
        } catch (error) {
            console.error('Error getting last message:', error);
            return null;
        }
    }

    async getUnreadCount(chatId) {
        if (!this.currentChatUser) return 0;

        try {
            const unreadSnapshot = await firebase.firestore()
                .collection('chats')
                .doc(chatId)
                .collection('messages')
                .where('read', '==', false)
                .where('senderId', '!=', this.currentChatUser.uid)
                .get();

            return unreadSnapshot.size;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    renderConversationsList() {
        const conversationsList = document.getElementById('conversationsList');
        if (!conversationsList) return;

        if (this.conversations.length === 0) {
            conversationsList.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-comments text-muted fa-2x mb-3"></i>
                    <p class="text-muted">No conversations yet</p>
                    <p class="text-muted small">Start by scheduling a session with someone!</p>
                </div>
            `;
            return;
        }

        // Sort conversations by last message timestamp
        this.conversations.sort((a, b) => {
            const timeA = a.lastMessage?.timestamp?.seconds || 0;
            const timeB = b.lastMessage?.timestamp?.seconds || 0;
            return timeB - timeA;
        });

        let conversationsHTML = '';
        
        this.conversations.forEach(conversation => {
            const lastMessage = conversation.lastMessage;
            const lastMessageText = lastMessage ? 
                (lastMessage.text.length > 30 ? lastMessage.text.substring(0, 30) + '...' : lastMessage.text) : 
                'No messages yet';
            
            const lastMessageTime = lastMessage ? 
                this.formatMessageTime(new Date(lastMessage.timestamp.seconds * 1000)) : 
                '';
            
            const unreadBadge = conversation.unread > 0 ? 
                `<span class="badge bg-primary rounded-pill">${conversation.unread}</span>` : 
                '';

            conversationsHTML += `
                <div class="conversation-item p-3 border-bottom ${this.currentChatId === conversation.chatId ? 'bg-light' : ''}" 
                     onclick="chatManager.openChat('${conversation.chatId}', '${conversation.userId}')"
                     style="cursor: pointer;">
                    <div class="d-flex align-items-center">
                        <img src="${conversation.userData.profilePhoto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(conversation.userData.displayName) + '&background=4F46E5&color=fff'}" 
                             alt="${conversation.userData.displayName}" 
                             class="rounded-circle me-3" 
                             width="45" 
                             height="45">
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="fw-bold mb-1">${conversation.userData.displayName}</h6>
                                ${unreadBadge}
                            </div>
                            <p class="text-muted small mb-1">${lastMessageText}</p>
                            <small class="text-muted">${lastMessageTime}</small>
                        </div>
                    </div>
                </div>
            `;
        });

        conversationsList.innerHTML = conversationsHTML;
    }

    formatMessageTime(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        return date.toLocaleDateString();
    }

    async openChat(chatId, userId) {
        this.currentChatId = chatId;
        
        // Update UI to show active conversation
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('bg-light');
        });
        event.currentTarget.classList.add('bg-light');

        // Load user data for chat header
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(userId)
            .get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            this.displayChatHeader(userData);
        }

        // Enable message input
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendMessageBtn').disabled = false;

        // Load messages
        this.loadMessages(chatId);

        // Mark messages as read
        await this.markMessagesAsRead(chatId);

        // Update unread count in conversations list
        await this.updateConversationUnreadCount(chatId);
    }

    displayChatHeader(userData) {
        const chatHeader = document.getElementById('chatHeader');
        chatHeader.innerHTML = `
            <img src="${userData.profilePhoto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userData.displayName) + '&background=4F46E5&color=fff'}" 
                 alt="${userData.displayName}" 
                 class="rounded-circle me-3" 
                 width="45" 
                 height="45">
            <div>
                <h6 class="fw-bold mb-0">${userData.displayName}</h6>
                <small class="text-muted">${userData.bio || 'SkillSwap User'}</small>
            </div>
            <div class="ms-auto">
                <button class="btn btn-sm btn-outline-primary" onclick="chatManager.scheduleSessionWithUser('${userData.uid}')">
                    <i class="fas fa-calendar-plus me-1"></i>Schedule Session
                </button>
            </div>
        `;
    }

    async loadMessages(chatId) {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '<div class="text-center py-4"><div class="loading-spinner mx-auto mb-3"></div><p class="text-muted">Loading messages...</p></div>';

        // Unsubscribe from previous listener
        if (this.unsubscribeMessages) {
            this.unsubscribeMessages();
        }

        // Set up real-time listener for messages
        this.unsubscribeMessages = firebase.firestore()
            .collection('chats')
            .doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(async (snapshot) => {
                const messages = [];
                snapshot.forEach(doc => {
                    messages.push({ id: doc.id, ...doc.data() });
                });

                this.renderMessages(messages);
                
                // Mark messages as read
                await this.markMessagesAsRead(chatId);
            }, (error) => {
                console.error('Error loading messages:', error);
                chatMessages.innerHTML = '<div class="text-center py-4"><p class="text-muted">Error loading messages</p></div>';
            });
    }

    renderMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        
        if (messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-comments text-muted fa-3x mb-3"></i>
                    <p class="text-muted">No messages yet</p>
                    <p class="text-muted small">Start the conversation!</p>
                </div>
            `;
            return;
        }

        let messagesHTML = '';
        
        messages.forEach(message => {
            const messageTime = new Date(message.timestamp.seconds * 1000);
            const timeString = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const isSent = message.senderId === this.currentChatUser.uid;
            
            messagesHTML += `
                <div class="message ${isSent ? 'message-sent' : 'message-received'}">
                    <div class="message-content">
                        <p class="mb-1">${message.text}</p>
                        <small class="text-muted opacity-75">${timeString}</small>
                    </div>
                </div>
            `;
        });

        chatMessages.innerHTML = messagesHTML;
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const messageText = messageInput.value.trim();
        
        if (!messageText || !this.currentChatId || !this.currentChatUser) return;

        try {
            const messageData = {
                text: messageText,
                senderId: this.currentChatUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            };

            await firebase.firestore()
                .collection('chats')
                .doc(this.currentChatId)
                .collection('messages')
                .add(messageData);

            // Clear input
            messageInput.value = '';
            
            // Update last message in conversations list
            await this.updateLastMessage(this.currentChatId, messageText);

        } catch (error) {
            console.error('Error sending message:', error);
            this.showToast('Error sending message', 'error');
        }
    }

    async updateLastMessage(chatId, messageText) {
        // This would update the last message in the conversations list
        // For now, we'll reload conversations to reflect the change
        await this.loadConversations();
    }

    async markMessagesAsRead(chatId) {
        if (!this.currentChatUser || !chatId) return;

        try {
            const unreadMessagesSnapshot = await firebase.firestore()
                .collection('chats')
                .doc(chatId)
                .collection('messages')
                .where('read', '==', false)
                .where('senderId', '!=', this.currentChatUser.uid)
                .get();

            const batch = firebase.firestore().batch();
            
            unreadMessagesSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });

            await batch.commit();
            
            // Update conversations list
            await this.updateConversationUnreadCount(chatId);
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }

    async updateConversationUnreadCount(chatId) {
        const conversation = this.conversations.find(c => c.chatId === chatId);
        if (conversation) {
            conversation.unread = 0;
            this.renderConversationsList();
        }
    }

    setupRealTimeListeners() {
        // Listen for new conversations (sessions)
        firebase.firestore()
            .collection('sessions')
            .where('participants', 'array-contains', this.currentChatUser.uid)
            .onSnapshot(async (snapshot) => {
                await this.loadConversations();
            });
    }

    // Start chat with a specific user
    async startChatWithUser(userId) {
        const chatId = this.generateChatId(this.currentChatUser.uid, userId);
        
        // Check if conversation already exists
        let conversation = this.conversations.find(c => c.userId === userId);
        
        if (!conversation) {
            // Create new conversation entry
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(userId)
                .get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                conversation = {
                    userId: userId,
                    userData: userData,
                    lastMessage: null,
                    chatId: chatId,
                    unread: 0
                };
                this.conversations.push(conversation);
            }
        }
        
        if (conversation) {
            this.openChat(chatId, userId);
        }
    }

    scheduleSessionWithUser(userId) {
        window.location.href = `sessions.html?action=schedule&userId=${userId}`;
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

    // Clean up listeners
    destroy() {
        if (this.unsubscribeMessages) {
            this.unsubscribeMessages();
        }
    }
}

// Initialize chat manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.chatManager = new ChatManager();
});

// Global functions for HTML event handlers
function sendChatMessage() {
    if (window.chatManager) {
        window.chatManager.sendMessage();
    }
}

function scheduleSessionFromChat(userId) {
    if (window.chatManager) {
        window.chatManager.scheduleSessionWithUser(userId);
    }
}

// Event listeners for chat input
document.addEventListener('DOMContentLoaded', function() {
    // Message input enter key
    document.getElementById('messageInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // Send message button
    document.getElementById('sendMessageBtn')?.addEventListener('click', sendChatMessage);
});

// Clean up when leaving page
window.addEventListener('beforeunload', () => {
    if (window.chatManager) {
        window.chatManager.destroy();
    }
});