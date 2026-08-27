/* =============================================
   SMART3DX – SOLIDWORKS Design Landing Page
   Main JavaScript
   ============================================= */

'use strict';

/* ---------------------------------------------
   ENDEREÇO DA INTEGRAÇÃO
   ---------------------------------------------
   O envio é feito para o mesmo endereço da página.
   Um endereço absoluto tornava o envio "entre origens" sempre que o
   visitante chegava por http:// ou por www., e o navegador bloqueava
   o formulário sem aviso.
--------------------------------------------- */
const KOMMO_ENDPOINT = new URL('kommo-lead.php', document.baseURI).href;


/* =============================================
   RASTREIO DE ORIGEM (UTMs)
   =============================================
   Guarda a origem do visitante e a mantém durante toda a navegação,
   inclusive se ele trocar de página dentro do site.

   - Primeiro contato: gravado uma vez e preservado por 90 dias.
   - Último contato: atualizado sempre que chegam UTMs novas.
   ============================================= */

const Smart3DXTracking = (() => {
  'use strict';

  const CHAVE_ULTIMO   = 's3dx_utm_ultimo';
  const CHAVE_PRIMEIRO = 's3dx_utm_primeiro';
  const VALIDADE_DIAS  = 90;

  const PARAMETROS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'gclid', 'gbraid', 'wbraid', 'gad_source',
    'fbclid', 'ttclid', 'li_fat_id', 'msclkid'
  ];

  /* Endereços do próprio site.
     Links para estes domínios recebem as UTMs, mesmo escritos por extenso. */
  const HOSTS_INTERNOS = [
    'lp.smart3dx.com.br',
    'www.lp.smart3dx.com.br',
    'smart3dx.com.br',
    'www.smart3dx.com.br'
  ];

  function ehHostInterno(host) {
    return host === window.location.hostname
      || HOSTS_INTERNOS.includes(host);
  }

  function lerArmazenamento(chave) {
    try {
      const bruto = localStorage.getItem(chave);
      if (!bruto) return null;

      const dados = JSON.parse(bruto);
      const validade = VALIDADE_DIAS * 24 * 60 * 60 * 1000;

      if (!dados || !dados.gravado_em) return null;
      if (Date.now() - dados.gravado_em > validade) return null;

      return dados;
    } catch (e) {
      return null;
    }
  }

  function gravarArmazenamento(chave, dados) {
    try {
      localStorage.setItem(chave, JSON.stringify(dados));
    } catch (e) {
      // Navegação anônima ou armazenamento cheio. Segue sem persistir.
    }
  }

  function lerParametrosDaUrl() {
    const parametros = {};

    try {
      const busca = new URLSearchParams(window.location.search);

      PARAMETROS.forEach(nome => {
        const valor = busca.get(nome);
        if (valor) parametros[nome] = valor.trim().slice(0, 300);
      });
    } catch (e) {
      // URL malformada. Trata como acesso sem UTM.
    }

    return parametros;
  }

  function lerGaClientId() {
    try {
      const cookie = document.cookie
        .split('; ')
        .find(item => item.startsWith('_ga='));

      if (!cookie) return '';

      // Formato do cookie: GA1.1.123456789.1712345678
      const partes = cookie.split('.');
      if (partes.length < 4) return '';

      return partes.slice(-2).join('.');
    } catch (e) {
      return '';
    }
  }

  function referenciadorExterno() {
    try {
      if (!document.referrer) return '';

      const origem = new URL(document.referrer).hostname;
      if (origem === window.location.hostname) return '';

      return document.referrer.slice(0, 300);
    } catch (e) {
      return '';
    }
  }

  /* Identifica a origem comercial do visitante.
     Espelha a mesma regra aplicada no servidor. */
  function detectarOrigem(dados) {
    const texto = (valor) => String(valor || '').toLowerCase();
    const tem = (chave) => Boolean(dados[chave]);

    const contem = (alvo, lista) =>
      Boolean(alvo) && lista.some(item => alvo.includes(item));

    const source   = texto(dados.utm_source);
    const medium   = texto(dados.utm_medium);
    const referrer = texto(dados.referrer);

    if (tem('gclid') || tem('gbraid') || tem('wbraid') || tem('gad_source')) {
      return 'Anuncio Google';
    }
    if (tem('fbclid'))    return 'Anuncio Meta';
    if (tem('ttclid'))    return 'Anuncio TikTok';
    if (tem('li_fat_id')) return 'Anuncio Linkedin';

    /* Quem chega por busca ou por um link comum não traz utm_source.
       Se a UTM existe, alguém marcou aquele link de propósito: o padrão
       passa a ser a campanha da plataforma. Só volta a ser orgânico
       quando a própria mídia diz que não é anúncio. */
    const midiasNaoPagas = [
      'organic', 'organico', 'orgânico', 'seo', 'natural',
      'bio', 'linkbio', 'link-bio', 'linktree',
      'perfil', 'profile', 'post', 'postagem',
      'email', 'e-mail', 'mail', 'newsletter',
      'assinatura', 'signature', 'whatsapp', 'wpp'
    ];

    const naoPago = contem(medium, midiasNaoPagas);

    const grupos = [
      ['Anuncio Meta',     ['facebook', 'fb', 'meta', 'instagram', 'ig']],
      ['Anuncio Google',   ['google', 'adwords', 'gdn', 'youtube', 'yt']],
      ['Anuncio Linkedin', ['linkedin']],
      ['Anuncio TikTok',   ['tiktok', 'tik_tok']]
    ];

    for (const [origem, termos] of grupos) {
      if (contem(source, termos)) return naoPago ? 'Organico' : origem;
    }

    if (
      contem(source, ['indica', 'parceir', 'partner', 'referral']) ||
      contem(medium, ['indica', 'parceir', 'partner', 'referral'])
    ) {
      return 'Indicação';
    }

    if (
      contem(source, ['sdr', 'outbound', 'prospec']) ||
      contem(medium, ['sdr', 'outbound', 'prospec'])
    ) {
      return 'Lista SDR';
    }

    if (contem(medium, ['organic', 'organico', 'orgânico', 'seo', 'social'])) {
      return 'Organico';
    }

    if (!source && !medium && referrer) {
      const buscadores = [
        'google.', 'bing.', 'search.yahoo', 'duckduckgo',
        'ecosia.', 'yandex.', 'brave.com', 'perplexity.', 'chatgpt.'
      ];
      const redes = [
        'facebook.', 'instagram.', 'linkedin.', 'tiktok.',
        'youtube.', 't.co', 'l.facebook', 'lm.facebook'
      ];

      if (contem(referrer, buscadores) || contem(referrer, redes)) {
        return 'Organico';
      }
    }

    return 'Landing Page';
  }

  // ---- Captura no carregamento da página ----

  const parametrosAtuais = lerParametrosDaUrl();
  const temUtmNaUrl = Object.keys(parametrosAtuais).length > 0;

  const armazenadoUltimo   = lerArmazenamento(CHAVE_ULTIMO);
  const armazenadoPrimeiro = lerArmazenamento(CHAVE_PRIMEIRO);

  let ultimo;

  if (temUtmNaUrl) {
    ultimo = Object.assign({}, parametrosAtuais, {
      referrer: referenciadorExterno(),
      landing_page: window.location.href.slice(0, 300),
      gravado_em: Date.now()
    });

    gravarArmazenamento(CHAVE_ULTIMO, ultimo);
  } else if (armazenadoUltimo) {
    ultimo = armazenadoUltimo;
  } else {
    ultimo = {
      referrer: referenciadorExterno(),
      landing_page: window.location.href.slice(0, 300),
      gravado_em: Date.now()
    };

    gravarArmazenamento(CHAVE_ULTIMO, ultimo);
  }

  const primeiro = armazenadoPrimeiro || ultimo;

  if (!armazenadoPrimeiro) {
    gravarArmazenamento(CHAVE_PRIMEIRO, primeiro);
  }

  const origem = detectarOrigem(ultimo);

  function obterDados() {
    const dados = {
      referrer: ultimo.referrer || referenciadorExterno(),
      landing_page: ultimo.landing_page || window.location.href.slice(0, 300),
      ga_client_id: lerGaClientId(),
      origem_detectada: origem,

      first_utm_source: primeiro.utm_source || '',
      first_utm_medium: primeiro.utm_medium || '',
      first_utm_campaign: primeiro.utm_campaign || '',
      first_referrer: primeiro.referrer || '',
      first_landing_page: primeiro.landing_page || '',
      primeiro_acesso: primeiro.gravado_em
        ? new Date(primeiro.gravado_em).toISOString()
        : ''
    };

    PARAMETROS.forEach(nome => {
      if (ultimo[nome]) dados[nome] = ultimo[nome];
    });

    // Remove chaves vazias para não poluir o CRM.
    Object.keys(dados).forEach(chave => {
      if (!dados[chave]) delete dados[chave];
    });

    return dados;
  }

  /* Repassa as UTMs para os links internos (ex.: /lp do e-book),
     para que a origem não se perca ao trocar de página. */
  function propagarParaLinksInternos() {
    const repassar = {};

    PARAMETROS.forEach(nome => {
      if (ultimo[nome]) repassar[nome] = ultimo[nome];
    });

    if (Object.keys(repassar).length === 0) return;

    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href') || '';

      /* Âncoras internas (#secao), e-mail e telefone ficam intactos.
         Reescrevê-los quebraria a rolagem suave e o menu. */
      if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return;

      /* Arquivos para download não precisam de UTM. */
      if (/\.(pdf|zip|docx?|xlsx?|pptx?|csv|jpe?g|png|webp|svg|mp4)$/i.test(
        href.split('?')[0]
      )) {
        return;
      }

      let destino;

      try {
        destino = new URL(href, document.baseURI);
      } catch (e) {
        return;
      }

      if (!ehHostInterno(destino.hostname)) return;
      if (!/^https?:$/.test(destino.protocol)) return;

      // Link para a própria página: nada a repassar.
      if (
        destino.hostname === window.location.hostname
        && destino.pathname === window.location.pathname
      ) {
        return;
      }

      Object.keys(repassar).forEach(nome => {
        if (!destino.searchParams.has(nome)) {
          destino.searchParams.set(nome, repassar[nome]);
        }
      });

      link.setAttribute('href', destino.href);
    });
  }

  return {
    origem,
    obterDados,
    propagarParaLinksInternos
  };
})();

