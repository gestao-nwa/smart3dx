/* =============================================================
   SMART3DX — Landing Page (Ebook CAD 3D)
   Navegação, animações, validação e envio do formulário
   ============================================================= */
'use strict';

const EBOOK_URL = 'ebook/9-criterios-para-ajudar-na-escolha-de-um-sistema-cad-3d.pdf';

/* ---------------------------------------------
   ENDEREÇO DA INTEGRAÇÃO
   ---------------------------------------------
   Resolvido a partir do endereço da própria página, para que o envio
   nunca vire uma requisição "entre origens" — o navegador bloqueia
   esse caso sem aviso nenhum.
--------------------------------------------- */
const ENDPOINT = new URL('kommo-lead.php', document.baseURI).href;


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
  contato: 'e gostaria de falar com um especialista da Smart3DX.',
  ebook: 'e baixei o ebook dos 9 critérios para escolher o CAD 3D.',
  sucesso: 'Acabei de baixar o ebook dos 9 critérios e gostaria de falar com um especialista.',
  flutuante: 'e gostaria de tirar uma dúvida sobre CAD 3D.',
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
/* Envia o lead com tempo limite e nova tentativa.
   Uma oscilação de rede não pode custar um lead. */
async function enviarLead(payload, tentativas = 3) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), 20000);

    try {
      const response = await fetch(ENDPOINT, {
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
      mensagem: 'Download do ebook: 9 Critérios Para Escolher o Sistema CAD 3D Ideal',

      // Origem real do visitante. O servidor decide a partir daqui.
      tracking: Smart3DXTracking.obterDados()
    };

    try {
      const result = await enviarLead(payload);

      form.style.display = 'none';
      formSuccess.style.display = 'block';
      formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Reaplica a mensagem do WhatsApp na tela de sucesso.
      aplicarMensagensWhatsApp();

      setTimeout(triggerDownload, 600);

      if (window.dataLayer) {
        window.dataLayer.push({
          event: 'lead_form_submit',
          lead_empresa: payload.empresa,
          lead_produto: payload.produto_interesse,
          lead_origem: result.origem || Smart3DXTracking.origem,
          lead_utm_source: payload.tracking.utm_source || '',
          lead_utm_campaign: payload.tracking.utm_campaign || '',
          kommo_lead_id: result.lead_id || null
        });
      }
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
