document.addEventListener('DOMContentLoaded', function() {
  const energySlider = document.getElementById('energy');
  const energyValue = document.getElementById('energy-value');
  const moodForm = document.getElementById('moodForm');
  const moodHistoryBody = document.getElementById('moodHistoryBody');
  const moodInsightsList = document.getElementById('moodInsightsList');

  // Initialize energy bars on page load
  initializeEnergyBars();

  // Live slider update
  if (energySlider && energyValue) {
    energyValue.textContent = energySlider.value;
    energySlider.addEventListener('input', function() {
      energyValue.textContent = this.value;
    });
  }

  // Mood selection handling with fallback for older browsers
  const moodOptions = document.querySelectorAll('.mood-option input[type="radio"]');
  moodOptions.forEach(option => {
    option.addEventListener('change', function() {
      // Remove all selected classes
      document.querySelectorAll('.mood-card').forEach(card => {
        card.classList.remove('selected-happy', 'selected-calm', 'selected-anxious', 'selected-sad', 'selected-angry', 'selected-neutral');
      });
      
      // Add selected class to current choice
      if (this.checked) {
        const moodCard = this.nextElementSibling;
        const mood = this.value.toLowerCase();
        moodCard.classList.add(`selected-${mood}`);
      }
    });
  });

  // Handle AJAX form submission
  if (moodForm) {
    moodForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const formData = new FormData(moodForm);
      const data = {
        mood: formData.get('mood'),
        note: formData.get('note'),
        energy: parseInt(formData.get('energy'))
      };

      // Validate mood selection
      if (!data.mood) {
        showNotification('Please select a mood before submitting.', 'error');
        return;
      }

      // Show loading state
      const submitButton = moodForm.querySelector('button[type="submit"]');
      const originalText = submitButton.innerHTML;
      submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
      submitButton.disabled = true;

      try {
        const res = await fetch('/mood-tracker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          const entry = await res.json();

          // Remove "no entries" row if present
          const noEntriesRow = document.getElementById('noEntriesRow');
          if (noEntriesRow) noEntriesRow.remove();

          // Add new row to history table
          addNewMoodEntry(entry);

          // Update mood insights
          updateMoodInsights(entry.mood);

          // Reset form
          moodForm.reset();
          energyValue.textContent = 5;
          
          // Remove selected mood card styling
          document.querySelectorAll('.mood-card').forEach(card => {
            card.classList.remove('selected-happy', 'selected-calm', 'selected-anxious', 'selected-sad', 'selected-angry', 'selected-neutral');
          });

          // Show success message
          showNotification('Mood entry saved successfully!', 'success');
        } else {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to save mood entry');
        }
      } catch (err) {
        console.error('Error saving mood:', err);
        showNotification(err.message || 'Error saving mood entry. Please try again.', 'error');
      } finally {
        // Restore button state
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
      }
    });
  }

  /**
   * Initialize energy bars with proper width and colors
   */
  function initializeEnergyBars() {
    const energyBars = document.querySelectorAll('.energy-bar');
    energyBars.forEach(bar => {
      const energy = parseInt(bar.dataset.energy || 5, 10);
      const width = Math.max(5, (energy / 10) * 100); // Minimum 5% width for visibility
      bar.style.width = width + '%';
      
      // Set color based on energy level
      if (energy <= 3) {
        bar.style.backgroundColor = '#EF4444'; // Red
        bar.classList.add('low');
      } else if (energy <= 7) {
        bar.style.backgroundColor = '#F59E0B'; // Orange
        bar.classList.add('medium');
      } else {
        bar.style.backgroundColor = '#10B981'; // Green
        bar.classList.add('high');
      }
    });
  }

  /**
   * Add new mood entry to the history table
   */
  function addNewMoodEntry(entry) {
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-100 hover:bg-gray-50 animate-fadeIn';
    
    const energyColor = entry.energy <= 3 ? '#EF4444' : entry.energy <= 7 ? '#F59E0B' : '#10B981';
    const energyWidth = Math.max(5, (entry.energy / 10) * 100);
    
    row.innerHTML = `
      <td class="py-3 px-4 text-sm">
        ${new Date(entry.entry_date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          ${entry.mood}
        </span>
      </td>
      <td class="py-3 px-4">
        <div class="flex items-center space-x-2">
          <div class="relative w-24 bg-gray-200 rounded-full h-3">
            <div class="absolute top-0 left-0 h-3 rounded-full energy-bar transition-all duration-300" 
                 data-energy="${entry.energy}"
                 style="width: ${energyWidth}%; background-color: ${energyColor};"></div>
          </div>
          <span class="text-xs text-gray-600">${entry.energy}</span>
        </div>
      </td>
      <td class="py-3 px-4 text-sm text-gray-600">
        ${entry.note || '-'}
      </td>
    `;
    
    moodHistoryBody.prepend(row);
  }

  /**
   * Update mood insights with new entry
   */
  function updateMoodInsights(mood) {
    if (!moodInsightsList) return;

    const existingItems = moodInsightsList.querySelectorAll('li');
    let found = false;
    
    existingItems.forEach(item => {
      const text = item.textContent;
      if (text.includes(mood + ':')) {
        const match = text.match(/(\d+) times/);
        if (match) {
          const currentCount = parseInt(match[1]);
          item.innerHTML = `
            <span><strong>${mood}:</strong></span>
            <span class="bg-primary/10 text-primary px-2 py-1 rounded text-sm">${currentCount + 1} times</span>
          `;
          found = true;
        }
      }
    });
    
    if (!found) {
      // If no insights exist yet, create the list
      if (moodInsightsList.children.length === 0) {
        const noDataText = moodInsightsList.parentElement.querySelector('p');
        if (noDataText) noDataText.style.display = 'none';
      }
      
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center animate-fadeIn';
      li.innerHTML = `
        <span><strong>${mood}:</strong></span>
        <span class="bg-primary/10 text-primary px-2 py-1 rounded text-sm">1 times</span>
      `;
      moodInsightsList.appendChild(li);
    }
  }

  /**
   * Show notification messages
   */
  function showNotification(message, type) {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    notification.innerHTML = `
      <div class="flex items-center">
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2"></i>
        ${message}
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  /**
   * Initialize existing mood data for insights
   */
  function initializeMoodData() {
    const existingRows = document.querySelectorAll('#moodHistoryBody tr:not(#noEntriesRow)');
    existingRows.forEach(row => {
      const moodCell = row.children[1];
      if (moodCell && moodCell.textContent.trim()) {
        const mood = moodCell.textContent.trim();
        // This would be handled by server-side rendering, but keeping for completeness
      }
    });
  }

  // Initialize mood data on page load
  initializeMoodData();

  /**
   * Add keyboard navigation for mood selection
   */
  function setupKeyboardNavigation() {
    const moodInputs = document.querySelectorAll('.mood-option input[type="radio"]');
    
    moodInputs.forEach((input, index) => {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = (index + 1) % moodInputs.length;
          moodInputs[nextIndex].focus();
          moodInputs[nextIndex].checked = true;
          moodInputs[nextIndex].dispatchEvent(new Event('change'));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = (index - 1 + moodInputs.length) % moodInputs.length;
          moodInputs[prevIndex].focus();
          moodInputs[prevIndex].checked = true;
          moodInputs[prevIndex].dispatchEvent(new Event('change'));
        }
      });
    });
  }

  // Setup keyboard navigation
  setupKeyboardNavigation();

  /**
   * Auto-save draft functionality
   */
  function setupAutoSave() {
    const noteTextarea = document.getElementById('note');
    let saveTimeout;

    if (noteTextarea) {
      noteTextarea.addEventListener('input', function() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          // Save draft to localStorage
          localStorage.setItem('moodTracker_draft', JSON.stringify({
            note: this.value,
            timestamp: Date.now()
          }));
        }, 1000);
      });

      // Load draft on page load
      const draft = localStorage.getItem('moodTracker_draft');
      if (draft) {
        try {
          const draftData = JSON.parse(draft);
          // Only load if draft is less than 24 hours old
          if (Date.now() - draftData.timestamp < 24 * 60 * 60 * 1000) {
            noteTextarea.value = draftData.note;
          } else {
            localStorage.removeItem('moodTracker_draft');
          }
        } catch (e) {
          localStorage.removeItem('moodTracker_draft');
        }
      }
    }
  }

  // Setup auto-save
  setupAutoSave();

  /**
   * Clear draft after successful submission
   */
  function clearDraft() {
    localStorage.removeItem('moodTracker_draft');
  }

  // Export functions for external use if needed
  window.moodTracker = {
    initializeEnergyBars,
    showNotification,
    clearDraft
  };
});