/* Disponível para o Google Tag Manager e para depuração. */
window.Smart3DXTracking = Smart3DXTracking;


/* =============================================
   MENSAGEM DOS LINKS DE WHATSAPP
   =============================================
   A frase enviada muda conforme a origem do visitante.
   ============================================= */

const FRASES_WHATSAPP = {
  'Anuncio Meta': 'Olá! Vim pelo anúncio de vocês no Instagram/Facebook',
  'Anuncio Google': 'Olá! Vim pelo anúncio de vocês no Google',
  'Anuncio Linkedin': 'Olá! Vim pelo anúncio de vocês no LinkedIn',
  'Anuncio TikTok': 'Olá! Vim pelo anúncio de vocês no TikTok',
  'Indicação': 'Olá! Cheguei até vocês por indicação',
  'Organico': 'Olá! Encontrei a Smart3DX na internet',
  'Lista SDR': 'Olá! Recebi um contato da Smart3DX',
  'Landing Page': 'Olá! Vim pelo site da Smart3DX'
};

const COMPLEMENTOS_WHATSAPP = {
  contato: 'e gostaria de falar com um especialista sobre o SOLIDWORKS Design.',
  formulario: 'e gostaria de um orçamento do SOLIDWORKS Design.',
  sucesso: 'Acabei de enviar meu formulário de orçamento e gostaria de adiantar o atendimento.',
  flutuante: 'e gostaria de tirar uma dúvida sobre o SOLIDWORKS Design.',
  rodape: 'e gostaria de mais informações sobre as soluções de vocês.'
};

