// public/js/admin-chat.js - Enhanced admin chat functionality
console.log('Admin Chat JavaScript loaded');

// Global variables
let socket = null;
let currentConversationId = null;
let conversations = [];
let currentUser = null;
let patients = [];
let therapists = [];
let isConnected = false;

// Initialize socket connection and admin chat
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing admin chat');

  // Get current user from window variables
  if (window.currentUser && window.currentUser.id) {
    currentUser = window.currentUser;
    console.log('Current admin user:', currentUser);

    initializeSocket();
    loadConversations();
    loadTherapistMessages(); // Load therapist messages on page load
  } else {
    console.error('No current user found');
    showError('Session error. Please refresh the page.');
  }
});

// Initialize Socket.io connection
function initializeSocket() {
  console.log('Initializing socket connection');
  
  socket = io();
  
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    isConnected = true;
    
    // Authenticate as admin
    socket.emit('authenticate', {
      userId: currentUser.id,
      role: currentUser.role
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    isConnected = false;
  });
  
  socket.on('new_message', (data) => {
    console.log('New message received:', data);
    if (data.conversationId === currentConversationId) {
      // Add message to current chat
      addMessageToChat(data.message);
    } else {
      // Update conversation list
      loadConversations();
    }
  });
  
  socket.on('user_online', (data) => {
    updateUserOnlineStatus(data.userId, true);
  });
  
  socket.on('user_offline', (data) => {
    updateUserOnlineStatus(data.userId, false);
  });
}

// Load admin conversations
async function loadConversations() {
  console.log('Loading admin conversations');
  
  try {
    const response = await fetch('/admin/chat/conversations');
    const data = await response.json();
    
    if (data.success) {
      conversations = data.conversations || [];
      displayConversations();
    } else {
      console.error('Failed to load conversations:', data.error);
      showError('Failed to load conversations');
    }
  } catch (error) {
    console.error('Error loading conversations:', error);
    showError('Error loading conversations');
  }
}

