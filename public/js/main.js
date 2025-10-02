// Enhanced Navigation JavaScript
    
      // Mobile menu toggle
      const mobileMenuButton = document.getElementById('mobile-menu-button');
      const mobileMenu = document.getElementById('mobile-menu');
      
      if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
          mobileMenu.classList.toggle('hidden');
          
          // Animate hamburger icon - SVG doesn't need class changes
          // The SVG icon is static and doesn't need animation
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
          if (!mobileMenuButton.contains(e.target) && !mobileMenu.contains(e.target)) {
            mobileMenu.classList.add('hidden');
            // SVG icon doesn't need class changes
          }
        });
      }

      // Enhanced dropdown behavior for better UX
      const dropdowns = document.querySelectorAll('.group');
      
      dropdowns.forEach(dropdown => {
        let timeout;
        
        dropdown.addEventListener('mouseenter', () => {
          clearTimeout(timeout);
        });
        
        dropdown.addEventListener('mouseleave', () => {
          timeout = setTimeout(() => {
            // Additional cleanup if needed
          }, 150);
        });
      });

      // Add active state to current page
      const currentPath = window.location.pathname;
      const navLinks = document.querySelectorAll('.nav-link, .dropdown-item, .mobile-nav-item');
      
      navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
          link.classList.add('active');
        }
      });

      // Smooth scroll for anchor links
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          const target = document.querySelector(this.getAttribute('href'));
          if (target) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        });
      });

      // Add loading states to forms
      document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function() {
          const submitButton = this.querySelector('button[type="submit"], input[type="submit"]');
          if (submitButton) {
            submitButton.disabled = true;
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Loading...';
            
            // Re-enable after 5 seconds as fallback
            setTimeout(() => {
              submitButton.disabled = false;
              submitButton.textContent = originalText;
            }, 5000);
          }
        });
      });
   
      //<!-- Flash Message JavaScript -->
    
      document.addEventListener('DOMContentLoaded', function() {
        // Handle flash message auto-dismiss and close buttons
        const flashMessages = document.querySelectorAll('.flash-message');
        
        flashMessages.forEach(function(message) {
          // Auto-dismiss after 5 seconds
          setTimeout(function() {
            dismissFlashMessage(message);
          }, 5000);
          
          // Handle manual close button
          const closeButton = message.querySelector('.flash-close');
          if (closeButton) {
            closeButton.addEventListener('click', function() {
              dismissFlashMessage(message);
            });
          }
        });
        
        function dismissFlashMessage(message) {
          message.style.transition = 'all 0.3s ease-out';
          message.style.transform = 'translateY(-10px)';
          message.style.opacity = '0';
          
          setTimeout(function() {
            message.remove();
            
            // Check if container is empty and hide it
            const container = document.getElementById('flash-container');
            if (container && container.children.length === 0) {
              container.style.display = 'none';
            }
          }, 300);
        }
        
        // Handle mobile menu toggle
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (mobileMenuButton && mobileMenu) {
          mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
          });
        }
      });
    