function montarMensagemWhatsApp(contexto) {
  const origem = Smart3DXTracking.origem;
  const abertura = FRASES_WHATSAPP[origem] || FRASES_WHATSAPP['Landing Page'];
  const complemento = COMPLEMENTOS_WHATSAPP[contexto] || COMPLEMENTOS_WHATSAPP.contato;

  // O contexto de sucesso já é uma frase completa.
  const texto = contexto === 'sucesso'
    ? complemento
    : abertura + ' ' + complemento;

  const dados = Smart3DXTracking.obterDados();
  const campanha = dados.utm_campaign;

  return campanha
    ? texto + ' (campanha: ' + campanha + ')'
    : texto;
}

function aplicarMensagensWhatsApp() {
  document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]')
    .forEach(link => {
      let destino;

      try {
        destino = new URL(link.getAttribute('href'), document.baseURI);
      } catch (e) {
        return;
      }

      const contexto = link.dataset.waContexto || 'contato';
      destino.searchParams.set('text', montarMensagemWhatsApp(contexto));

      link.setAttribute('href', destino.href);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  Smart3DXTracking.propagarParaLinksInternos();
  aplicarMensagensWhatsApp();
});


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

/* Envia o lead com tempo limite e nova tentativa.
   Uma oscilação de rede não pode custar um lead. */
