/* =============================================
   SMART3DX – SOLIDWORKS Design Landing Page
   Main JavaScript
   ============================================= */

'use strict';

const KOMMO_ENDPOINT = 'https://lp.smart3dx.com.br/kommo-lead.php';

// ---- MOBILE NAVIGATION ----
const navToggle = document.getElementById('nav-toggle');
const mainNav   = document.getElementById('main-nav');

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
    // Animate hamburger to X
    const spans = navToggle.querySelectorAll('span');
    if (isOpen) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    }
  });

  // Close nav on link click
  mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      navToggle.querySelectorAll('span').forEach(s => {
        s.style.transform = '';
        s.style.opacity = '';
      });
    });
  });
}

// ---- STICKY HEADER SCROLL EFFECT ----
const header = document.getElementById('site-header');
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header && header.classList.add('scrolled');
  } else {
    header && header.classList.remove('scrolled');
  }
}, { passive: true });

// Add scrolled style
const style = document.createElement('style');
style.textContent = `
  .site-header.scrolled {
    box-shadow: 0 4px 20px rgba(0,23,61,0.5);
  }
`;
document.head.appendChild(style);

// ---- BACK TO TOP ----
const backToTop = document.getElementById('back-to-top');
window.addEventListener('scroll', () => {
  if (backToTop) {
    if (window.scrollY > 400) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  }
}, { passive: true });

