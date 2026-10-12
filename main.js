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
  // Sends the request to the Apex contact-forms API (same service used by
  // other Apex client sites). If it fails, the patient is shown a prefilled
  // email link and the phone number, so no request is silently lost.
  var CONTACT_ENDPOINT = 'https://rlwfhxghcb.execute-api.us-east-2.amazonaws.com/contact';
  var CONTACT_EMAIL = 'aci@acihearing.com';
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    var statusEl = document.getElementById('contact-form-status');

    var fieldVal = function(id) {
      var el = contactForm.querySelector('#' + id);
      return el ? el.value.trim() : '';
    };

    var buildMailto = function(d) {
      var subject = 'Appointment request from ' + d.first_name + ' ' + d.last_name;
      var body = 'Name: ' + d.first_name + ' ' + d.last_name + '\n' +
        'Email: ' + d.email + '\n' +
        'Phone: ' + d.phone + '\n' +
        'Reason for visit: ' + (d.reason || 'Not given') + '\n\n' +
        (d.message || '');
      return 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
    };

    var showFailure = function(d) {
      if (!statusEl) return;
      statusEl.className = 'form-status form-status--error';
      statusEl.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = 'Sorry, we could not send your request. Your details are still here. Please email or call us and we will help you.';
      var mail = document.createElement('a');
      mail.className = 'btn btn--primary';
      mail.href = buildMailto(d);
      mail.textContent = 'Email your request';
      var call = document.createElement('a');
      call.className = 'btn btn--outline';
      call.href = 'tel:3372239448';
      call.textContent = 'Call 337-223-9448';
      var actions = document.createElement('div');
      actions.className = 'form-status__actions';
      actions.appendChild(mail);
      actions.appendChild(call);
      statusEl.appendChild(p);
      statusEl.appendChild(actions);
      statusEl.focus();
    };

    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();

      // Basic validation
      var required = contactForm.querySelectorAll('[required]');
      var isValid = true;
      required.forEach(function(input) {
        if (!input.value.trim()) {
          isValid = false;
          input.style.borderColor = '#C0392B';
          input.setAttribute('aria-invalid', 'true');
        } else {
          input.style.borderColor = '';
          input.removeAttribute('aria-invalid');
        }
      });

      // Email validation
      var email = contactForm.querySelector('[type="email"]');
      if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        isValid = false;
        email.style.borderColor = '#C0392B';
        email.setAttribute('aria-invalid', 'true');
      }

      if (!isValid) {
        if (statusEl) {
          statusEl.className = 'form-status form-status--error';
          statusEl.textContent = 'Please fill in the fields marked with a star and use a valid email.';
        }
        return;
      }

      var reasonSelect = contactForm.querySelector('#reason');
      var reasonLabel = (reasonSelect && reasonSelect.value) ? reasonSelect.options[reasonSelect.selectedIndex].text : '';
      var honeypot = contactForm.querySelector('input[name="website"]');
      var data = {
        client: 'aci',
        first_name: fieldVal('first-name'),
        last_name: fieldVal('last-name'),
        email: fieldVal('email'),
        phone: fieldVal('phone'),
        reason: reasonLabel,
        message: fieldVal('message'),
        website: honeypot ? honeypot.value : ''
      };

      var submitBtn = contactForm.querySelector('button[type="submit"]');
      var btnText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }
      if (statusEl) { statusEl.className = 'form-status'; statusEl.textContent = 'Sending your request...'; }

      var resetBtn = function() {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = btnText; }
      };

      if (!window.fetch) { resetBtn(); showFailure(data); return; }

      fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function(res) {
          return res.json().catch(function() { return { ok: false }; }).then(function(j) {
            return res.ok && j && j.ok;
          });
        })
        .then(function(sent) {
          if (sent) {
            // Only show success after the server confirms it got the request
            contactForm.reset();
            contactForm.style.display = 'none';
            if (statusEl) { statusEl.className = 'form-status'; statusEl.textContent = ''; }
            var success = document.querySelector('.form-success');
            if (success) { success.classList.add('active'); success.focus(); }
          } else {
            resetBtn();
            showFailure(data);
          }
        })
        .catch(function() {
          resetBtn();
          showFailure(data);
        });
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