async function enviarLead(payload, tentativas = 3) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), 20000);

    try {
      const response = await fetch(KOMMO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controle.signal
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success) {
        return result;
      }

      console.error('Resposta da integração:', response.status, result);

      // Erro de preenchimento: repetir não resolve.
      if (response.status >= 400 && response.status < 500) {
        const erroDeValidacao = new Error(
          result.message || 'Falha ao cadastrar o lead no Kommo.'
        );
        erroDeValidacao.semNovaTentativa = true;
        throw erroDeValidacao;
      }

      ultimoErro = new Error(
        result.message || 'Falha ao cadastrar o lead no Kommo.'
      );
    } catch (err) {
      if (err && err.name === 'AbortError') {
        ultimoErro = new Error('Tempo esgotado ao enviar o formulário.');
      } else {
        ultimoErro = err;
      }

      // Erro de preenchimento não é repetido.
      if (ultimoErro && ultimoErro.semNovaTentativa) throw ultimoErro;
    } finally {
      clearTimeout(limite);
    }

    if (tentativa < tentativas) {
      await new Promise(resolve => setTimeout(resolve, tentativa * 1500));
    }
  }

  throw ultimoErro || new Error('Falha ao cadastrar o lead no Kommo.');
}

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
      mensagem: document.getElementById('ebook-check').checked ? 'Solicitou Orçamento do SOLIDWORKS Design' : '',
      origem: 'Landing Page Orçamento SOLIDWORKS',

      // Origem real do visitante. O servidor decide a partir daqui.
      tracking: Smart3DXTracking.obterDados()
    };

    try {
      const result = await enviarLead(payload);

      form.style.display = 'none';
      formSuccess.style.display = 'block';
      formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if (window.dataLayer) {
        window.dataLayer.push({
          event: 'lead_form_submit',
          lead_cargo: payload.cargo,
          lead_produto: payload.produto_interesse,
          lead_origem: result.origem || Smart3DXTracking.origem,
          lead_utm_source: payload.tracking.utm_source || '',
          lead_utm_campaign: payload.tracking.utm_campaign || '',
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
