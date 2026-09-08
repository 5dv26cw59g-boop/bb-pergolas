import './styles.css';
import { jsPDF } from 'jspdf';

const FALLBACK_CATALOGUE = [
  {
    id: 'pergola-bioclimatique',
    name: 'Pergola bioclimatique',
    tagline: 'Lames orientables',
    description: 'Structure aluminium sur mesure, élégance, confort et protection solaire intelligente.',
    image: '/pergola-bioclimatique-cocoon-xl-mixte-gris-anthracite-blanc-700x4987m.webp',
    materials: [
      { id: 'alu', name: 'Aluminium', priceParM2HT: 220 },
    ],
    constraints: { widthMinCm: 200, widthMaxCm: 800, depthMinCm: 200, depthMaxCm: 700, surfaceMaxM2: 45 },
    options: [
      { id: 'led', name: 'Éclairage LED', typeCalcul: 'forfait', valueHT: 180 },
      { id: 'motor', name: 'Motorisation', typeCalcul: 'forfait', valueHT: 650 },
      { id: 'store', name: 'Store latéral', typeCalcul: 'parM2', valueHT: 35 },
    ],
    sideOptions: { store: { name: 'Store vertical', priceParMLHT: 260 }, vitrage: { name: 'Baie vitrée coulissante', priceParMLHT: 690 } },
    basePriceHT: 450,
    vat: 0.2,
    featured: true,
  },
  {
    id: 'pergola-classique',
    name: 'Pergola classique',
    tagline: 'Toile rétractable',
    description: 'Protection efficace et esthétique avec une finition traditionnelle en aluminium.',
    image: 'https://bbpergolas.com/wp-content/uploads/2026/01/16F4D4B6-A771-45ED-A379-CEE252636320.png.webp',
    materials: [
      { id: 'alu', name: 'Aluminium', priceParM2HT: 195 },
    ],
    constraints: { widthMinCm: 150, widthMaxCm: 500, depthMinCm: 150, depthMaxCm: 350 },
    options: [
      { id: 'led', name: 'Éclairage LED', typeCalcul: 'forfait', valueHT: 150 },
      { id: 'toile', name: 'Toile brise-vue', typeCalcul: 'parM2', valueHT: 28 },
    ],
    sideOptions: { store: { name: 'Store vertical', priceParMLHT: 220 }, vitrage: { name: 'Paroi vitrée', priceParMLHT: 620 } },
    basePriceHT: 320,
    vat: 0.2,
    featured: false,
  },
  {
    id: 'veranda',
    name: 'Véranda',
    tagline: 'Grandes vitrines',
    description: 'Espace de vie lumineux et refiné, pensé pour le confort thermique et l’esthétique.',
    image: 'https://bbpergolas.com/wp-content/uploads/2026/01/vitre.jpeg.webp',
    materials: [
      { id: 'alu', name: 'Aluminium', priceParM2HT: 950 },
    ],
    constraints: { widthMinCm: 250, widthMaxCm: 700, depthMinCm: 250, depthMaxCm: 500 },
    options: [
      { id: 'triple', name: 'Vitrage triple', typeCalcul: 'pourcentageStructure', valueHT: 12 },
      { id: 'porte', name: 'Porte coulissante', typeCalcul: 'forfait', valueHT: 850 },
    ],
    sideOptions: { vitrage: { name: 'Baie vitrée coulissante', priceParMLHT: 760 } },
    basePriceHT: 900,
    vat: 0.2,
    featured: false,
  },
];

let CATALOGUE = [...FALLBACK_CATALOGUE];
const app = document.querySelector('#app');

function normalizeProduct(product) {
  const constraints = product.constraints ?? {
    widthMinCm: product.dimensions?.width?.min ?? 200,
    widthMaxCm: product.dimensions?.width?.max ?? 800,
    depthMinCm: product.dimensions?.depth?.min ?? 200,
    depthMaxCm: product.dimensions?.depth?.max ?? 700,
  };

  return {
    ...product,
    basePrice: product.basePriceHT ?? product.basePrice ?? 0,
    vat: product.vat ?? 0.2,
    dimensions: {
      width: { min: constraints.widthMinCm, max: constraints.widthMaxCm },
      depth: { min: constraints.depthMinCm, max: constraints.depthMaxCm },
    },
    constraints,
    materials: (product.materials ?? []).map((material) => ({
      ...material,
      price: material.priceParM2HT ?? material.price ?? 0,
    })),
    options: (product.options ?? []).map((option) => ({
      ...option,
      price: option.valueHT ?? option.price ?? 0,
      type: option.typeCalcul === 'forfait' ? 'fixed' : option.typeCalcul === 'parM2' ? 'sqm' : 'percent',
    })),
  };
}

const state = {
  productId: 'pergola-bioclimatique',
  client: 'particulier',
  width: 420,
  depth: 360,
  materialId: 'alu',
  colorId: 'anthracite',
  construction: 'autoportee',
  activeTab: 'description',
  options: new Set(),
  sideSelections: {},
  cart: JSON.parse(localStorage.getItem('bb-cart') || '[]'),
  checkoutOpen: false,
};

const PRODUCT_COLORS = [
  { id: 'anthracite', name: 'Anthracite RAL 7016', value: '#2f332f' },
  { id: 'blanc', name: 'Blanc', value: '#f3f1e9' },
];

const COLOR_IMAGES = {
  anthracite: '/pergola-bioclimatique-cocoon-xl-mixte-gris-anthracite-blanc-700x4987m.webp',
  blanc: '/pergola-blanche.jpg',
};

const PHONE_COUNTRIES = [
  { code: '+33', name: 'France' },
  { code: '+32', name: 'Belgique' },
  { code: '+31', name: 'Pays-Bas' },
  { code: '+41', name: 'Suisse' },
  { code: '+49', name: 'Allemagne' },
];

function phoneCountryOptions() {
  return `
    <span class="country-picker">
      <input type="hidden" name="phoneCountry" value="+33" />
      <button class="country-picker-toggle" type="button" data-phone-country-toggle aria-expanded="false">+33</button>
      <span class="country-picker-menu" role="listbox">
        ${PHONE_COUNTRIES.map(({ code, name }) => `<button type="button" role="option" data-phone-country="${code}">${name} (${code})</button>`).join('')}
      </span>
    </span>
  `;
}

function formatInternationalPhone(countryCode, phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const countryDigits = countryCode.replace('+', '');
  const localNumber = digits.startsWith(countryDigits) ? digits.slice(countryDigits.length) : digits;
  return `${countryCode}${localNumber.replace(/^0+/, '')}`;
}

function capitalizeFirstName(event) {
  const input = event.currentTarget;
  if (input.value) input.value = input.value.charAt(0).toLocaleUpperCase('fr-FR') + input.value.slice(1);
}

function addressFieldMarkup(name, autocomplete, label, placeholder = '') {
  return `
    <label class="autocomplete-field">${label}
      <span class="autocomplete-wrap">
        <input name="${name}" autocomplete="${autocomplete}" placeholder="${placeholder}" required />
        <span class="autocomplete-list" data-autocomplete-list="${name}" role="listbox"></span>
      </span>
    </label>
  `;
}

const DIMENSION_PRESETS = {
  'pergola-bioclimatique': [[300, 300], [300, 400], [300, 500], [300, 600], [400, 400], [400, 500], [400, 600]],
  'pergola-classique': [[200, 200], [250, 300], [300, 300], [400, 300], [500, 350]],
  veranda: [[300, 300], [400, 400], [500, 400], [600, 500]],
};

function getDimensionPresets(product) {
  return (DIMENSION_PRESETS[product.id] ?? []).filter(([width, depth]) => (
    width >= product.constraints.widthMinCm && width <= product.constraints.widthMaxCm
      && depth >= product.constraints.depthMinCm && depth <= product.constraints.depthMaxCm
  ));
}

