// Enhanced Account Page JavaScript with File Upload Support

// Global variables
let selectedFile = null;
let isUploading = false;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeImageHandlers();
    initializeFormValidation();
    initializeRoleSelection();
    loadExistingProfileImage();
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
    // Validate file
    if (!validateFile(file)) {
        return;
    }

    selectedFile = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        updateProfilePreview(e.target.result, true);
        showImagePreview(e.target.result);
        
        // Clear URL input since we're using file upload
        const urlInput = document.getElementById('profile_image');
        if (urlInput) {
            urlInput.value = '';
        }
        
        showSaveStatus('Image selected. Click "Update Profile" to save.', 'info');
    };
    reader.readAsDataURL(file);
}

// Validate uploaded file
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

// Update the main profile preview circle
function updateProfilePreview(src, isFile = false) {
    const preview = document.getElementById('profilePreview');
    if (preview) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Profile Preview';
        img.className = 'w-32 h-32 rounded-full object-cover border-4 border-teal-100';
        
        // Add loading class temporarily
        preview.classList.add('loading');
        
        img.onload = function() {
            preview.innerHTML = '';
            preview.appendChild(img);
            preview.classList.remove('loading');
            
            // Update profile completion percentage
            updateProfileCompletion();
        };
        
        img.onerror = function() {
            preview.classList.remove('loading');
            showDefaultAvatar();
            showError('Failed to load image preview.');
        };
    }
}

// Show image in the preview area below upload zone
function showImagePreview(src) {
    const previewArea = document.getElementById('imagePreviewArea');
    const imagePreview = document.getElementById('imagePreview');
    
    if (previewArea && imagePreview) {
        imagePreview.src = src;
        previewArea.classList.remove('hidden');
    }
}

// Remove selected image
function removeImage() {
    selectedFile = null;
    
    // Hide preview area
    const previewArea = document.getElementById('imagePreviewArea');
    if (previewArea) {
        previewArea.classList.add('hidden');
    }
    
    // Clear file input
    const fileInput = document.getElementById('profileImageInput');
    if (fileInput) {
        fileInput.value = '';
    }
    
    // Reset to default or existing image
    loadExistingProfileImage();
    
    showSaveStatus('Image removed.', 'info');
}

// Preview image from URL
function previewImageUrl(url) {
    if (!url || !url.trim()) {
        return;
    }

    // Clear selected file if URL is being used
    if (url.trim()) {
        selectedFile = null;
        const previewArea = document.getElementById('imagePreviewArea');
        if (previewArea) {
            previewArea.classList.add('hidden');
        }
    }

    const img = new Image();
    const preview = document.getElementById('profilePreview');
    
    preview.classList.add('loading');
    
    img.onload = function() {
        updateProfilePreview(url);
        showSaveStatus('Image URL loaded. Click "Update Profile" to save.', 'info');
    };
    
    img.onerror = function() {
        preview.classList.remove('loading');
        showDefaultAvatar();
        showError('Failed to load image from URL. Please check the link.');
    };
    
    img.src = url.trim();
}

// Show default avatar
function showDefaultAvatar() {
    const preview = document.getElementById('profilePreview');
    if (preview) {
        preview.innerHTML = `
            <div class="w-32 h-32 rounded-full bg-teal-100 flex items-center justify-center border-4 border-teal-200">
                <svg class="w-12 h-12 text-teal-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                </svg>
            </div>
        `;
    }
}

// Role selection handlers
function initializeRoleSelection() {
    const roleInputs = document.querySelectorAll('input[name="role"]');
    roleInputs.forEach(input => {
        input.addEventListener('change', updateRoleSelection);
    });
}

function updateRoleSelection() {
    const selectedRole = document.querySelector('input[name="role"]:checked').value;
    
    // Update labels
    const patientLabel = document.getElementById('patientLabel');
    const therapistLabel = document.getElementById('therapistLabel');
    const patientBorder = document.getElementById('patient-border');
    const therapistBorder = document.getElementById('therapist-border');
    
    if (selectedRole === 'patient') {
        patientLabel.className = 'relative flex cursor-pointer rounded-lg border p-4 focus:outline-none border-blue-200 bg-blue-50';
        therapistLabel.className = 'relative flex cursor-pointer rounded-lg border p-4 focus:outline-none border-gray-200';
        patientBorder.className = 'absolute -inset-px rounded-lg border-2 pointer-events-none border-blue-500';
        therapistBorder.className = 'absolute -inset-px rounded-lg border-2 pointer-events-none border-transparent';
    } else {
        patientLabel.className = 'relative flex cursor-pointer rounded-lg border p-4 focus:outline-none border-gray-200';
        therapistLabel.className = 'relative flex cursor-pointer rounded-lg border p-4 focus:outline-none border-purple-200 bg-purple-50';
        patientBorder.className = 'absolute -inset-px rounded-lg border-2 pointer-events-none border-transparent';
        therapistBorder.className = 'absolute -inset-px rounded-lg border-2 pointer-events-none border-purple-500';
    }
    
    // Update role badge
    updateRoleBadge(selectedRole);
    
    showSaveStatus('Account type changed. Click "Update Profile" to save.', 'info');
}

