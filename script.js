/* =========================================================
   PORTFOLIO SCRIPT
   - Mobile nav toggle
   - Active nav-link highlight on scroll
   - Auto-updating footer year
   - Click-to-copy email feedback
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- Mobile nav toggle ---- */
  const navToggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('primary-nav');

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      navToggle.classList.toggle('is-open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close mobile menu after selecting a link
    nav.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('is-open');
        navToggle.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---- Active nav-link highlight while scrolling ---- */
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  if (sections.length && navLinks.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
            });
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );

    sections.forEach((section) => observer.observe(section));
  }

  /* ---- Footer year ---- */
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ---- Click-to-copy email feedback ---- */
  const emailBtn = document.getElementById('email-btn');
  if (emailBtn) {
    const originalText = emailBtn.textContent;
    emailBtn.addEventListener('click', (e) => {
      const email = emailBtn.textContent.trim();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(email).then(() => {
          emailBtn.textContent = 'Copied!';
          setTimeout(() => { emailBtn.textContent = originalText; }, 1600);
        });
      }
      // mailto: link still fires normally — copy is a bonus, not a blocker
    });
  }

});