const money = (value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

function currentConfiguration() {
  const product = getProduct();
  const price = calculatePrice(product);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: product.id,
    productName: product.name,
    image: product.image,
    width: state.width,
    depth: state.depth,
    colorId: state.colorId,
    materialId: state.materialId,
    construction: state.construction,
    optionIds: [...state.options],
    sideSelections: { ...state.sideSelections },
    totalHT: price.totalHT,
    totalTTC: price.totalTTC,
    quantity: 1,
  };
}

function saveCart() {
  localStorage.setItem('bb-cart', JSON.stringify(state.cart));
}

function cartTotal() {
  return state.cart.reduce((total, item) => total + item.totalTTC * item.quantity, 0);
}

function showToast(message) {
  const existing = document.querySelector('.site-toast');
  existing?.remove();
  const toast = document.createElement('div');
  toast.className = 'site-toast';
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 250);
  }, 2800);
}

function readStoredJson(key, fallback = {}) {
  const value = localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function paymentResultMarkup() {
  const payment = new URLSearchParams(window.location.search).get('payment');
  if (payment === 'success') {
    if (state.cart.length) {
      state.cart = [];
      saveCart();
    }
    const order = new URLSearchParams(window.location.search).get('order') || 'en cours de génération';
    const customer = readStoredJson('bb-checkout-customer');
    const lastOrder = readStoredJson('bb-last-order', []);
    const item = lastOrder[0];
    const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
    const customerAddress = [customer.address, customer.postalCode, customer.city].filter(Boolean).join(', ');
    const total = item ? money(item.totalTTC * item.quantity) : 'Selon validation';
    return `<section class="payment-result success"><button class="payment-result-close" type="button" data-dismiss-payment aria-label="Fermer la confirmation">×</button><div class="payment-result-icon">✓</div><div class="payment-result-layout"><div><span class="kicker">Paiement confirmé</span><h2>Merci, votre projet est bien enregistré.</h2><p>Référence : <strong>${order}</strong>. Un conseiller va vérifier les dimensions et vous recontactera avant fabrication.</p><div class="payment-result-actions"><button class="primary-btn" type="button" data-download-summary>Télécharger le résumé</button><a class="secondary-btn" href="#configurateur">Voir ma configuration</a></div></div><div class="payment-order-card">${item ? `<img src="${item.image}" alt="${item.productName}" /><div><strong>${item.productName}</strong><span>${item.width} × ${item.depth} cm · ${item.quantity} unité${item.quantity > 1 ? 's' : ''}</span><b>${total} TTC</b></div>` : ''}<dl><div><dt>Client</dt><dd>${customerName || 'Coordonnées enregistrées'}</dd></div><div><dt>Livraison</dt><dd>${customerAddress || 'Adresse enregistrée'}</dd></div><div><dt>E-mail</dt><dd>${customer.email || 'E-mail enregistré'}</dd></div></dl></div></div></section>`;
  }
  if (payment === 'cancelled') {
    return `<section class="payment-result cancelled"><button class="payment-result-close" type="button" data-dismiss-payment aria-label="Fermer la confirmation">×</button><span class="kicker">Paiement interrompu</span><h2>Votre projet est toujours sauvegardé.</h2><p>Aucun paiement n’a été enregistré. Vous pouvez rouvrir le panier et réessayer quand vous le souhaitez.</p><button class="primary-btn" type="button" data-open-cart>Rouvrir le panier</button></section>`;
  }
  return '';
}

async function fetchCatalog() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Impossible de charger le catalogue');
    const data = await response.json();
    if (Array.isArray(data) && data.length) {
      CATALOGUE = data.map(normalizeProduct);
    }
  } catch (error) {
    console.warn('Fallback catalogue used:', error.message);
    CATALOGUE = FALLBACK_CATALOGUE.map(normalizeProduct);
  }
}

function getProduct() {
  return CATALOGUE.find((product) => product.id === state.productId) ?? CATALOGUE[0];
}

function getSurface() {
  return (state.width / 100) * (state.depth / 100);
}

function getSelectedMaterial(product) {
  return product.materials.find((material) => material.id === state.materialId) ?? product.materials[0];
}

function getOptionAmount(product, option) {
  const surface = getSurface();
  const material = getSelectedMaterial(product);
  const structureAmount = surface * (material.priceParM2HT ?? material.price ?? 0);

  if (option.typeCalcul === 'forfait') return option.valueHT;
  if (option.typeCalcul === 'parM2') return option.valueHT * surface;
  if (option.typeCalcul === 'pourcentageStructure') return structureAmount * (option.valueHT / 100);
  return 0;
}

function calculatePrice(product, values = {}) {
  const base = product.basePriceHT ?? product.basePrice ?? 0;
  const material = getSelectedMaterial(product);
  const width = values.width ?? state.width;
  const depth = values.depth ?? state.depth;
  const selectedOptions = values.options ?? state.options;
  const sideSelections = values.sideSelections ?? state.sideSelections;
  const construction = values.construction ?? state.construction;
  const surface = (width / 100) * (depth / 100);
  const constraints = product.constraints ?? {
    widthMinCm: 200,
    widthMaxCm: 800,
    depthMinCm: 200,
    depthMaxCm: 700,
  };

  if (width < constraints.widthMinCm || width > constraints.widthMaxCm) {
    throw new Error(`Largeur hors limites (${constraints.widthMinCm}–${constraints.widthMaxCm} cm).`);
  }

  if (depth < constraints.depthMinCm || depth > constraints.depthMaxCm) {
    throw new Error(`Profondeur hors limites (${constraints.depthMinCm}–${constraints.depthMaxCm} cm).`);
  }

  let total = base + surface * (material.priceParM2HT ?? material.price ?? 0);
  const lines = [
    { label: 'Forfait de base', amount: base },
    { label: `Structure ${material.name} (${surface.toFixed(2)} m²)`, amount: surface * (material.priceParM2HT ?? material.price ?? 0) },
  ];

  for (const optionId of selectedOptions) {
    const option = product.options.find((item) => item.id === optionId);
    if (!option) continue;

    let optionAmount = 0;
    if (option.typeCalcul === 'forfait') optionAmount = option.valueHT;
    if (option.typeCalcul === 'parM2') optionAmount = option.valueHT * surface;
    if (option.typeCalcul === 'pourcentageStructure') optionAmount = (surface * (material.priceParM2HT ?? material.price ?? 0)) * (option.valueHT / 100);

    lines.push({ label: option.name, amount: optionAmount });
    total += optionAmount;
  }

  for (const [side, type] of Object.entries(sideSelections)) {
    if (construction === 'adossee' && side === 'haut') continue;
    const sideOption = product.sideOptions?.[type];
    if (!sideOption || !['haut', 'bas', 'gauche', 'droite'].includes(side)) continue;
    const lengthCm = side === 'haut' || side === 'bas' ? width : depth;
    const amount = (lengthCm / 100) * (sideOption.priceParMLHT ?? 0);
    lines.push({
      label: `${sideOption.name} — côté ${side}`,
      amount,
    });
    total += amount;
  }

  const totalTTC = total * (1 + (product.vat ?? 0.2));
  return { lines, totalHT: total, totalTTC, vat: product.vat ?? 0.2 };
}

