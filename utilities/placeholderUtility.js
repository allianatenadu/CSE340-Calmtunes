// Utility functions for the CalmTunes application

const utilities = {
  // Format date for display
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  // Validate email format
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Generate mood color based on mood type
  getMoodColor: (mood) => {
    const moodColors = {
      'Happy': 'bg-yellow-200 text-yellow-800',
      'Calm': 'bg-green-200 text-green-800',
      'Anxious': 'bg-orange-200 text-orange-800',
      'Sad': 'bg-blue-200 text-blue-800',
      'Angry': 'bg-red-200 text-red-800',
      'Neutral': 'bg-gray-200 text-gray-800'
    };
    return moodColors[mood] || 'bg-gray-200 text-gray-800';
  },

  // Calculate mood trend (placeholder)
  calculateMoodTrend: (moodEntries) => {
    // Simple implementation - can be expanded
    if (moodEntries.length < 2) return 'stable';
    // Implementation for trend calculation would go here
    return 'stable';
  }
};

module.exports = utilities;