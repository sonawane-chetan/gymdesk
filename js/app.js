/**
 * n8n Gym Manager Automation — Master Application Controller
 * Initializes all modules and handles global navigation & interactions
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('n8n Gym Manager Automation Web Platform Initializing...');

  // Initialize individual modules
  if (typeof Calculator !== 'undefined' && Calculator.init) Calculator.init();
  else if (window.Calculator && window.Calculator.init) window.Calculator.init();

  if (typeof Sandbox !== 'undefined' && Sandbox.init) Sandbox.init();
  else if (window.Sandbox && window.Sandbox.init) window.Sandbox.init();

  if (typeof Workflows !== 'undefined' && Workflows.init) Workflows.init();
  else if (window.Workflows && window.Workflows.init) window.Workflows.init();

  if (typeof Linter !== 'undefined' && Linter.init) Linter.init();
  else if (window.Linter && window.Linter.init) window.Linter.init();

  if (typeof Proposal !== 'undefined' && Proposal.init) Proposal.init();
  else if (window.Proposal && window.Proposal.init) window.Proposal.init();

  // Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('btn-mobile-menu');
  const mobileMenuNav = document.getElementById('mobile-nav-menu');

  if (mobileMenuBtn && mobileMenuNav) {
    mobileMenuBtn.addEventListener('click', function() {
      const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
      mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
      mobileMenuNav.classList.toggle('hidden');
    });

    // Close menu when clicking nav links
    mobileMenuNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenuNav.classList.add('hidden');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Set today's date in member intake start-date input
  const startDateInput = document.getElementById('input-start-date');
  const storeInstance = (typeof Store !== 'undefined') ? Store : window.Store;
  if (startDateInput && storeInstance && storeInstance.getTodayIST) {
    startDateInput.value = storeInstance.getTodayIST();
  }

  // Smooth scroll with offset for sticky header
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  console.log('n8n Gym Manager Platform Loaded Successfully.');
});