function syncStateFromProduct(product) {
  const constraints = product.constraints ?? {
    widthMinCm: 200,
    widthMaxCm: 800,
    depthMinCm: 200,
    depthMaxCm: 700,
  };
  state.width = Math.min(Math.max(state.width, constraints.widthMinCm), constraints.widthMaxCm);
  state.depth = Math.min(Math.max(state.depth, constraints.depthMinCm), constraints.depthMaxCm);
  state.materialId = product.materials.some((m) => m.id === state.materialId) ? state.materialId : product.materials[0].id;

  const nextSet = new Set();
  [...state.options].forEach((id) => {
    if (product.options.some((option) => option.id === id)) nextSet.add(id);
  });
  state.options = nextSet;
  state.sideSelections = Object.fromEntries(
    Object.entries(state.sideSelections).filter(([side, type]) => product.sideOptions?.[type]
      && ['haut', 'bas', 'gauche', 'droite'].includes(side)
      && !(state.construction === 'adossee' && side === 'haut')),
  );
}

function setDefaults(product) {
  const constraints = product.constraints ?? {
    widthMinCm: 200,
    widthMaxCm: 800,
    depthMinCm: 200,
    depthMaxCm: 700,
  };
  state.width = Math.round((constraints.widthMinCm + constraints.widthMaxCm) / 2);
  state.depth = Math.round((constraints.depthMinCm + constraints.depthMaxCm) / 2);
  state.materialId = product.materials[0].id;
  state.options = new Set();
  state.sideSelections = {};
}

function renderCardFooter(product) {
  state.productId = product.id;
  const price = calculatePrice(product);
  return `
    <div class="price-block">
      <small>À partir de</small>
      <strong>${money(price.totalHT)}</strong>
    </div>
  `;
}