// Display conversations list
function displayConversations() {
  const container = document.getElementById('conversationsList');
  if (!container) return;
  
  if (conversations.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-gray-500">
        <i class="fas fa-comments text-4xl mb-2"></i>
        <p>No conversations yet</p>
        <p class="text-sm">Start chatting with patients or therapists</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = conversations.map(conv => {
    const otherUser = conv.other_user;
    const lastMessageTime = conv.last_message_time ? 
      formatMessageTime(conv.last_message_time) : 
      formatMessageTime(conv.created_at);
    
    const unreadBadge = conv.unread_count > 0 ? 
      `<span class="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-2">${conv.unread_count}</span>` : 
      '';
    
    const userIcon = otherUser.role === 'therapist' ? 
      '<i class="fas fa-user-md text-blue-600"></i>' : 
      '<i class="fas fa-user text-green-600"></i>';
    
    return `
      <div class="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer conversation-item" 
           onclick="openConversation('${conv.id}', ${JSON.stringify(otherUser).replace(/"/g, '&quot;')})">
        <div class="flex items-center">
          <div class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
            ${userIcon}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <p class="font-medium text-gray-900 truncate">${escapeHtml(otherUser.name)}</p>
              <div class="flex items-center">
                ${unreadBadge}
                <span class="text-sm text-gray-500 ml-2">${lastMessageTime}</span>
              </div>
            </div>
            <p class="text-sm text-gray-600 capitalize">${otherUser.role} • ${escapeHtml(otherUser.specialty || '')}</p>
            <p class="text-sm text-gray-500 truncate">${conv.last_message || 'No messages yet'}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Open conversation
async function openConversation(conversationId, otherUser) {
  console.log('Opening conversation:', conversationId, otherUser);
  
  currentConversationId = conversationId;
  
  // Join socket room
  if (socket && isConnected) {
    socket.emit('join_conversation', conversationId);
  }
  
  // Update UI
  document.getElementById('chatContainer').classList.remove('hidden');
  updateChatHeader(otherUser);
  
  // Enable message input
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  if (messageInput && sendButton) {
    messageInput.disabled = false;
    sendButton.disabled = false;
    document.getElementById('messageInputContainer').classList.remove('hidden');
  }
  
  // Load messages
  await loadMessages(conversationId);
}

// Load messages for conversation
async function loadMessages(conversationId) {
  console.log('Loading messages for conversation:', conversationId);
  
  try {
    const response = await fetch(`/admin/chat/${conversationId}/messages`);
    const data = await response.json();
    
    if (data.success) {
      displayMessages(data.messages || []);
    } else {
      console.error('Failed to load messages:', data.error);
      showError('Failed to load messages');
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    showError('Error loading messages');
  }
}

// Display messages
function displayMessages(messages) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;
  
  if (messages.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <i class="fas fa-comments text-4xl mb-2"></i>
        <p>No messages yet. Start the conversation!</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = messages.map(msg => {
    const isOwn = msg.sender_id === currentUser.id;
    const time = new Date(msg.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const messageClass = isOwn ? 
      'ml-auto bg-blue-600 text-white' : 
      'mr-auto bg-gray-200 text-gray-900';
    
    const senderInfo = !isOwn && msg.sender_role ? 
      `<p class="text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'} mb-1">
        ${msg.sender_role === 'admin' ? '👑 Admin' : 
          msg.sender_role === 'therapist' ? '👩‍⚕️ Therapist' : '👤 Patient'}
      </p>` : '';
    
    return `
      <div class="mb-4 flex ${isOwn ? 'justify-end' : 'justify-start'}">
        <div class="${messageClass} max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
          ${senderInfo}
          <p class="text-sm">${escapeHtml(msg.content)}</p>
          <p class="text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'} mt-1">${time}</p>
        </div>
      </div>
    `;
  }).join('');
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Update chat header
function updateChatHeader(otherUser) {
  const header = document.getElementById('chatHeader');
  if (!header) return;
  
  const userIcon = otherUser.role === 'therapist' ? 
    '<i class="fas fa-user-md text-blue-600"></i>' : 
    '<i class="fas fa-user text-green-600"></i>';
  
  const avatarHtml = otherUser.image ? 
    `<img src="${otherUser.image}" alt="${otherUser.name}" class="w-10 h-10 rounded-full object-cover">` :
    `<div class="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">${userIcon}</div>`;
  
  header.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <div id="participantAvatar" class="mr-3">${avatarHtml}</div>
        <div>
          <h3 id="participantName" class="font-semibold">${escapeHtml(otherUser.name)}</h3>
          <p id="participantInfo" class="text-sm text-gray-600 capitalize">
            ${otherUser.role} ${otherUser.specialty ? '• ' + escapeHtml(otherUser.specialty) : ''}
          </p>
        </div>
      </div>
      <div class="flex space-x-2">
        <button id="closeChatBtn" onclick="closeChat()" class="text-gray-500 hover:text-gray-700">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `;
}

// Send message
async function sendMessage(event) {
  event.preventDefault();
  
  if (!currentConversationId) {
    showError('No conversation selected');
    return;
  }
  
  const input = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const content = input.value.trim();
  
  if (!content) return;
  
  // Disable input while sending
  input.disabled = true;
  sendButton.disabled = true;
  sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  
  try {
    const response = await fetch(`/admin/chat/${currentConversationId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Add message to chat immediately
      addMessageToChat(data.message);
      
      // Clear input
      input.value = '';
      
      // Emit via socket for real-time
      if (socket && isConnected) {
        socket.emit('new_message', {
          conversationId: currentConversationId,
          message: data.message
        });
      }
    } else {
      showError(data.error || 'Failed to send message');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showError('Failed to send message');
  } finally {
    // Re-enable input
    input.disabled = false;
    sendButton.disabled = false;
    sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
  }
}

// Add message to chat
function addMessageToChat(message) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;
  
  // Remove "no messages" placeholder if it exists
  const placeholder = container.querySelector('.text-center');
  if (placeholder) {
    placeholder.remove();
  }
  
  const isOwn = message.sender_id === currentUser.id;
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const messageClass = isOwn ? 
    'ml-auto bg-blue-600 text-white' : 
    'mr-auto bg-gray-200 text-gray-900';
  
  const senderInfo = !isOwn && message.sender_role ? 
    `<p class="text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'} mb-1">
      ${message.sender_role === 'admin' ? '👑 Admin' : 
        message.sender_role === 'therapist' ? '👩‍⚕️ Therapist' : '👤 Patient'}
    </p>` : '';
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `mb-4 flex ${isOwn ? 'justify-end' : 'justify-start'}`;
  messageDiv.innerHTML = `
    <div class="${messageClass} max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
      ${senderInfo}
      <p class="text-sm">${escapeHtml(message.content)}</p>
      <p class="text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'} mt-1">${time}</p>
    </div>
  `;
  
  container.appendChild(messageDiv);
  container.scrollTop = container.scrollHeight;
}

// Close chat
function closeChat() {
  currentConversationId = null;
  
  // Leave socket room
  if (socket && isConnected) {
    socket.emit('leave_conversation', currentConversationId);
  }
  
  // Hide chat container
  document.getElementById('chatContainer').classList.add('hidden');
  
  // Clear message input
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  if (messageInput && sendButton) {
    messageInput.value = '';
    messageInput.disabled = true;
    sendButton.disabled = true;
    document.getElementById('messageInputContainer').classList.add('hidden');
  }
  
  // Reload conversations to refresh unread counts
  loadConversations();
}

// Show patients modal
async function showPatientsModal() {
  console.log('Loading patients for chat');
  
  try {
    const response = await fetch('/admin/chat/patients');
    const data = await response.json();
    
    if (data.success) {
      patients = data.patients || [];
      displayPatientsList();
      document.getElementById('patientsModal').classList.remove('hidden');
      document.getElementById('patientsModal').classList.add('flex');
    } else {
      showError('Failed to load patients');
    }
  } catch (error) {
    console.error('Error loading patients:', error);
    showError('Error loading patients');
  }
}

// Display patients list
function displayPatientsList() {
  const container = document.getElementById('patientsList');
  if (!container) return;
  
  if (patients.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <i class="fas fa-users text-4xl mb-2"></i>
        <p>No patients found</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = patients.map(patient => `
    <div class="patient-item p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer mb-3" 
         onclick="startChatWithPatient('${patient.id}', '${escapeHtml(patient.name)}')">
      <div class="flex items-center">
        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
          <i class="fas fa-user text-green-600"></i>
        </div>
        <div class="flex-1">
          <h4 class="font-medium text-gray-900">${escapeHtml(patient.name)}</h4>
          <p class="text-sm text-gray-600">${escapeHtml(patient.email)}</p>
          <div class="flex items-center mt-1 text-xs text-gray-500">
            <span>Joined: ${new Date(patient.created_at).toLocaleDateString()}</span>
            ${patient.appointment_count > 0 ? 
              `<span class="ml-3">${patient.appointment_count} appointments</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// Show therapists modal
async function showTherapistsModal() {
  console.log('Loading therapists for chat');
  
  try {
    const response = await fetch('/admin/chat/therapists');
    const data = await response.json();
    
    if (data.success) {
      therapists = data.therapists || [];
      displayTherapistsList();
      document.getElementById('therapistsModal').classList.remove('hidden');
      document.getElementById('therapistsModal').classList.add('flex');
    } else {
      showError('Failed to load therapists');
    }
  } catch (error) {
    console.error('Error loading therapists:', error);
    showError('Error loading therapists');
  }
}

// Display therapists list
function displayTherapistsList() {
  const container = document.getElementById('therapistsList');
  if (!container) return;
  
  if (therapists.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <i class="fas fa-user-md text-4xl mb-2"></i>
        <p>No therapists found</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = therapists.map(therapist => `
    <div class="therapist-item p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer mb-3" 
         onclick="startChatWithTherapist('${therapist.id}', '${escapeHtml(therapist.name)}')">
      <div class="flex items-center">
        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
          <i class="fas fa-user-md text-blue-600"></i>
        </div>
        <div class="flex-1">
          <h4 class="font-medium text-gray-900">${escapeHtml(therapist.name)}</h4>
          <p class="text-sm text-blue-600">${escapeHtml(therapist.specialty)}</p>
          <p class="text-sm text-gray-600">${escapeHtml(therapist.email)}</p>
          <div class="flex items-center mt-1 text-xs text-gray-500">
            <span>Joined: ${new Date(therapist.created_at).toLocaleDateString()}</span>
            ${therapist.patient_count > 0 ? 
              `<span class="ml-3">${therapist.patient_count} patients</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// Start chat with patient
async function startChatWithPatient(patientId, patientName) {
  console.log('Starting chat with patient:', patientId, patientName);
  
  closePatientsModal();
  
  try {
    const response = await fetch('/admin/chat/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        participantId: patientId,
        participantType: 'patient',
        message: `Hello ${patientName}, this is ${currentUser.name} from the CalmTunes admin team. How can I help you today?`
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Refresh conversations and open the new one
      await loadConversations();
      
      // Find and open the conversation
      const conversation = conversations.find(conv => 
        conv.other_user.id === patientId
      );
      
      if (conversation) {
        openConversation(conversation.id, conversation.other_user);
      }
    } else {
      showError(data.error || 'Failed to start conversation');
    }
  } catch (error) {
    console.error('Error starting chat with patient:', error);
    showError('Failed to start conversation');
  }
}

// Start chat with therapist
async function startChatWithTherapist(therapistId, therapistName) {
  console.log('Starting chat with therapist:', therapistId, therapistName);
  
  closeTherapistsModal();
  
  try {
    const response = await fetch('/admin/chat/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        participantId: therapistId,
        participantType: 'therapist',
        message: `Hello ${therapistName}, this is ${currentUser.name} from the CalmTunes admin team. I wanted to check in with you. How are things going?`
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Refresh conversations and open the new one
      await loadConversations();
      
      // Find and open the conversation
      const conversation = conversations.find(conv => 
        conv.other_user.id === therapistId
      );
      
      if (conversation) {
        openConversation(conversation.id, conversation.other_user);
      }
    } else {
      showError(data.error || 'Failed to start conversation');
    }
  } catch (error) {
    console.error('Error starting chat with therapist:', error);
    showError('Failed to start conversation');
  }
}

// Modal close functions
function closePatientsModal() {
  document.getElementById('patientsModal').classList.add('hidden');
  document.getElementById('patientsModal').classList.remove('flex');
}

function closeTherapistsModal() {
  document.getElementById('therapistsModal').classList.add('hidden');
  document.getElementById('therapistsModal').classList.remove('flex');
}

// Utility functions
function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) {
    return '';
  }
  return String(unsafe)
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showError(message) {
  console.error(message);
  // You can implement a toast notification here
  alert(message);
}

function updateUserOnlineStatus(userId, isOnline) {
  // Update online status indicators in the UI if needed
  console.log(`User ${userId} is now ${isOnline ? 'online' : 'offline'}`);
}

// Load therapist messages for admin
async function loadTherapistMessages() {
  console.log('Loading therapist messages');

  try {
    const response = await fetch('/admin/therapist-messages');
    const data = await response.json();

    if (data.success) {
      displayTherapistMessages(data.messages || []);
    } else {
      console.error('Failed to load therapist messages:', data.error);
      showTherapistMessagesError('Failed to load therapist messages');
    }
  } catch (error) {
    console.error('Error loading therapist messages:', error);
    showTherapistMessagesError('Error loading therapist messages');
  }
}

// Display therapist messages
function displayTherapistMessages(messages) {
  const container = document.getElementById('therapistMessagesContainer');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <i class="fas fa-comments text-4xl mb-2"></i>
        <p>No therapist messages</p>
        <p class="text-sm">Therapist messages will appear here</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(msg => {
    const time = new Date(msg.created_at).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const unreadBadge = !msg.is_read ?
      '<span class="bg-red-500 text-white text-xs px-2 py-1 rounded-full ml-2">New</span>' : '';

    return `
      <div class="therapist-message-item p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer mb-3"
           onclick="openTherapistConversation('${msg.conversation_id}', '${escapeHtml(msg.therapist_name)}')">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <i class="fas fa-user-md text-blue-600"></i>
            </div>
            <div>
              <div class="flex items-center">
                <h4 class="font-medium text-gray-900">${escapeHtml(msg.therapist_name)}</h4>
                ${unreadBadge}
              </div>
              <p class="text-sm text-gray-600">${escapeHtml(msg.therapist_email)}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-sm text-gray-500">${time}</span>
          </div>
        </div>
        <p class="text-sm text-gray-700 mt-2 truncate">${escapeHtml(msg.content)}</p>
      </div>
    `;
  }).join('');
}

// Open therapist conversation
async function openTherapistConversation(conversationId, therapistName) {
  console.log('Opening therapist conversation:', conversationId, therapistName);

  try {
    const response = await fetch(`/admin/therapist-messages/${conversationId}`);
    const data = await response.json();

    if (data.success) {
      showTherapistChatModal(conversationId, therapistName, data.messages || []);
    } else {
      showError('Failed to load therapist conversation');
    }
  } catch (error) {
    console.error('Error loading therapist conversation:', error);
    showError('Error loading therapist conversation');
  }
}

// Show therapist chat modal
function showTherapistChatModal(conversationId, therapistName, messages) {
  // Create modal if it doesn't exist
  if (!document.getElementById('therapistChatModal')) {
    const modal = document.createElement('div');
    modal.id = 'therapistChatModal';
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 hidden items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div class="p-6 border-b border-gray-200">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-lg font-semibold">💬 Chat with ${escapeHtml(therapistName)}</h3>
              <p class="text-sm text-gray-600">Therapist support conversation</p>
            </div>
            <button onclick="closeTherapistChatModal()" class="text-gray-500 hover:text-gray-700">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div id="therapistChatMessages" class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Messages will be loaded here -->
        </div>
        <div class="p-4 border-t border-gray-200">
          <form id="therapistMessageForm" onsubmit="sendTherapistMessage(event, '${conversationId}')">
            <div class="flex space-x-3">
              <input
                type="text"
                id="therapistMessageInput"
                placeholder="Type your response..."
                class="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <button
                type="submit"
                class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Display messages
  displayTherapistChatMessages(messages);

  // Show modal
  document.getElementById('therapistChatModal').classList.remove('hidden');
  document.getElementById('therapistChatModal').classList.add('flex');
}

// Display therapist chat messages
function displayTherapistChatMessages(messages) {
  const container = document.getElementById('therapistChatMessages');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <i class="fas fa-comments text-4xl mb-2"></i>
        <p>No messages yet</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(msg => {
    const isAdmin = msg.sender_role === 'admin';
    const time = new Date(msg.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="flex ${isAdmin ? 'justify-end' : 'justify-start'} mb-4">
        <div class="${isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'} max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
          <p class="text-sm">${escapeHtml(msg.content)}</p>
          <p class="text-xs ${isAdmin ? 'text-blue-200' : 'text-gray-500'} mt-1">${time}</p>
        </div>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Send therapist message
async function sendTherapistMessage(event, conversationId) {
  event.preventDefault();

  const input = document.getElementById('therapistMessageInput');
  const content = input.value.trim();

  if (!content) return;

  try {
    const response = await fetch(`/admin/therapist-messages/${conversationId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });

    const data = await response.json();

    if (data.success) {
      input.value = '';
      // Add message to chat
      addTherapistChatMessage(data.message);
    } else {
      showError(data.error || 'Failed to send message');
    }
  } catch (error) {
    console.error('Error sending therapist message:', error);
    showError('Failed to send message');
  }
}

// Add message to therapist chat
function addTherapistChatMessage(message) {
  const container = document.getElementById('therapistChatMessages');
  if (!container) return;

  // Remove "no messages" placeholder if it exists
  const placeholder = container.querySelector('.text-center');
  if (placeholder) {
    placeholder.remove();
  }

  const isAdmin = message.sender_role === 'admin';
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const messageDiv = document.createElement('div');
  messageDiv.className = `flex ${isAdmin ? 'justify-end' : 'justify-start'} mb-4`;
  messageDiv.innerHTML = `
    <div class="${isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'} max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
      <p class="text-sm">${escapeHtml(message.content)}</p>
      <p class="text-xs ${isAdmin ? 'text-blue-200' : 'text-gray-500'} mt-1">${time}</p>
    </div>
  `;

  container.appendChild(messageDiv);
  container.scrollTop = container.scrollHeight;
}

// Close therapist chat modal
function closeTherapistChatModal() {
  const modal = document.getElementById('therapistChatModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// Show therapist messages error
function showTherapistMessagesError(message) {
  const container = document.getElementById('therapistMessagesContainer');
  if (container) {
    container.innerHTML = `
      <div class="text-center text-red-500 py-8">
        <i class="fas fa-exclamation-triangle text-3xl mb-2"></i>
        <p>${message}</p>
      </div>
    `;
  }
}

// Initialize message form listener
document.addEventListener('DOMContentLoaded', function() {
  const messageForm = document.getElementById('messageForm');
  if (messageForm) {
    messageForm.addEventListener('submit', sendMessage);
  }

  // Enter key support for message input
  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    messageInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(e);
      }
    });
  }
});