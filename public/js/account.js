//public/js/account.js
// Global variables
let selectedFile = null;
let isUploading = false;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeImageHandlers();
    initializeFormValidation();
    initializeRoleSelection();
    loadExistingProfileImage();
    initializeVolumeSlider();
    initializeDeleteConfirmation();
});

// Initialize all image-related event handlers
function initializeImageHandlers() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('profileImageInput');
    const urlInput = document.getElementById('profile_image');

    // Drag and drop handlers
    if (dropZone) {
        dropZone.addEventListener('dragenter', handleDragEnter);
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);
    }

    // File input change handler
    if (fileInput) {
        fileInput.addEventListener('change', handleImageSelect);
    }

    // URL input change handler
    if (urlInput) {
        urlInput.addEventListener('input', debounce(previewImageUrl, 500));
    }
}

// Role selection handlers - FIXED VERSION
function initializeRoleSelection() {
    const roleInputs = document.querySelectorAll('input[name="role"]');
    const patientLabel = document.getElementById('patientLabel');
    const therapistLabel = document.getElementById('therapistLabel');
    const patientBorder = document.getElementById('patient-border');
    const therapistBorder = document.getElementById('therapist-border');

    if (!roleInputs.length || !patientLabel || !therapistLabel) {
        console.log('Role selection elements not found');
        return;
    }

    roleInputs.forEach(input => {
        input.addEventListener('change', function() {
            console.log('Role changed to:', this.value);
            
            // Reset all labels to default state
            patientLabel.className = 'relative flex cursor-pointer rounded-xl border p-4 focus:outline-none border-gray-200';
            therapistLabel.className = 'relative flex cursor-pointer rounded-xl border p-4 focus:outline-none border-gray-200';
            
            // Reset borders to transparent
            if (patientBorder) {
                patientBorder.className = 'absolute -inset-px rounded-xl border-2 pointer-events-none border-transparent';
            }
            if (therapistBorder) {
                therapistBorder.className = 'absolute -inset-px rounded-xl border-2 pointer-events-none border-transparent';
            }

            // Apply styles based on selection
            if (this.value === 'patient') {
                patientLabel.className = 'relative flex cursor-pointer rounded-xl border p-4 focus:outline-none border-blue-200 bg-blue-50';
                if (patientBorder) {
                    patientBorder.className = 'absolute -inset-px rounded-xl border-2 pointer-events-none border-blue-500';
                }
            } else if (this.value === 'therapist') {
                therapistLabel.className = 'relative flex cursor-pointer rounded-xl border p-4 focus:outline-none border-purple-200 bg-purple-50';
                if (therapistBorder) {
                    therapistBorder.className = 'absolute -inset-px rounded-xl border-2 pointer-events-none border-purple-500';
                }
            }

            // Update role badge
            updateRoleBadge(this.value);
            
            showSaveStatus('Account type changed. Click "Update Profile" to save.', 'info');
        });
    });

    // Set initial state based on checked input
    const checkedRole = document.querySelector('input[name="role"]:checked');
    if (checkedRole) {
        // Trigger change event to set initial styling
        checkedRole.dispatchEvent(new Event('change'));
    }
}

function updateRoleBadge(role) {
    const roleBadge = document.getElementById('roleBadge');
    const accountType = document.getElementById('accountType');
    
    if (roleBadge) {
        if (role === 'therapist') {
            roleBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 shadow-lg';
            roleBadge.innerHTML = `
                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Licensed Therapist
            `;
        } else {
            roleBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 shadow-lg';
            roleBadge.innerHTML = `
                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                </svg>
                Patient
            `;
        }
    }
    
    if (accountType) {
        accountType.textContent = role === 'therapist' ? 'Therapist' : 'Patient';
        accountType.className = role === 'therapist' ? 'font-medium text-purple-600' : 'font-medium text-blue-600';
    }
}

// Form validation and submission - FIXED VERSION
function initializeFormValidation() {
    const form = document.getElementById('accountForm');
    if (form) {
        // Use regular form submission instead of fetch
        form.addEventListener('submit', function(e) {
            console.log('Form submitted');
            
            if (isUploading) {
                e.preventDefault();
                return false;
            }
            
            if (!validateForm()) {
                e.preventDefault();
                return false;
            }

            // Log form data for debugging
            const formData = new FormData(this);
            console.log('Form submission data:');
            for (let [key, value] of formData.entries()) {
                console.log(key, value);
            }

            // Check role selection
            const selectedRole = document.querySelector('input[name="role"]:checked');
            if (!selectedRole) {
                e.preventDefault();
                showError('Please select an account type.');
                return false;
            }
            
            console.log('Selected role:', selectedRole.value);
            
            // Show loading state
            showLoadingState(true);
            showSaveStatus('Updating profile...', 'loading');
            
            // Allow form to submit normally
            return true;
        });
        
        // Add real-time validation
        const inputs = form.querySelectorAll('input[required]');
        inputs.forEach(input => {
            input.addEventListener('blur', validateField);
            input.addEventListener('input', clearFieldError);
        });
    }
}

