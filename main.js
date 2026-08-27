/* =============================================================
   SMART3DX — Landing Page (Ebook CAD 3D)
   Navegação, animações, validação e envio do formulário
   ============================================================= */
'use strict';

const EBOOK_URL = 'ebook/9-criterios-para-ajudar-na-escolha-de-um-sistema-cad-3d.pdf';
const ENDPOINT = 'kommo-lead.php';

/* ---- NAVEGAÇÃO MOBILE ---- */
const navToggle = document.getElementById('nav-toggle');
const mainNav   = document.getElementById('main-nav');

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
    const s = navToggle.querySelectorAll('span');
    s[0].style.transform = open ? 'translateY(7px) rotate(45deg)' : '';
    s[1].style.opacity   = open ? '0' : '';
    s[2].style.transform = open ? 'translateY(-7px) rotate(-45deg)' : '';
  });
  mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.querySelectorAll('span').forEach(sp => { sp.style.transform = ''; sp.style.opacity = ''; });
    });
  });
}

/* ---- HEADER STICKY ---- */
const header = document.getElementById('site-header');
const onScroll = () => {
  if (header) header.classList.toggle('scrolled', window.scrollY > 40);
  const btt = document.getElementById('back-to-top');
  if (btt) btt.classList.toggle('visible', window.scrollY > 500);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---- VOLTAR AO TOPO ---- */
const backToTop = document.getElementById('back-to-top');
if (backToTop) backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ---- FADE-UP AO ROLAR ---- */
const fadeEls = document.querySelectorAll('.pain-card, .learn-card, .pillar, .faq-item, .mini-book, .auth-copy, .head');
fadeEls.forEach(el => el.classList.add('fade-up'));
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
fadeEls.forEach(el => io.observe(el));

/* ---- FAQ ACCORDION ---- */
const faqItems = document.querySelectorAll('.faq-item');
faqItems.forEach(item => {
  const btn = item.querySelector('.faq-q');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    faqItems.forEach(i => { i.classList.remove('open'); const b = i.querySelector('.faq-q'); if (b) b.setAttribute('aria-expanded', 'false'); });
    if (!isOpen) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
  });
});

/* ---- MÁSCARA DE TELEFONE ---- */
const telInput = document.getElementById('telefone');
if (telInput) {
  telInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 10) v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    else v = v.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
    e.target.value = v;
  });
}

/* ---- VALIDAÇÃO ---- */
const form        = document.getElementById('lead-form');
const submitBtn   = document.getElementById('submit-btn');
const formSuccess = document.getElementById('form-success');

const showError  = (id, msg) => { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.add('show'); } };
const clearError = (id) => { const el = document.getElementById(id); if (el) { el.textContent = ''; el.classList.remove('show'); } };
const mark   = (f) => f && f.classList.add('error');
const unmark = (f) => f && f.classList.remove('error');
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function validateForm() {
  let ok = true;

  const nome = document.getElementById('nome');
  if (!nome.value.trim() || nome.value.trim().length < 2) { showError('erro-nome', 'Informe seu nome completo.'); mark(nome); ok = false; }
  else { clearError('erro-nome'); unmark(nome); }

  const empresa = document.getElementById('empresa');
  if (!empresa.value.trim()) { showError('erro-empresa', 'Informe o nome da empresa.'); mark(empresa); ok = false; }
  else { clearError('erro-empresa'); unmark(empresa); }

  const email = document.getElementById('email');
  if (!email.value.trim() || !validEmail(email.value.trim())) { showError('erro-email', 'Informe um e-mail válido.'); mark(email); ok = false; }
  else { clearError('erro-email'); unmark(email); }

  const tel = document.getElementById('telefone');
  if (tel.value.replace(/\D/g, '').length < 10) { showError('erro-telefone', 'Informe um WhatsApp válido com DDD.'); mark(tel); ok = false; }
  else { clearError('erro-telefone'); unmark(tel); }

  const lgpd = document.getElementById('lgpd');
  if (!lgpd.checked) { showError('erro-lgpd', 'Você precisa aceitar os termos para continuar.'); ok = false; }
  else { clearError('erro-lgpd'); }

  return ok;
}

['nome', 'empresa', 'email', 'telefone'].forEach(id => {
  const f = document.getElementById(id);
  if (!f) return;
  f.addEventListener('blur', validateForm);
  f.addEventListener('input', () => { if (f.classList.contains('error')) validateForm(); });
});

/* ---- DOWNLOAD DO EBOOK ---- */
function triggerDownload() {
  const a = document.createElement('a');
  a.href = EBOOK_URL;
  a.download = '9-criterios-para-escolher-o-cad-3d-ideal.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---- ENVIO ---- */
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      const first = form.querySelector('.error');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline-flex';

    const payload = {
      nome: document.getElementById('nome').value.trim(),
      empresa: document.getElementById('empresa').value.trim(),
      email: document.getElementById('email').value.trim(),
      telefone: document.getElementById('telefone').value.trim(),
      produto_interesse: 'Ebook - 9 Critérios CAD 3D',
      origem: 'Landing Page Ebook CAD 3D',
      mensagem: 'Download do ebook: 9 Critérios Para Escolher o Sistema CAD 3D Ideal'
    };

    try {
      const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

const result = await res.json();

if (!res.ok || !result.success) {
  console.error('Resposta da integração:', result);

  throw new Error(
    result.message || 'Falha ao cadastrar o lead no Kommo.'
  );
}

if (result.success) {
        form.style.display = 'none';
        formSuccess.style.display = 'block';
        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(triggerDownload, 600);

        if (window.dataLayer) {
          window.dataLayer.push({ event: 'lead_form_submit', lead_empresa: payload.empresa, lead_produto: payload.produto_interesse });
        }
      } else { throw new Error('Falha no envio'); }
    } catch (err) {
      console.error('Erro ao enviar formulário:', err);
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').style.display = 'inline-flex';
      submitBtn.querySelector('.btn-loading').style.display = 'none';

      if (!form.querySelector('.submit-error')) {
        const a = document.createElement('div');
        a.className = 'submit-error';
        a.style.cssText = 'background:#fff0f0;border:1px solid #fca5a5;color:#c0392b;padding:12px 16px;border-radius:8px;font-size:.86rem;margin-top:12px;text-align:center;';
        a.innerHTML = '<i class="fas fa-exclamation-circle"></i> Não foi possível enviar agora. Tente novamente ou fale conosco no WhatsApp.';
        form.appendChild(a);
        setTimeout(() => a.remove(), 6000);
      }
    }
  });
}

/* ---- SCROLL SUAVE COM OFFSET DO HEADER ---- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const id = anchor.getAttribute('href');
    if (id === '#') return;
    const target = document.querySelector(id);
    if (target) {
      e.preventDefault();
      const offset = (header ? header.offsetHeight : 0) + 14;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

/* ---- NAV ATIVO ---- */
const navLinks = document.querySelectorAll('.nav a[href^="#"]');
const sections = document.querySelectorAll('section[id]');
const navIO = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(l => l.classList.toggle('active-nav', l.getAttribute('href') === `#${entry.target.id}`));
    }
  });
}, { threshold: 0.4 });
sections.forEach(s => navIO.observe(s));

console.log('%c Smart3DX · Ebook CAD 3D LP ', 'background:#002783;color:#10B8FC;font-weight:bold;padding:4px 8px;border-radius:4px;');