function render() {
  const product = getProduct();
  syncStateFromProduct(product);
  const price = calculatePrice(product);
  const productImage = product.id === 'pergola-bioclimatique'
    ? (COLOR_IMAGES[state.colorId] ?? product.image)
    : product.image;

  app.innerHTML = `
    <header class="site-header" id="header">
      <div class="container">
        <a href="#top" class="logo" aria-label="B&B Pergolas accueil">B&B <span>Pergolas</span></a>
        <nav class="main-nav" aria-label="Navigation principale">
          <a href="#solutions">Solutions</a>
          <a href="#catalogue">Catalogue</a>
          <a href="#configurateur">Configurateur</a>
          <a href="#a-propos">À propos</a>
        </nav>
        <div class="header-actions">
          <a href="tel:+33615367504">06 15 36 75 04</a>
          <button class="cart-button" type="button" data-open-cart aria-label="Ouvrir le panier">
            Panier <span class="cart-count">${state.cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
          </button>
          <a href="#demande-devis" class="primary-btn">Demander un devis</a>
        </div>
      </div>
    </header>

    <div class="benefit-strip" aria-label="Engagements B&B Pergolas">
      <div class="container">
        <span>Fabrication française</span>
        <span>Garantie jusqu’à 20 ans</span>
        <span>Prix calculé sur mesure</span>
        <span>Conseil avant achat</span>
      </div>
    </div>

    <main id="top">
      ${paymentResultMarkup()}
      <section class="container hero">
        <div>
          <div class="hero-tag">Fabrication française</div>
          <h1>Votre extérieur, <em>imaginé autrement.</em></h1>
          <p>Concevez votre pergola sur mesure et visualisez-la en 3D avant de demander votre devis.</p>
          <div class="hero-cta-row">
            <a class="primary-btn" href="#configurateur">Configurer ma pergola</a>
            <a class="secondary-btn" href="#devis">Demander un devis</a>
          </div>
          <div class="hero-proof-row">
            <div><strong>20 ans</strong><span>de garantie</span></div>
            <div><strong>100%</strong><span>aluminium français</span></div>
            <div><strong>Sur mesure</strong><span>dimensions réelles</span></div>
          </div>
        </div>
        <div class="hero-media">
          <img src="https://bbpergolas.com/wp-content/uploads/2026/01/l-jour-2.jpeg" alt="Pergola en L B&B Pergolas installée sur une terrasse" />
          <div class="hero-overlay"></div>
          <div class="media-badge">Sur-mesure • Alsace</div>
        </div>
      </section>

      <section class="stats container" aria-label="Chiffres clés">
        <div class="stat">
          <div class="num">2016</div>
          <div class="label">création</div>
        </div>
        <div class="stat">
          <div class="num">100%</div>
          <div class="label">français</div>
        </div>
        <div class="stat">
          <div class="num">20 ans</div>
          <div class="label">garantie</div>
        </div>
        <div class="stat">
          <div class="num">Sur</div>
          <div class="label">mesure</div>
        </div>
      </section>

      <section class="section container" id="solutions">
        <div class="section-head">
          <div>
            <span class="kicker">Nos solutions</span>
            <h2>Trois façons de couvrir votre extérieur</h2>
          </div>
          <p>Des gammes pensées pour les terrasses, les entrées de maison et les espaces de vie ouverts.</p>
        </div>

        <div class="product-grid">
          ${CATALOGUE.map((entry) => `
            <article class="product-card ${entry.featured ? 'featured' : ''}">
              <div class="product-image">
                <img src="${entry.image}" alt="${entry.name}" />
                <span class="image-tag">${entry.tagline}</span>
              </div>
              <div class="product-body">
                <h3>${entry.name}</h3>
                <p>${entry.description}</p>
                <ul class="feature-list">
                  <li>Matériau aluminium sur mesure</li>
                  <li>Conception conforme au projet</li>
                  <li>Options de confort et d’éclairage</li>
                </ul>
                <div class="card-footer">
                  <div class="price-block">
                    <small>À partir de</small>
                    <strong>${money(calculatePrice(entry, {
                      width: entry.constraints.widthMinCm,
                      depth: entry.constraints.depthMinCm,
                      options: new Set(),
                    }).totalHT)}</strong>
                  </div>
                  <button class="gamme-cta" data-product-id="${entry.id}">Choisir</button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="section container" id="catalogue">
        <div class="section-head">
          <div>
            <span class="kicker">Catalogue</span>
            <h2>Une gamme complète pour l’extérieur</h2>
          </div>
          <p>Chaque pièce est pensée pour répondre à votre usage, votre style et la configuration de votre maison.</p>
        </div>

        <div class="catalog-grid">
          <article class="catalog-tile featured" style="background-image: url('https://bbpergolas.com/wp-content/uploads/2026/01/16F4D4B6-A771-45ED-A379-CEE252636320.png.webp');">
            <div class="arrow">→</div>
            <h3>Pergolas</h3>
            <p>Le confort solaire et l’élégance de l’aluminium.</p>
          </article>
          <article class="catalog-tile medium" style="background-image: url('https://bbpergolas.com/wp-content/uploads/2026/01/CAPING-CARPORT.jpeg.webp');">
            <div class="arrow">→</div>
            <h3>Carports</h3>
            <p>Protection de votre véhicule et votre espace.</p>
          </article>
          <article class="catalog-tile small" style="background-image: url('https://bbpergolas.com/wp-content/uploads/2022/03/portail-aluminium-thann-bbpergolas-11.jpg.webp');">
            <div class="arrow">→</div>
            <h3>Portails</h3>
          </article>
          <article class="catalog-tile small" style="background-image: url('https://bbpergolas.com/wp-content/uploads/2022/03/gardecorps_bbpergolas_thann.png.webp');">
            <div class="arrow">→</div>
            <h3>Garde-corps</h3>
          </article>
          <article class="catalog-tile medium" style="background-image: url('https://bbpergolas.com/wp-content/uploads/2026/01/vitre.jpeg.webp');">
            <div class="arrow">→</div>
            <h3>Vérandas</h3>
            <p>Un espace de vie plus lumineux toute l’année.</p>
          </article>
        </div>
      </section>

      <section class="section configurator-section" id="configurateur">
        <div class="container">
          <div class="section-head">
            <div>
              <span class="kicker">Configurateur</span>
              <h2>Estimez votre projet instantanément</h2>
            </div>
            <p>Le prix s’ajuste en fonction de vos dimensions, du matériau et des options choisies.</p>
          </div>

          <div class="product-breadcrumb" aria-label="Fil d’Ariane">
            <a href="#top">Accueil</a><span>/</span><a href="#solutions">Pergolas</a><span>/</span><strong>${product.name}</strong>
          </div>

          <div class="configurator-grid">
            <div class="config-panel">
              <div class="product-config-visual" data-product="${product.id}" data-color="${product.id === 'pergola-bioclimatique' ? state.colorId : 'default'}">
                <img src="${productImage}" alt="${product.name} - ${product.id === 'pergola-bioclimatique' ? PRODUCT_COLORS.find((color) => color.id === state.colorId)?.name ?? 'finition sélectionnée' : 'présentation produit'}" />
                <span>${product.tagline ?? 'Fabrication sur mesure'}</span>
              </div>
              <div class="product-config-heading">
                <div>
                  <div class="step-tag">Votre configuration</div>
                  <h3>${product.name}</h3>
                  <p>${product.description}</p>
                </div>
              </div>
              <div class="trust-row config-trust">
                <span><i></i>Garantie jusqu’à 20 ans</span>
                <span><i></i>Livraison en France</span>
                <span><i></i>Conseil avant achat</span>
              </div>

              <div class="option-block product-option-block" style="${product.id === 'pergola-bioclimatique' ? '' : 'display: none;'}">
                <div class="option-label">Couleur <span class="selected-option-label">${PRODUCT_COLORS.find((color) => color.id === state.colorId)?.name ?? 'Anthracite RAL 7016'}</span></div>
                <div class="color-swatches">
                  ${PRODUCT_COLORS.map((color) => `
                    <button class="color-swatch ${state.colorId === color.id ? 'selected' : ''}" type="button" data-color-id="${color.id}" title="${color.name}" aria-label="${color.name}" style="--swatch-color: ${color.value}"></button>
                  `).join('')}
                </div>
              </div>

              <div class="option-block product-option-block">
                <div class="option-label">Dimensions <span class="selected-option-label">${state.width / 100} × ${state.depth / 100} m</span></div>
                <div class="dimension-presets">
                  ${getDimensionPresets(product).map(([width, depth]) => `
                    <button class="dimension-pill ${state.width === width && state.depth === depth ? 'selected' : ''}" type="button" data-width="${width}" data-depth="${depth}">${width / 100} × ${depth / 100} m</button>
                  `).join('')}
                </div>
              </div>

              <div class="option-block product-option-block">
                <div class="option-label">Type de construction</div>
                <div class="construction-options">
                  <button class="construction-card ${state.construction === 'autoportee' ? 'selected' : ''}" type="button" data-construction="autoportee">
                    <strong>Autoportée</strong><span>Structure indépendante</span>
                  </button>
                  <button class="construction-card ${state.construction === 'adossee' ? 'selected' : ''}" type="button" data-construction="adossee">
                    <strong>Adossée</strong><span>Fixée contre votre façade</span>
                  </button>
                </div>
              </div>

              <div class="product-select">
                <select id="productSelect" aria-label="Choisir un produit">
                  ${CATALOGUE.map((entry) => `
                    <option value="${entry.id}" ${entry.id === product.id ? 'selected' : ''}>${entry.name}</option>
                  `).join('')}
                </select>
              </div>

              <div class="range-field">
                <div class="range-header">
                  <span>Largeur personnalisée</span>
                  <strong>${state.width} cm</strong>
                </div>
                <input class="measure-input" type="number" id="widthInput" min="${product.dimensions.width.min}" max="${product.dimensions.width.max}" step="1" value="${state.width}" />
                <div class="range-bounds"><span>${product.dimensions.width.min} cm minimum</span><span>${product.dimensions.width.max} cm maximum</span></div>
              </div>

              <div class="range-field">
                <div class="range-header">
                  <span>Profondeur personnalisée</span>
                  <strong>${state.depth} cm</strong>
                </div>
                <input class="measure-input" type="number" id="depthInput" min="${product.dimensions.depth.min}" max="${product.dimensions.depth.max}" step="1" value="${state.depth}" />
                <div class="range-bounds"><span>${product.dimensions.depth.min} cm minimum</span><span>${product.dimensions.depth.max} cm maximum</span></div>
              </div>

              <div class="section-label">Matériau</div>
              <div class="materiau-row">
                ${product.materials.map((material) => `
                  <button class="material-pill ${state.materialId === material.id ? 'selected' : ''}" data-material-id="${material.id}">
                    ${material.name}
                  </button>
                `).join('')}
              </div>

              <div class="section-label">Options</div>
              <div class="option-list">
                ${product.options.map((option) => `
                  <label class="option-pill ${state.options.has(option.id) ? 'selected' : ''}">
                    <input type="checkbox" data-option-id="${option.id}" ${state.options.has(option.id) ? 'checked' : ''} />
                    <span class="option-copy"><strong>${option.name}</strong><small>+${money(getOptionAmount(product, option))}</small></span>
                  </label>
                `).join('')}
              </div>

              ${product.sideOptions && Object.keys(product.sideOptions).length ? `
                <div class="side-configurator">
                  <div class="option-label">Aménagement des côtés <span class="selected-option-label">Cliquez sur un côté</span></div>
                  <p class="side-help">Choisissez où installer un store ou une baie vitrée. Cliquez à nouveau sur le côté pour le retirer.</p>
                  <div class="side-layout side-layout-3d" aria-label="Modèle 3D de sélection des côtés">
                    <button class="side-zone side-top ${state.construction === 'adossee' ? 'blocked' : ''} ${state.sideSelections.haut ? 'selected' : ''}" type="button" data-side="haut" aria-label="${state.construction === 'adossee' ? 'Côté haut bloqué contre la façade' : 'Côté haut'}" ${state.construction === 'adossee' ? 'disabled' : ''}>
                      <span>${state.construction === 'adossee' ? 'Façade' : state.sideSelections.haut ? product.sideOptions[state.sideSelections.haut]?.name : 'Côté haut'}</span>
                    </button>
                    <button class="side-zone side-right ${state.sideSelections.droite ? 'selected' : ''}" type="button" data-side="droite" aria-label="Côté droit">
                      <span>${state.sideSelections.droite ? product.sideOptions[state.sideSelections.droite]?.name : 'Côté droit'}</span>
                    </button>
                    <div class="side-center ${state.construction === 'adossee' ? 'construction-adossee' : 'construction-autoportee'}">
                      <svg class="pergola-drawing" viewBox="0 0 420 260" role="img" aria-label="Dessin de pergola bioclimatique en perspective">
                        <defs>
                          <linearGradient id="roofShade" x1="0" y1="0" x2="0.8" y2="1">
                            <stop offset="0" stop-color="#7d8780"/>
                            <stop offset="0.52" stop-color="#384039"/>
                            <stop offset="1" stop-color="#171c18"/>
                          </linearGradient>
                          <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0" stop-color="#151a16"/>
                            <stop offset="0.48" stop-color="#9aa49b"/>
                            <stop offset="0.7" stop-color="#424a43"/>
                            <stop offset="1" stop-color="#111511"/>
                          </linearGradient>
                          <filter id="drawingShadow" x="-30%" y="-30%" width="160%" height="180%">
                            <feDropShadow dx="0" dy="13" stdDeviation="8" flood-color="#111611" flood-opacity=".35"/>
                          </filter>
                        </defs>
                        ${state.construction === 'adossee' ? `
                          <path d="M18 -58 L397 -58 L397 102 L18 102 Z" fill="#d7d3ca" stroke="#aaa59a" stroke-width="4"/>
                          <path d="M30 -42 L385 -42 M30 -16 L385 -16 M30 10 L385 10 M30 36 L385 36 M30 62 L385 62 M30 88 L385 88" stroke="#b6b1a7" stroke-width="2" opacity=".7"/>
                          <path d="M42 -56 L42 100 M104 -56 L104 100 M166 -56 L166 100 M228 -56 L228 100 M290 -56 L290 100 M352 -56 L352 100" stroke="#c1bcb2" stroke-width="2" opacity=".6"/>
                          <path d="M18 98 L397 98" stroke="#79746c" stroke-width="7"/>
                        ` : ''}
                        <ellipse cx="218" cy="224" rx="157" ry="18" fill="#172018" opacity=".22"/>
                        <g filter="url(#drawingShadow)">
                          <polygon points="74,64 305,31 361,157 119,193" fill="url(#roofShade)" stroke="#111611" stroke-width="8" stroke-linejoin="round"/>
                          <g stroke="#c8d0c9" stroke-width="5" opacity=".9">
                            <line x1="92" y1="67" x2="318" y2="39"/>
                            <line x1="101" y1="82" x2="325" y2="53"/>
                            <line x1="108" y1="97" x2="332" y2="68"/>
                            <line x1="115" y1="112" x2="339" y2="83"/>
                            <line x1="122" y1="127" x2="345" y2="98"/>
                            <line x1="129" y1="142" x2="351" y2="113"/>
                            <line x1="136" y1="157" x2="357" y2="128"/>
                            <line x1="143" y1="172" x2="360" y2="143"/>
                          </g>
                          <polygon points="74,64 305,31 318,39 92,72" fill="#aab3aa" opacity=".45"/>
                          <path d="M74 64 L119 193 L361 157 L305 31" fill="none" stroke="#111611" stroke-width="9" stroke-linejoin="round"/>
                          <path d="M74 64 L305 31 M119 193 L361 157" stroke="url(#metal)" stroke-width="13"/>
                          <path d="M78 72 L122 196 M302 39 L358 160" stroke="url(#metal)" stroke-width="12"/>
                          <path d="M121 190 L121 239 M357 154 L357 207 M78 67 L78 116 M304 35 L304 83" stroke="url(#metal)" stroke-width="12" stroke-linecap="round"/>
                          <path d="M137 193 L337 163" stroke="#171d18" stroke-width="5" opacity=".75"/>
                          <ellipse cx="231" cy="195" rx="55" ry="13" fill="#202820" opacity=".55"/>
                          <rect x="188" y="177" width="88" height="28" rx="3" fill="#765437" transform="skewX(-10)"/>
                          <path d="M192 185 L272 185 M190 194 L270 194" stroke="#b28a5d" stroke-width="2" opacity=".7"/>
                        </g>
                      </svg>
                      <span>Votre pergola</span><small>Vue du dessus</small>
                    </div>
                    <button class="side-zone side-bottom ${state.sideSelections.bas ? 'selected' : ''}" type="button" data-side="bas" aria-label="Côté bas">
                      <span>${state.sideSelections.bas ? product.sideOptions[state.sideSelections.bas]?.name : 'Côté bas'}</span>
                    </button>
                    <button class="side-zone side-left ${state.sideSelections.gauche ? 'selected' : ''}" type="button" data-side="gauche" aria-label="Côté gauche">
                      <span>${state.sideSelections.gauche ? product.sideOptions[state.sideSelections.gauche]?.name : 'Côté gauche'}</span>
                    </button>
                  </div>
                  <div class="side-choice-list">
                    ${Object.entries(product.sideOptions).map(([id, option]) => `
                      <button class="side-choice ${Object.values(state.sideSelections).includes(id) ? 'selected' : ''}" type="button" data-side-choice="${id}">
                        <strong>${option.name}</strong><small>${money(option.priceParMLHT)} / m</small>
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

            <aside class="summary-panel" aria-live="polite">
              <div>
                <div class="step-tag">Résumé</div>
                <div class="summary-line"><span>Produit</span><strong>${product.name}</strong></div>
                <div class="summary-line"><span>Client</span><strong>${state.client === 'professionnel' ? 'Professionnel' : 'Particulier'}</strong></div>
                <div class="summary-line"><span>Dimensions</span><strong>${state.width} × ${state.depth} cm</strong></div>
              </div>

              <div class="summary-price">
                ${price.lines.map((line) => `
                  <div class="summary-line"><span>${line.label}</span><strong>${money(line.amount)}</strong></div>
                `).join('')}

                <div class="total-row">
                  <div>
                    <div class="label">Prix ${state.client === 'professionnel' ? 'HT' : 'TTC'}</div>
                  </div>
                  <div class="amount">${money(state.client === 'professionnel' ? price.totalHT : price.totalTTC)}</div>
                </div>
                <span class="summary-note">Prix recalculé à partir des dimensions. TVA ${product.vat * 100}%.</span>
              </div>

              <button class="primary-btn" type="button">Ajouter au panier</button>
            </aside>
          </div>

          <section class="quote-request" id="demande-devis">
            <div class="quote-request-intro">
              <span class="kicker">Demande de devis</span>
              <h2>Parlons de votre projet.</h2>
              <p>Recevez un échange personnalisé avec un conseiller B&B, à partir de la configuration que vous venez de préparer.</p>
              <div class="quote-trust"><span>Réponse personnalisée</span><span>Sans engagement</span><span>Conseil sur les cotes</span></div>
            </div>
            <form class="quote-form" id="quoteForm">
              <div class="quote-form-grid">
                <label>Prénom<input name="firstName" autocomplete="given-name" required /></label>
                <label>Nom<input name="lastName" autocomplete="family-name" required /></label>
                <label>E-mail<input name="email" type="email" autocomplete="email" required /></label>
                <label>Téléphone
                  <span class="phone-field">
                    ${phoneCountryOptions()}
                    <input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="6 15 36 75 04" required />
                  </span>
                </label>
              </div>
              <label>Votre message (facultatif)<textarea name="message" rows="4" placeholder="Parlez-nous de votre terrain, de votre façade ou de vos envies."></textarea></label>
              <label class="quote-consent"><input name="consent" type="checkbox" required /> <span>J’accepte d’être recontacté au sujet de cette demande de devis.</span></label>
              <input type="hidden" name="configuration" value="${product.id}" />
              <button class="primary-btn rust" type="submit">Envoyer ma demande</button>
              <p class="quote-status" id="quoteStatus" role="status" aria-live="polite"></p>
            </form>
          </section>

          <div class="technical-tabs">
            <div class="technical-tab-list" role="tablist" aria-label="Informations produit">
              <button class="technical-tab ${state.activeTab === 'description' ? 'selected' : ''}" type="button" data-tab="description">Description</button>
              <button class="technical-tab ${state.activeTab === 'technique' ? 'selected' : ''}" type="button" data-tab="technique">Informations techniques</button>
              <button class="technical-tab ${state.activeTab === 'livraison' ? 'selected' : ''}" type="button" data-tab="livraison">Livraison</button>
              <button class="technical-tab ${state.activeTab === 'garantie' ? 'selected' : ''}" type="button" data-tab="garantie">Garantie</button>
            </div>
            <div class="technical-tab-panel">
              ${state.activeTab === 'description' ? `
                <h3>${product.name}, pensé pour durer</h3>
                <p>${product.description} Chaque configuration est calculée selon vos dimensions réelles afin de vous donner un prix clair avant votre demande de devis.</p>
                <ul><li>Aluminium sur mesure et sans entretien lourd</li><li>Confort solaire adapté à votre terrasse</li><li>Options d’éclairage, de motorisation et de protection</li></ul>
              ` : ''}
              ${state.activeTab === 'technique' ? `
                <h3>Caractéristiques techniques</h3>
                <table><tbody><tr><td>Largeur</td><td>${product.constraints.widthMinCm} à ${product.constraints.widthMaxCm} cm</td></tr><tr><td>Profondeur</td><td>${product.constraints.depthMinCm} à ${product.constraints.depthMaxCm} cm</td></tr><tr><td>Matériaux</td><td>${product.materials.map((material) => material.name).join(' / ')}</td></tr><tr><td>TVA</td><td>${product.vat * 100}%</td></tr></tbody></table>
              ` : ''}
              ${state.activeTab === 'livraison' ? `
                <h3>Livraison et installation</h3><p>Votre projet est préparé selon la configuration choisie. Un conseiller vous accompagne pour confirmer les cotes, les options et les conditions d’installation avant validation.</p>
              ` : ''}
              ${state.activeTab === 'garantie' ? `
                <h3>Garantie et accompagnement</h3><p>Nous vous accompagnons avant l’achat, pendant la préparation du projet et après l’installation. La durée de garantie dépend des composants sélectionnés.</p>
              ` : ''}
            </div>
          </div>
        </div>
      </section>

      <section class="section container" id="a-propos">
        <div class="story-section">
          <div>
            <span class="kicker">Notre démarche</span>
            <h2>Un conseil clair, un produit durable et un service fiable.</h2>
          </div>
          <ul class="story-list">
            <li>
              <span class="idx">01</span>
              <div>
                <h3>Étude du projet</h3>
                <p>Nous comprenons vos usages, votre habitat et votre budget pour définir la meilleure solution.</p>
              </div>
            </li>
            <li>
              <span class="idx">02</span>
              <div>
                <h3>Fabrication sur mesure</h3>
                <p>Chaque structure est conçue selon les cotes exactes, avec contrôle rigoureux des dimensions et des matériaux.</p>
              </div>
            </li>
            <li>
              <span class="idx">03</span>
              <div>
                <h3>Livraison et installation</h3>
                <p>Vous recevez une structure prête à poser, avec les éléments nécessaires pour un montage propre et durable.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section class="project-journey">
        <div class="container">
          <div class="section-head journey-head">
            <div>
              <span class="kicker">Votre projet, étape par étape</span>
              <h2>Un accompagnement clair du premier échange à la pose.</h2>
            </div>
            <p>Vous gardez une vision précise de votre projet, de ses dimensions et de son budget à chaque étape.</p>
          </div>

          <div class="journey-grid">
            <article class="journey-step">
              <img src="https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=900&q=80" alt="Plan technique et étude de projet" />
              <span class="journey-number">01</span>
              <h3>Étude du projet</h3>
              <p>Nous échangeons sur votre terrasse, vos usages, vos contraintes et le rendu souhaité.</p>
              <span class="journey-note">Conseil personnalisé</span>
            </article>
            <article class="journey-step">
              <img src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80" alt="Préparation d’un devis sur mesure" />
              <span class="journey-number">02</span>
              <h3>Devis sur mesure</h3>
              <p>Les dimensions, le matériau et les options sont vérifiés pour vous remettre un prix lisible.</p>
              <span class="journey-note">Prix calculé selon votre projet</span>
            </article>
            <article class="journey-step">
              <img src="https://upload.wikimedia.org/wikipedia/en/c/c3/Flag_of_France.svg" alt="Drapeau français symbolisant la fabrication française" />
              <span class="journey-number">03</span>
              <h3>Fabrication française</h3>
              <p>Votre structure aluminium est préparée selon les cotes validées et les finitions choisies.</p>
              <span class="journey-note">Conception depuis 2016</span>
            </article>
            <article class="journey-step">
              <img src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80" alt="Équipe en intervention sur un chantier" />
              <span class="journey-number">04</span>
              <h3>Livraison et installation</h3>
              <p>Nous organisons la suite du projet et vous accompagnons jusqu’à la mise en place de votre structure.</p>
              <span class="journey-note">Un interlocuteur à vos côtés</span>
            </article>
          </div>

          <div class="journey-contact">
            <div>
              <strong>Une question avant de vous lancer ?</strong>
              <span>Un conseiller B&amp;B vous répond au 06 15 36 75 04.</span>
            </div>
            <a class="secondary-btn" href="tel:+33615367504">Parler à un conseiller</a>
          </div>
        </div>
      </section>

      <section class="cta-strip">
        <div class="container">
          <h2>Besoin d’un devis personnalisé ?</h2>
          <a href="#configurateur" class="primary-btn rust">Configurer maintenant</a>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container">
        <div class="logo">B&B <span>Pergolas</span></div>
        <div class="footer-copy">© 2026 B&B Pergolas — 68700 Cernay</div>
        <div class="footer-links">
          <a href="tel:+33615367504">06 15 36 75 04</a>
          <a href="mailto:bbpergolas@hotmail.com">bbpergolas@hotmail.com</a>
        </div>
      </div>
    </footer>

    <div class="cart-backdrop ${state.checkoutOpen ? 'is-open' : ''}" data-close-cart></div>
    <aside class="cart-drawer ${state.checkoutOpen ? 'is-open' : ''}" aria-label="Panier" aria-hidden="${!state.checkoutOpen}">
      <div class="cart-drawer-head">
        <div><span class="kicker">Votre projet</span><h2>Panier</h2></div>
        <button class="drawer-close" type="button" data-close-cart aria-label="Fermer le panier">×</button>
      </div>
      ${state.cart.length ? `
        <div class="cart-items">
          ${state.cart.map((item) => `
            <article class="cart-item">
              <img src="${item.image}" alt="${item.productName}" />
              <div>
                <strong>${item.productName}</strong>
                <span>${item.width} × ${item.depth} cm · ${item.quantity} unité${item.quantity > 1 ? 's' : ''}</span>
                <b>${money(item.totalTTC * item.quantity)} TTC</b>
                <button type="button" class="cart-remove" data-remove-cart="${item.id}">Supprimer</button>
              </div>
            </article>
          `).join('')}
        </div>
        <div class="cart-total"><span>Total estimatif TTC</span><strong>${money(cartTotal())}</strong></div>
        <p class="checkout-notice">Le montant affiché est une estimation. Un conseiller validera les dimensions et le prix final avant fabrication.</p>
        <div class="checkout-steps"><span class="active">1 Configuration</span><span>2 Informations</span><span>3 Paiement sécurisé</span></div>
        <form class="checkout-form" id="checkoutForm">
          <div class="quote-form-grid">
            <label>Prénom<input name="firstName" required autocomplete="given-name" /></label>
            <label>Nom<input name="lastName" required autocomplete="family-name" /></label>
            <label>E-mail<input name="email" type="email" required autocomplete="email" /></label>
            <label>Téléphone
              <span class="phone-field">
                ${phoneCountryOptions()}
                <input name="phone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="6 15 36 75 04" />
              </span>
            </label>
          </div>
          ${addressFieldMarkup('address', 'street-address', 'Adresse', 'Commencez à saisir votre adresse')}
          <div class="quote-form-grid">
            ${addressFieldMarkup('postalCode', 'postal-code', 'Code postal', 'Ex. 68700')}
            ${addressFieldMarkup('city', 'address-level2', 'Ville', 'Ex. Cernay')}
          </div>
          <label class="quote-consent"><input name="consent" type="checkbox" required /> <span>J’accepte les conditions et souhaite être recontacté.</span></label>
          <button class="primary-btn" type="submit">Continuer vers le paiement</button>
          <button class="secondary-btn checkout-quote" type="button" data-request-cart-quote>Je préfère recevoir un devis</button>
          <p class="checkout-status" role="status"></p>
        </form>
        <div class="secure-payment"><strong>🔒 Paiement sécurisé</strong><span>Visa · Mastercard · Stripe</span><small>Vos données sont protégées et chiffrées. Aucune donnée bancaire n’est enregistrée par B&B Pergolas.</small></div>
      ` : '<div class="cart-empty"><strong>Votre panier est vide</strong><p>Configurez votre pergola pour ajouter un projet.</p><a class="primary-btn" href="#configurateur" data-close-cart>Configurer ma pergola</a></div>'}
    </aside>
  `;

  document.querySelectorAll('[data-color-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.colorId = button.dataset.colorId;
      render();
    });
  });

  document.querySelectorAll('[data-width][data-depth]').forEach((button) => {
    button.addEventListener('click', () => {
      state.width = Number(button.dataset.width);
      state.depth = Number(button.dataset.depth);
      render();
    });
  });

  document.querySelectorAll('[data-construction]').forEach((button) => {
    button.addEventListener('click', () => {
      state.construction = button.dataset.construction;
      render();
    });
  });

  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeTab = button.dataset.tab;
      render();
    });
  });

  document.querySelector('#productSelect')?.addEventListener('change', (event) => {
    const nextProductId = event.target.value;
    state.productId = nextProductId;
    const nextProduct = getProduct();
    setDefaults(nextProduct);
    render();
  });

  document.querySelector('#widthInput')?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) {
      state.width = value;
      render();
    }
  });

  document.querySelector('#depthInput')?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) {
      state.depth = value;
      render();
    }
  });

  document.querySelectorAll('[data-material-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.materialId = button.dataset.materialId;
      render();
    });
  });

  document.querySelectorAll('[data-option-id]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const optionId = event.target.dataset.optionId;
      if (event.target.checked) {
        state.options.add(optionId);
      } else {
        state.options.delete(optionId);
      }
      render();
    });
  });

  document.querySelectorAll('[data-side-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      state.pendingSideType = button.dataset.sideChoice;
      document.querySelectorAll('[data-side-choice]').forEach((choice) => choice.classList.toggle('selected', choice === button));
    });
  });

  document.querySelectorAll('[data-side]').forEach((button) => {
    button.addEventListener('click', () => {
      const side = button.dataset.side;
      if (state.construction === 'adossee' && side === 'haut') return;
      const availableTypes = Object.keys(getProduct().sideOptions ?? {});
      const type = state.pendingSideType && availableTypes.includes(state.pendingSideType)
        ? state.pendingSideType
        : availableTypes[0];
      if (!type) return;
      if (state.sideSelections[side] === type) {
        delete state.sideSelections[side];
      } else {
        state.sideSelections[side] = type;
      }
      state.pendingSideType = null;
      if (state.construction === 'adossee') delete state.sideSelections.haut;
      render();
    });
  });

  document.querySelectorAll('[data-product-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.productId = button.dataset.productId;
      const selectedProduct = getProduct();
      setDefaults(selectedProduct);
      render();
      document.querySelector('#configurateur')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const cta = document.querySelector('.summary-panel .primary-btn');
  cta?.addEventListener('click', async () => {
    const product = getProduct();
    try {
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          materialId: state.materialId,
          widthCm: state.width,
          depthCm: state.depth,
          optionIds: [...state.options],
          sideSelections: state.sideSelections,
          construction: state.construction,
          typeClient: state.client,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Le prix n’a pas pu être validé');
      }

      const total = state.client === 'professionnel' ? result.totalHT : result.totalTTC;
      const summary = document.querySelector('.summary-panel');
      if (summary) {
        const strong = summary.querySelector('.amount');
        if (strong) strong.textContent = money(total);
      }
      const item = currentConfiguration();
      state.cart.push(item);
      saveCart();
      render();
      state.checkoutOpen = true;
      render();
      showToast('Votre projet a été ajouté au panier');
    } catch (error) {
      alert(error.message);
    }
  });

  document.querySelectorAll('[data-open-cart]').forEach((button) => {
    button.addEventListener('click', () => {
      state.checkoutOpen = true;
      render();
    });
  });

  document.querySelector('[data-download-summary]')?.addEventListener('click', () => {
    const order = new URLSearchParams(window.location.search).get('order') || 'B&B-PERGOLAS';
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 18;
    const right = pageWidth - margin;
    const item = readStoredJson('bb-last-order', [])[0] || state.cart[0];
    const customer = readStoredJson('bb-checkout-customer');
    const product = item ? CATALOGUE.find((entry) => entry.id === item.productId) : getProduct();
    const price = item ? { totalHT: item.totalHT, totalTTC: item.totalTTC } : calculatePrice(product);
    const today = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date());
    const pdfMoney = (value) => `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
    const colors = {
      ink: [36, 40, 31],
      muted: [104, 109, 101],
      line: [224, 222, 214],
      panel: [247, 246, 241],
      accent: [168, 82, 38],
      header: [145, 69, 38],
    };
    const line = (label, value, y) => {
      pdf.setDrawColor(...colors.line);
      pdf.line(margin, y + 3, right, y + 3);
      pdf.setTextColor(...colors.muted);
      pdf.setFontSize(10);
      pdf.text(label, margin, y);
      pdf.setTextColor(...colors.ink);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(value), right, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
    };
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, 42, 'F');
    pdf.setFillColor(...colors.accent);
    pdf.rect(0, 0, pageWidth, 2.5, 'F');
    pdf.setTextColor(...colors.ink);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('B&B', margin, 17);
    pdf.setTextColor(...colors.accent);
    pdf.text('Pergolas', margin + 18, 17);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...colors.muted);
    pdf.text('CONCEPTION ET INSTALLATION DE PERGOLAS', margin, 25);
    pdf.text('68700 CERNAY · FRANCE', margin, 31);
    pdf.text('06 15 36 75 04 · eminbilici68@gmail.com', margin, 36);
    pdf.setTextColor(...colors.ink);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('BON DE COMMANDE', right, 15, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...colors.muted);
    pdf.text('ESTIMATION À VALIDER', right, 22, { align: 'right' });
    pdf.text(`Référence : ${order}`, right, 29, { align: 'right' });
    pdf.text(`Émis le : ${today}`, right, 35, { align: 'right' });
    pdf.setTextColor(...colors.ink);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('Résumé de votre projet', margin, 60);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.muted);
    pdf.text(`Édité le ${today}`, margin, 68);
    if (customer.firstName || customer.lastName) {
      pdf.setTextColor(93, 99, 91);
      pdf.text(`Client : ${customer.firstName || ''} ${customer.lastName || ''}`, right, 68, { align: 'right' });
      pdf.setFontSize(8);
      pdf.text(customer.email || '', right, 73, { align: 'right' });
    }
    pdf.setDrawColor(...colors.line);
    pdf.line(margin, 75, right, 75);
    pdf.setFillColor(...colors.panel);
    pdf.roundedRect(margin, 84, pageWidth - margin * 2, 28, 3, 3, 'F');
    pdf.setTextColor(...colors.ink);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(item?.productName || product.name, margin + 8, 96);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.muted);
    pdf.text(`${item?.width || state.width} × ${item?.depth || state.depth} cm · ${item?.construction === 'adossee' ? 'Adossée' : 'Autoportée'}`, margin + 8, 104);
    pdf.setTextColor(...colors.ink);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(pdfMoney(price.totalTTC), right - 8, 100, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('TTC estimatif', right - 8, 106, { align: 'right' });
    let y = 132;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('DÉTAIL DE LA CONFIGURATION', margin, y);
    y += 10;
    pdf.setFont('helvetica', 'normal');
    line('Produit', item?.productName || product.name, y);
    line('Dimensions', `${item?.width || state.width} × ${item?.depth || state.depth} cm`, y + 8);
    line('Finition', item?.colorId === 'blanc' ? 'Blanc' : 'Anthracite RAL 7016', y + 16);
    line('Construction', item?.construction === 'adossee' ? 'Adossée' : 'Autoportée', y + 24);
    line('Options', item?.optionIds?.length ? item.optionIds.join(', ') : 'Aucune option supplémentaire', y + 32);
    y += 52;
    pdf.setDrawColor(...colors.line);
    pdf.line(margin, y, right, y);
    y += 12;
    pdf.setFont('helvetica', 'bold');
    pdf.text('MONTANT ESTIMATIF', margin, y);
    line('Total HT', pdfMoney(price.totalHT), y + 10);
    line('TVA (20 %)', pdfMoney(price.totalTTC - price.totalHT), y + 19);
    pdf.setFillColor(...colors.panel);
    pdf.roundedRect(margin, y + 27, pageWidth - margin * 2, 16, 2, 2, 'F');
    pdf.setFillColor(...colors.accent);
    pdf.rect(margin, y + 27, 2, 16, 'F');
    pdf.setTextColor(...colors.ink);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('TOTAL TTC ESTIMATIF', margin + 8, y + 37);
    pdf.text(pdfMoney(price.totalTTC), right - 8, y + 37, { align: 'right' });
    pdf.setTextColor(93, 99, 91);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('Ce document est une estimation et ne constitue pas une facture définitive.', margin, y + 58);
    pdf.text('Un conseiller B&B Pergolas validera les dimensions, la faisabilité et le prix final avant fabrication.', margin, y + 65);
    pdf.setDrawColor(...colors.line);
    pdf.line(margin, 270, right, 270);
    pdf.setFontSize(8);
    pdf.setTextColor(115, 121, 112);
    pdf.text('B&B Pergolas · 68700 Cernay · 06 15 36 75 04 · eminbilici68@gmail.com', margin, 279);
    pdf.text('Merci pour votre confiance.', right, 279, { align: 'right' });
    pdf.save(`${order}-bon-de-commande.pdf`);
  });

  document.querySelector('[data-dismiss-payment]')?.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('payment');
    url.searchParams.delete('order');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash || '#top'}`);
    render();
  });

  document.querySelectorAll('[data-phone-country-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const picker = button.closest('.country-picker');
      const isOpen = picker.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(isOpen));
    });
  });

  document.querySelectorAll('[data-phone-country]').forEach((choice) => {
    choice.addEventListener('click', () => {
      const picker = choice.closest('.country-picker');
      picker.querySelector('input[name="phoneCountry"]').value = choice.dataset.phoneCountry;
      picker.querySelector('[data-phone-country-toggle]').textContent = choice.dataset.phoneCountry;
      picker.classList.remove('is-open');
      picker.querySelector('[data-phone-country-toggle]').setAttribute('aria-expanded', 'false');
    });
  });

  document.querySelectorAll('input[name="firstName"], input[name="lastName"], input[name="city"]').forEach((input) => {
    input.addEventListener('input', capitalizeFirstName);
  });

  const autocompleteFields = ['address', 'postalCode', 'city'];
  const closeAutocompleteLists = () => {
    document.querySelectorAll('.autocomplete-list').forEach((list) => list.classList.remove('is-visible'));
  };
  const showAddressSuggestions = async (input) => {
    const query = input.value.trim();
    const list = document.querySelector(`[data-autocomplete-list="${input.name}"]`);
    if (!list || query.length < 3) {
      list?.classList.remove('is-visible');
      return;
    }
    try {
      const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=6`);
      if (!response.ok) throw new Error('Suggestions indisponibles');
      const data = await response.json();
      const suggestions = data.features ?? [];
      list.innerHTML = suggestions.map((feature) => {
        const properties = feature.properties ?? {};
        return `<button type="button" data-address-suggestion='${JSON.stringify({
          label: properties.label ?? '',
          postcode: properties.postcode ?? '',
          city: properties.city ?? '',
        }).replaceAll("'", '&#039;')}'>${properties.label ?? ''}</button>`;
      }).join('');
      list.classList.toggle('is-visible', suggestions.length > 0);
    } catch (error) {
      console.warn('Address suggestions unavailable:', error.message);
      list.classList.remove('is-visible');
    }
  };
  autocompleteFields.forEach((fieldName) => {
    const input = document.querySelector(`#checkoutForm input[name="${fieldName}"]`);
    input?.addEventListener('input', () => showAddressSuggestions(input));
  });
  document.addEventListener('click', (event) => {
    const suggestion = event.target.closest('[data-address-suggestion]');
    if (suggestion) {
      const value = JSON.parse(suggestion.dataset.addressSuggestion);
      const form = suggestion.closest('form');
      form.querySelector('input[name="address"]').value = value.label;
      form.querySelector('input[name="postalCode"]').value = value.postcode;
      form.querySelector('input[name="city"]').value = value.city;
      closeAutocompleteLists();
      return;
    }
    if (!event.target.closest('.autocomplete-wrap')) closeAutocompleteLists();
  });

  document.querySelectorAll('[data-close-cart]').forEach((button) => {
    button.addEventListener('click', (event) => {
      if (event.currentTarget.matches('a')) state.checkoutOpen = false;
      else state.checkoutOpen = false;
      render();
    });
  });

  document.querySelectorAll('[data-remove-cart]').forEach((button) => {
    button.addEventListener('click', () => {
      state.cart = state.cart.filter((item) => item.id !== button.dataset.removeCart);
      saveCart();
      render();
      state.checkoutOpen = true;
      render();
    });
  });

  document.querySelector('[data-request-cart-quote]')?.addEventListener('click', () => {
    state.checkoutOpen = false;
    render();
    document.querySelector('#demande-devis')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.querySelector('#checkoutForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector('.checkout-status');
    const formData = new FormData(form);
    const phone = formatInternationalPhone(formData.get('phoneCountry'), formData.get('phone'));
    localStorage.setItem('bb-checkout-customer', JSON.stringify({
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone,
      address: formData.get('address'),
      postalCode: formData.get('postalCode'),
      city: formData.get('city'),
    }));
    localStorage.setItem('bb-last-order', JSON.stringify(state.cart));
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Ouverture du paiement sécurisé…';
    fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          firstName: formData.get('firstName'),
          lastName: formData.get('lastName'),
          email: formData.get('email'),
          phone,
          address: formData.get('address'),
          postalCode: formData.get('postalCode'),
          city: formData.get('city'),
        },
        items: state.cart,
      }),
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Le paiement n’a pas pu être préparé.');
      window.location.href = result.url;
    }).catch((error) => {
      status.className = 'checkout-status error';
      status.textContent = error.message;
      submit.disabled = false;
      submit.textContent = 'Continuer vers le paiement';
    });
  });

  document.querySelector('#quoteForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector('#quoteStatus');
    const submit = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    data.phone = formatInternationalPhone(data.phoneCountry, data.phone);
    delete data.phoneCountry;
    submit.disabled = true;
    status.className = 'quote-status';
    status.textContent = 'Envoi de votre demande…';
    try {
      const response = await fetch('/api/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          configuration: {
            productId: getProduct().id,
            materialId: state.materialId,
            widthCm: state.width,
            depthCm: state.depth,
            optionIds: [...state.options],
            sideSelections: state.sideSelections,
            construction: state.construction,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Impossible d’envoyer la demande.');
      status.className = 'quote-status success';
      status.textContent = `${result.message} Référence : ${result.requestId}.`;
      form.reset();
    } catch (error) {
      status.className = 'quote-status error';
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  const header = document.querySelector('#header');
  const onScroll = () => {
    if (window.scrollY > 10) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  window.removeEventListener('scroll', onScroll);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.01, rootMargin: '0px 0px 18% 0px' });

  document.querySelectorAll('.section, .product-card, .stat, .journey-step, .quote-request, .technical-tabs').forEach((element, index) => {
    element.classList.add('scroll-3d');
    element.style.setProperty('--reveal-delay', `${Math.min(index * 45, 260)}ms`);
    revealObserver.observe(element);
  });
}

(async () => {
  await fetchCatalog();
  render();
})();