function validateForm() {
    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    
    if (!name) {
        showError('Full name is required.');
        document.getElementById('name')?.focus();
        return false;
    }
    
    if (!email) {
        showError('Email address is required.');
        document.getElementById('email')?.focus();
        return false;
    }
    
    // Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        showError('Please enter a valid email address.');
        document.getElementById('email')?.focus();
        return false;
    }
    
    return true;
}

// Volume slider initialization
function initializeVolumeSlider() {
    const volumeSlider = document.getElementById('defaultVolume');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', function(e) {
            const display = document.getElementById('volumeDisplay');
            if (display) {
                display.textContent = e.target.value + '%';
            }
        });
    }
}

// Delete confirmation initialization
function initializeDeleteConfirmation() {
    const deleteInput = document.getElementById('deleteConfirmation');
    if (deleteInput) {
        deleteInput.addEventListener('input', function(e) {
            const deleteButton = document.getElementById('deleteButton');
            if (deleteButton) {
                if (e.target.value === 'DELETE') {
                    deleteButton.disabled = false;
                    deleteButton.classList.remove('disabled:bg-gray-300', 'disabled:cursor-not-allowed');
                } else {
                    deleteButton.disabled = true;
                    deleteButton.classList.add('disabled:bg-gray-300', 'disabled:cursor-not-allowed');
                }
            }
        });
    }
}

// Load existing profile image on page load
function loadExistingProfileImage() {
    const urlInput = document.getElementById('profile_image');
    if (urlInput && urlInput.value) {
        previewImageUrl(urlInput.value);
    }
}

// Drag and drop event handlers
function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelection(files[0]);
    }
}

// Handle file selection from input or drag/drop
function handleImageSelect(input) {
    if (input.files && input.files[0]) {
        handleFileSelection(input.files[0]);
    }
}

function handleFileSelection(file) {
    if (!validateFile(file)) {
        return;
    }

    selectedFile = file;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        updateProfilePreview(e.target.result, true);
        showImagePreview(e.target.result);
        
        const urlInput = document.getElementById('profile_image');
        if (urlInput) {
            urlInput.value = '';
        }
        
        showSaveStatus('Image selected. Click "Update Profile" to save.', 'info');
    };
    reader.readAsDataURL(file);
}

function validateFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
        showError('Please select a valid image file (JPEG, PNG, GIF, or WebP).');
        return false;
    }

    if (file.size > maxSize) {
        showError('File size must be less than 5MB.');
        return false;
    }

    return true;
}

function updateProfilePreview(src, isFile = false) {
    const preview = document.getElementById('profilePreview');
    if (preview) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Profile Preview';
        img.className = 'w-32 h-32 rounded-full object-cover border-4 border-white/30 shadow-lg';
        
        preview.classList.add('loading');
        
        img.onload = function() {
            preview.innerHTML = '';
            preview.appendChild(img);
            preview.classList.remove('loading');
            updateProfileCompletion();
        };
        
        img.onerror = function() {
            preview.classList.remove('loading');
            showDefaultAvatar();
            showError('Failed to load image preview.');
        };
    }
}

function showImagePreview(src) {
    const previewArea = document.getElementById('imagePreviewArea');
    const imagePreview = document.getElementById('imagePreview');
    
    if (previewArea && imagePreview) {
        imagePreview.src = src;
        previewArea.classList.remove('hidden');
    }
}

function removeImage() {
    selectedFile = null;
    
    const previewArea = document.getElementById('imagePreviewArea');
    if (previewArea) {
        previewArea.classList.add('hidden');
    }
    
    const fileInput = document.getElementById('profileImageInput');
    if (fileInput) {
        fileInput.value = '';
    }
    
    loadExistingProfileImage();
    showSaveStatus('Image removed.', 'info');
}

function previewImageUrl(url) {
    if (!url || !url.trim()) {
        return;
    }

    if (url.trim()) {
        selectedFile = null;
        const previewArea = document.getElementById('imagePreviewArea');
        if (previewArea) {
            previewArea.classList.add('hidden');
        }
    }

    const img = new Image();
    const preview = document.getElementById('profilePreview');
    
    if (preview) {
        preview.classList.add('loading');
    }
    
    img.onload = function() {
        updateProfilePreview(url);
        showSaveStatus('Image URL loaded. Click "Update Profile" to save.', 'info');
    };
    
    img.onerror = function() {
        if (preview) {
            preview.classList.remove('loading');
        }
        showDefaultAvatar();
        showError('Failed to load image from URL. Please check the link.');
    };
    
    img.src = url.trim();
}

function showDefaultAvatar() {
    const preview = document.getElementById('profilePreview');
    if (preview) {
        preview.innerHTML = `
            <div class="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/30 shadow-lg">
                <svg class="w-12 h-12 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                </svg>
            </div>
        `;
    }
}

function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
        markFieldError(field, `${getFieldLabel(field)} is required.`);
    } else if (field.type === 'email' && value) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
            markFieldError(field, 'Please enter a valid email address.');
        }
    }
}

