/* ============================================
   ACI Hearing Center — Main JavaScript
   ============================================ */

(function() {
  'use strict';

  // === Mobile Nav Toggle ===
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');

  if (navToggle && nav) {
    navToggle.addEventListener('click', function() {
      const isOpen = nav.classList.toggle('nav--open');
      navToggle.setAttribute('aria-expanded', isOpen);
      navToggle.innerHTML = isOpen
        ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>'
        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>';
    });

    // Close nav when clicking a link
    nav.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        nav.classList.remove('nav--open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>';
      });
    });
  }

  // === Sticky Header Shadow ===
  var header = document.querySelector('.header');
  if (header) {
    var lastScroll = 0;
    window.addEventListener('scroll', function() {
      var scroll = window.scrollY;
      if (scroll > 10) {
        header.classList.add('header--scrolled');
      } else {
        header.classList.remove('header--scrolled');
      }
      lastScroll = scroll;
    }, { passive: true });
  }

  // === Scroll Reveal ===
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length > 0) {
    var revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(function(el) {
      revealObserver.observe(el);
    });
  }

  // === FAQ Accordion ===
  document.querySelectorAll('.faq-question').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var item = btn.closest('.faq-item');
      var answer = item.querySelector('.faq-answer');
      var isActive = item.classList.contains('active');

      // Close all others in the same container
      var container = item.parentElement;
      container.querySelectorAll('.faq-item.active').forEach(function(activeItem) {
        activeItem.classList.remove('active');
        var activeAnswer = activeItem.querySelector('.faq-answer');
        activeAnswer.style.maxHeight = '0';
        activeItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });

      if (!isActive) {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // === Contact Form Handling ===
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();

      // Basic validation
      var required = contactForm.querySelectorAll('[required]');
      var isValid = true;
      required.forEach(function(input) {
        if (!input.value.trim()) {
          isValid = false;
          input.style.borderColor = '#C0392B';
        } else {
          input.style.borderColor = '';
        }
      });

      // Email validation
      var email = contactForm.querySelector('[type="email"]');
      if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        isValid = false;
        email.style.borderColor = '#C0392B';
      }

      if (isValid) {
        // Hide form, show success
        contactForm.style.display = 'none';
        var success = document.querySelector('.form-success');
        if (success) success.classList.add('active');
      }
    });

    // Clear error styling on input
    contactForm.querySelectorAll('input, select, textarea').forEach(function(field) {
      field.addEventListener('input', function() {
        field.style.borderColor = '';
      });
    });
  }

  // === Hero slideshow auto-cycle ===
  var slideshow = document.querySelector('.hero-slideshow');
  if (slideshow) {
    var slides = slideshow.querySelectorAll('.hero-slide');
    if (slides.length > 1) {
      var idx = 0;
      setInterval(function() {
        slides[idx].classList.remove('hero-slide--active');
        idx = (idx + 1) % slides.length;
        slides[idx].classList.add('hero-slide--active');
      }, 5000);
    }
  }

  // === Smooth scroll for anchor links ===
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

})();