if (backToTop) {
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ---- FADE-UP SCROLL ANIMATIONS ----
const fadeElements = document.querySelectorAll(
  '.pain-card, .solution-item, .diff-card, .product-card, .step-item, .faq-item'
);

fadeElements.forEach(el => el.classList.add('fade-up'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

fadeElements.forEach(el => observer.observe(el));

// ---- FAQ ACCORDION ----
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
  const btn = item.querySelector('.faq-question');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');

    // Close all
    faqItems.forEach(i => {
      i.classList.remove('open');
      const b = i.querySelector('.faq-question');
      if (b) b.setAttribute('aria-expanded', 'false');
    });

    // Toggle clicked
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

// ---- PHONE MASK ----
const telInput = document.getElementById('telefone');
if (telInput) {
  telInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length <= 10) {
      v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else {
      v = v.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
    }
    e.target.value = v;
  });
}

// ---- FORM VALIDATION & SUBMISSION ----
const form = document.getElementById('lead-form');
const submitBtn = document.getElementById('submit-btn');
const formSuccess = document.getElementById('form-success');

function showError(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
    el.classList.add('show');
  }
}
function clearError(id) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = '';
    el.classList.remove('show');
  }
}
function setFieldError(field) {
  field.classList.add('error');
}
function clearFieldError(field) {
  field.classList.remove('error');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm() {
  let valid = true;

  // Nome
  const nome = document.getElementById('nome');
  if (!nome.value.trim() || nome.value.trim().length < 2) {
    showError('erro-nome', 'Por favor, informe seu nome completo.');
    setFieldError(nome);
    valid = false;
  } else {
    clearError('erro-nome');
    clearFieldError(nome);
  }

  // Email
  const email = document.getElementById('email');
  if (!email.value.trim() || !validateEmail(email.value.trim())) {
    showError('erro-email', 'Informe um e-mail válido.');
    setFieldError(email);
    valid = false;
  } else {
    clearError('erro-email');
    clearFieldError(email);
  }

  // Empresa
  const empresa = document.getElementById('empresa');
  if (!empresa.value.trim()) {
    showError('erro-empresa', 'Informe o nome da empresa.');
    setFieldError(empresa);
    valid = false;
  } else {
    clearError('erro-empresa');
    clearFieldError(empresa);
  }

  // Cargo
  const cargo = document.getElementById('cargo');
  if (!cargo.value) {
    showError('erro-cargo', 'Selecione seu cargo.');
    setFieldError(cargo);
    valid = false;
  } else {
    clearError('erro-cargo');
    clearFieldError(cargo);
  }

  // Telefone
  const telefone = document.getElementById('telefone');
  const telClean = telefone.value.replace(/\D/g, '');
  if (telClean.length < 10) {
    showError('erro-telefone', 'Informe um telefone válido com DDD.');
    setFieldError(telefone);
    valid = false;
  } else {
    clearError('erro-telefone');
    clearFieldError(telefone);
  }

  // LGPD
  const lgpd = document.getElementById('lgpd');
  if (!lgpd.checked) {
    showError('erro-lgpd', 'Você precisa aceitar os termos para continuar.');
    valid = false;
  } else {
    clearError('erro-lgpd');
  }

  return valid;
}

// Live validation on blur
['nome','email','empresa','cargo','telefone'].forEach(fieldId => {
  const field = document.getElementById(fieldId);
  if (field) {
    field.addEventListener('blur', () => validateForm());
    field.addEventListener('input', () => {
      if (field.classList.contains('error')) validateForm();
    });
  }
});

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      // Scroll to first error
      const firstError = form.querySelector('.error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'flex';

    const payload = {
      nome: document.getElementById('nome').value.trim(),
      email: document.getElementById('email').value.trim(),
      empresa: document.getElementById('empresa').value.trim(),
      cargo: document.getElementById('cargo').value,
      telefone: document.getElementById('telefone').value.trim(),
      produto_interesse: document.getElementById('produto').value,
      mensagem: document.getElementById('ebook-check').checked ? 'Solicitou Orçamento do SOLIDWORKS Design' : ''
    };

    try {
      const response = await fetch(KOMMO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...payload,
          origem: 'Landing Page Orçamento SOLIDWORKS'
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('Resposta da integração:', result);
        throw new Error(
          result.message || 'Falha ao cadastrar o lead no Kommo.'
        );
      }

      form.style.display = 'none';
      formSuccess.style.display = 'block';
      formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if (window.dataLayer) {
        window.dataLayer.push({
          event: 'lead_form_submit',
          lead_cargo: payload.cargo,
          lead_produto: payload.produto_interesse,
          kommo_lead_id: result.lead_id || null
        });
      }
    } catch (err) {
      console.error('Erro ao enviar formulário:', err);
      // Re-enable button
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').style.display = 'flex';
      submitBtn.querySelector('.btn-loading').style.display = 'none';

      // Show friendly error
      const existingAlert = form.querySelector('.submit-error');
      if (!existingAlert) {
        const alert = document.createElement('div');
        alert.className = 'submit-error';
        alert.style.cssText = `
          background: #fef0f0;
          border: 1px solid #fca5a5;
          color: #c0392b;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 0.88rem;
          margin-top: 12px;
          text-align: center;
        `;
        alert.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ocorreu um erro ao enviar. Por favor, tente novamente ou entre em contato via WhatsApp.';
        form.appendChild(alert);
        setTimeout(() => alert.remove(), 6000);
      }
    }
  });
}

// ---- SMOOTH SCROLL FOR ANCHOR LINKS ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const headerHeight = header ? header.offsetHeight : 0;
      const targetPos = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
      window.scrollTo({ top: targetPos, behavior: 'smooth' });
    }
  });
});

// ---- ACTIVE NAV HIGHLIGHTING ----
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.main-nav a[href^="#"]');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.classList.toggle(
          'active-nav',
          link.getAttribute('href') === `#${entry.target.id}`
        );
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));

// Add active-nav style
const navStyle = document.createElement('style');
navStyle.textContent = `.main-nav a.active-nav { color: var(--blue-cyan) !important; }`;
document.head.appendChild(navStyle);

// ---- COUNTER ANIMATION FOR STATS ----
function animateCounter(el, target, suffix = '') {
  let current = 0;
  const increment = target / 60;
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.round(current) + suffix;
  }, 20);
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const nums = entry.target.querySelectorAll('.stat-num');
      const values = [33, 28, 99];
      const suffixes = ['%', '%', '%'];
      nums.forEach((el, i) => {
        animateCounter(el, values[i], suffixes[i]);
      });
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) statsObserver.observe(heroStats);

console.log('%c Smart3DX | SOLIDWORKS Design LP ', 'background:#002783;color:#10B8FC;font-weight:bold;padding:4px 8px;border-radius:4px;');