function clearFieldError(e) {
    const field = e.target;
    field.classList.remove('border-red-500');
    field.classList.add('border-gray-300');
}

function markFieldError(field, message) {
    field.classList.remove('border-gray-300');
    field.classList.add('border-red-500');
    showError(message);
}

function getFieldLabel(field) {
    const label = document.querySelector(`label[for="${field.id}"]`);
    return label ? label.textContent.replace('*', '').trim() : field.name;
}

function showLoadingState(loading) {
    const submitBtn = document.querySelector('button[type="submit"]');
    const form = document.getElementById('accountForm');
    
    if (loading) {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Updating...
            `;
        }
        if (form) {
            form.style.opacity = '0.7';
            form.style.pointerEvents = 'none';
        }
    } else {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Update Profile';
        }
        if (form) {
            form.style.opacity = '1';
            form.style.pointerEvents = 'auto';
        }
    }
}

function showSaveStatus(message, type = 'info') {
    const statusDiv = document.getElementById('saveStatus');
    if (statusDiv) {
        statusDiv.classList.remove('hidden');
        statusDiv.textContent = message;
        
        switch(type) {
            case 'success':
                statusDiv.className = 'text-sm text-green-600';
                break;
            case 'error':
                statusDiv.className = 'text-sm text-red-600';
                break;
            case 'loading':
                statusDiv.className = 'text-sm text-blue-600';
                break;
            default:
                statusDiv.className = 'text-sm text-gray-600';
        }
        
        if (type !== 'error') {
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 5000);
        }
    }
}

function showError(message) {
    showFlashMessage(message, 'error');
    showSaveStatus(message, 'error');
}

function showSuccess(message) {
    showFlashMessage(message, 'success');
    showSaveStatus(message, 'success');
}

function showFlashMessage(message, type) {
    const container = document.getElementById('flashMessages');
    if (!container) return;
    
    const alertClass = type === 'error' ? 'bg-red-50 border-red-400' : 'bg-green-50 border-green-400';
    const iconClass = type === 'error' ? 'text-red-400' : 'text-green-400';
    const textClass = type === 'error' ? 'text-red-700' : 'text-green-700';
    const iconPath = type === 'error' 
        ? 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
        : 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z';
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `${alertClass} border-l-4 p-4 mb-6`;
    alertDiv.innerHTML = `
        <div class="flex">
            <div class="flex-shrink-0">
                <svg class="h-5 w-5 ${iconClass}" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="${iconPath}" clip-rule="evenodd" />
                </svg>
            </div>
            <div class="ml-3">
                <p class="text-sm ${textClass}">${message}</p>
            </div>
        </div>
    `;
    
    container.innerHTML = '';
    container.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function updateProfileCompletion() {
    const completionSpan = document.getElementById('profileCompletion');
    if (completionSpan) {
        const name = document.getElementById('name')?.value.trim();
        const email = document.getElementById('email')?.value.trim();
        const hasImage = document.getElementById('profilePreview')?.querySelector('img') !== null;
        
        let completion = 0;
        if (name) completion += 40;
        if (email) completion += 40;
        if (hasImage) completion += 20;
        
        completionSpan.textContent = `${completion}%`;
    }
}

function resetForm() {
    const form = document.getElementById('accountForm');
    if (form) {
        form.reset();
        selectedFile = null;
        
        const fileInput = document.getElementById('profileImageInput');
        if (fileInput) {
            fileInput.value = '';
        }
        
        const previewArea = document.getElementById('imagePreviewArea');
        if (previewArea) {
            previewArea.classList.add('hidden');
        }
        
        loadExistingProfileImage();
        
        // Reset role selection styling
        const checkedRole = document.querySelector('input[name="role"]:checked');
        if (checkedRole) {
            checkedRole.dispatchEvent(new Event('change'));
        }
        
        showSaveStatus('Form reset to original values.', 'info');
    }
}

function confirmDelete() {
    if (confirm('Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently remove all your data, playlists, and preferences.')) {
        if (confirm('This is your final warning. Clicking OK will permanently delete your account. Are you sure?')) {
            window.location.href = '/account/delete';
        }
    }
}

function cancelDelete() {
    const input = document.getElementById('deleteConfirmation');
    const button = document.getElementById('deleteButton');
    if (input) input.value = '';
    if (button) {
        button.disabled = true;
        button.classList.add('disabled:bg-gray-300', 'disabled:cursor-not-allowed');
    }
}

// Tab navigation functions
function showTab(tabName) {
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    
    document.querySelectorAll('.tab-nav-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-calm-50', 'text-calm-700', 'border-calm-200');
        btn.classList.add('text-gray-600', 'hover:bg-gray-50');
    });
    
    const targetPanel = document.getElementById(tabName);
    if (targetPanel) {
        targetPanel.classList.remove('hidden');
    }
    
    if (event && event.target) {
        event.target.classList.add('active', 'bg-calm-50', 'text-calm-700', 'border-calm-200');
        event.target.classList.remove('text-gray-600', 'hover:bg-gray-50');
    }
}

// Utility functions
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