function updateRoleBadge(role) {
    const roleBadge = document.getElementById('roleBadge');
    const accountType = document.getElementById('accountType');
    
    if (roleBadge) {
        if (role === 'therapist') {
            roleBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800';
            roleBadge.innerHTML = `
                <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Licensed Therapist
            `;
        } else {
            roleBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800';
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

// Form validation and submission
function initializeFormValidation() {
    const form = document.getElementById('accountForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        
        // Add real-time validation
        const inputs = form.querySelectorAll('input[required]');
        inputs.forEach(input => {
            input.addEventListener('blur', validateField);
            input.addEventListener('input', clearFieldError);
        });
    }
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    if (isUploading) {
        return false;
    }
    
    if (!validateForm()) {
        return false;
    }
    
    submitForm();
}

function validateForm() {
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    
    if (!name) {
        showError('Full name is required.');
        document.getElementById('name').focus();
        return false;
    }
    
    if (!email) {
        showError('Email address is required.');
        document.getElementById('email').focus();
        return false;
    }
    
    // Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        showError('Please enter a valid email address.');
        document.getElementById('email').focus();
        return false;
    }
    
    return true;
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

// Submit form with file upload support
function submitForm() {
    isUploading = true;
    
    const form = document.getElementById('accountForm');
    const formData = new FormData();
    
    // Add form fields
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type !== 'file' && input.name && input.value) {
            formData.append(input.name, input.value);
        }
    });
    
    // Add selected file if exists
    if (selectedFile) {
        formData.append('profile_image_file', selectedFile);
    }
    
    // Show loading state
    showLoadingState(true);
    showSaveStatus('Updating profile...', 'loading');
    
    // Submit via fetch API
    fetch('/account', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        } else {
            return response.json();
        }
    })
    .then(data => {
        if (data && data.success) {
            showSuccess('Profile updated successfully!');
            selectedFile = null;
        } else if (data && data.error) {
            showError(data.error);
        }
    })
    .catch(error => {
        console.error('Upload error:', error);
        showError('An error occurred while updating your profile. Please try again.');
    })
    .finally(() => {
        isUploading = false;
        showLoadingState(false);
    });
}

// UI state management
function showLoadingState(loading) {
    const submitBtn = document.querySelector('button[type="submit"]');
    const form = document.getElementById('accountForm');
    
    if (loading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Updating...
        `;
        form.style.opacity = '0.7';
        form.style.pointerEvents = 'none';
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Update Profile';
        form.style.opacity = '1';
        form.style.pointerEvents = 'auto';
    }
}

// Status and message functions
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
        
        // Auto-hide after 5 seconds for non-error messages
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
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Update profile completion percentage
function updateProfileCompletion() {
    const completionSpan = document.getElementById('profileCompletion');
    if (completionSpan) {
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const hasImage = document.getElementById('profilePreview').querySelector('img') !== null;
        
        let completion = 0;
        if (name) completion += 40;
        if (email) completion += 40;
        if (hasImage) completion += 20;
        
        completionSpan.textContent = `${completion}%`;
    }
}

// Reset form to original state
function resetForm() {
    const form = document.getElementById('accountForm');
    if (form) {
        form.reset();
        selectedFile = null;
        
        // Reset file input
        const fileInput = document.getElementById('profileImageInput');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // Hide preview area
        const previewArea = document.getElementById('imagePreviewArea');
        if (previewArea) {
            previewArea.classList.add('hidden');
        }
        
        // Reset profile preview to original
        loadExistingProfileImage();
        
        // Reset role selection
        updateRoleSelection();
        
        showSaveStatus('Form reset to original values.', 'info');
    }
}

// Confirm account deletion
function confirmDelete() {
    if (confirm('Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently remove all your data, playlists, and preferences.')) {
        if (confirm('This is your final warning. Clicking OK will permanently delete your account. Are you sure?')) {
            window.location.href = '/account/delete';
        }
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