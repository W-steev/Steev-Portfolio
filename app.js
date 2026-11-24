// ===== Steev Portfolio – interactions =====

// ---------- Mobile menu ----------
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');

function setMenu(open) {
  navMenu.classList.toggle('open', open);
  navToggle.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open);
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

navToggle.addEventListener('click', () => {
  setMenu(!navMenu.classList.contains('open'));
});

// Close the menu after tapping a link
navMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

// ---------- Header background on scroll ----------
const header = document.getElementById('header');
function onScroll() {
  header.classList.toggle('scrolled', window.scrollY > 20);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Highlight the menu link for the section on screen ----------
const navLinks = document.querySelectorAll('.nav-link:not(.nav-cta)');
const sections = document.querySelectorAll('main section[id]');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      navLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
      });
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });

sections.forEach((section) => sectionObserver.observe(section));

// ---------- About tabs ----------
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    panels.forEach((p) => p.classList.remove('active'));

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// ---------- Fade sections in as you scroll ----------
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// ---------- Contact form (sends to your email via FormSubmit) ----------
const form = document.getElementById('contact-form');
const statusText = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');
const submitLabel = submitBtn.innerHTML;

function showStatus(message, type) {
  statusText.textContent = message;
  statusText.className = 'form-status ' + type;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Simple checks before sending
  let valid = true;
  form.querySelectorAll('[required]').forEach((input) => {
    const field = input.closest('.field');
    const ok = input.value.trim() !== '' && input.checkValidity();
    field.classList.toggle('error', !ok);
    if (!ok) valid = false;
  });

  if (!valid) {
    showStatus('Please fill in your name, a valid email and a message.', 'fail');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Sending... <i class="fa-solid fa-spinner fa-spin"></i>';
  showStatus('', '');

  try {
    const ajaxUrl = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
    const response = await fetch(ajaxUrl, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    });
    const result = await response.json();

    if (response.ok && String(result.success) === 'true') {
      form.reset();
      showStatus("Thanks! Your message has been sent. I'll get back to you soon.", 'success');
      submitBtn.disabled = false;
      submitBtn.innerHTML = submitLabel;
    } else {
      console.warn('FormSubmit reply:', result);
      sendTheNormalWay();
    }
  } catch (err) {
    // The background send was blocked or failed, so use the normal way instead
    console.warn('Background send failed, using normal form submit:', err);
    sendTheNormalWay();
  }
});

// Normal form submit: the visitor goes to FormSubmit's page, then comes back here
function sendTheNormalWay() {
  showStatus('Sending you to a quick confirmation page...', '');
  HTMLFormElement.prototype.submit.call(form);
}

// Show a thank-you message when FormSubmit sends the visitor back (?sent=1)
if (new URLSearchParams(window.location.search).get('sent') === '1') {
  showStatus("Thanks! Your message has been sent. I'll get back to you soon.", 'success');
  history.replaceState(null, '', window.location.pathname + '#contact');
}

// Clear the red border once the visitor starts typing
form.querySelectorAll('input, textarea').forEach((input) => {
  input.addEventListener('input', () => input.closest('.field')?.classList.remove('error'));
});

// ---------- Footer year ----------
document.getElementById('year').textContent = new Date().getFullYear();
