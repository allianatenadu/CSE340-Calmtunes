// Enhanced Navigation JavaScript
    
      // Mobile menu toggle
      const mobileMenuButton = document.getElementById('mobile-menu-button');
      const mobileMenu = document.getElementById('mobile-menu');
      
      if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
          mobileMenu.classList.toggle('hidden');
          
          // Animate hamburger icon
          const icon = mobileMenuButton.querySelector('i');
          if (mobileMenu.classList.contains('hidden')) {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
          } else {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
          }
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
          if (!mobileMenuButton.contains(e.target) && !mobileMenu.contains(e.target)) {
            mobileMenu.classList.add('hidden');
            const icon = mobileMenuButton.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
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
   