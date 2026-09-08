import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';
import { jsPDF } from 'jspdf';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 3001);
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(ROOT_DIR, '..', 'dist');
const QUOTE_RECIPIENT = process.env.QUOTE_RECIPIENT || 'eminbilici68@gmail.com';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const safeFilePart = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
const PRODUCT_CATALOG = [
  {
    id: 'pergola-bioclimatique',
    name: 'Pergola bioclimatique',
    description: 'Pergola bioclimatique aluminium sur mesure.',
    basePriceHT: 450,
    vat: 0.2,
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
  },
  {
    id: 'pergola-classique',
    name: 'Pergola classique',
    description: 'Pergola classique toile rétractable.',
    basePriceHT: 320,
    vat: 0.2,
    materials: [
      { id: 'alu', name: 'Aluminium', priceParM2HT: 195 },
    ],
    constraints: { widthMinCm: 150, widthMaxCm: 500, depthMinCm: 150, depthMaxCm: 350 },
    options: [
      { id: 'led', name: 'Éclairage LED', typeCalcul: 'forfait', valueHT: 150 },
      { id: 'toile', name: 'Toile brise-vue', typeCalcul: 'parM2', valueHT: 28 },
    ],
    sideOptions: { store: { name: 'Store vertical', priceParMLHT: 220 }, vitrage: { name: 'Paroi vitrée', priceParMLHT: 620 } },
  },
  {
    id: 'veranda',
    name: 'Véranda',
    description: 'Véranda aluminium sur mesure.',
    basePriceHT: 900,
    vat: 0.2,
    materials: [
      { id: 'alu', name: 'Aluminium', priceParM2HT: 950 },
    ],
    constraints: { widthMinCm: 250, widthMaxCm: 700, depthMinCm: 250, depthMaxCm: 500 },
    options: [
      { id: 'triple', name: 'Vitrage triple', typeCalcul: 'pourcentageStructure', valueHT: 12 },
      { id: 'porte', name: 'Porte coulissante', typeCalcul: 'forfait', valueHT: 850 },
    ],
    sideOptions: { vitrage: { name: 'Baie vitrée coulissante', priceParMLHT: 760 } },
  },
];

const app = express();
app.use(cors());
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Stripe webhook non configuré');
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Webhook invalide: ${error.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error(`Paiement ${session.id} reçu mais e-mail non envoyé : variables SMTP manquantes.`);
      return res.status(503).send('Service e-mail non configuré');
    }
    const customerEmail = session.customer_details?.email || session.customer_email;
    if (customerEmail) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      });
      const orderId = session.metadata?.orderId || session.id;
      const total = session.amount_total ? `${(session.amount_total / 100).toFixed(2).replace('.', ',')} €` : 'Montant à confirmer';
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      pdf.setFillColor(145, 69, 38);
      pdf.rect(0, 0, 210, 3, 'F');
      pdf.setTextColor(36, 40, 31);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.text('B&B Pergolas', 18, 22);
      pdf.setFontSize(15);
      pdf.text('BON DE COMMANDE', 192, 22, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(104, 109, 101);
      pdf.text(`Référence : ${orderId}`, 18, 33);
      pdf.text(`Client : ${session.metadata?.firstName || ''} ${session.metadata?.lastName || ''}`, 18, 41);
      pdf.text(`Montant TTC : ${total}`, 18, 49);
      pdf.setDrawColor(224, 222, 214);
      pdf.line(18, 59, 192, 59);
      pdf.setTextColor(36, 40, 31);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Confirmation de commande', 18, 73);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.text('Merci pour votre paiement. Votre commande a bien été enregistrée.', 18, 84);
      pdf.text('Un conseiller B&B Pergolas vérifiera votre projet avant fabrication.', 18, 93);
      pdf.setFontSize(9);
      pdf.setTextColor(104, 109, 101);
      pdf.text('B&B Pergolas · 68700 Cernay · 06 15 36 75 04 · eminbilici68@gmail.com', 18, 275);
      const firstName = safeFilePart(session.metadata?.firstName || 'Client');
      const lastName = safeFilePart(session.metadata?.lastName || '');
      const customerName = `${firstName} ${lastName}`.trim();
      const pdfAttachment = Buffer.from(pdf.output('arraybuffer'));
      try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: customerEmail,
        bcc: QUOTE_RECIPIENT,
        subject: `B&B Pergolas — Confirmation de votre commande ${orderId}`,
        text: [
          `Bonjour ${customerName},`,
          '',
          'Nous vous remercions pour votre confiance. Votre commande a bien été enregistrée.',
          `Référence : ${orderId}`,
          `Montant TTC : ${total}`,
          '',
          'Vous trouverez votre bon de commande en pièce jointe.',
          'Un conseiller B&B Pergolas vérifiera les dimensions et la faisabilité de votre projet avant la fabrication, puis vous recontactera pour la suite.',
          '',
          'Bien cordialement,',
          'L’équipe B&B Pergolas',
          '68700 Cernay · 06 15 36 75 04 · eminbilici68@gmail.com',
        ].join('\n'),
        html: `
          <div style="margin:0;background:#f3f1ec;padding:36px 16px;font-family:Arial,Helvetica,sans-serif;color:#252820;">
            <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e1ded5;">
              <div style="height:5px;background:#a85226;"></div>
              <div style="padding:28px 34px 22px;border-bottom:1px solid #ebe8e1;">
                <div style="font-size:23px;font-weight:700;letter-spacing:-.5px;color:#24281f;">B&amp;B <span style="color:#a85226;">Pergolas</span></div>
                <div style="margin-top:7px;font-size:10px;letter-spacing:1.5px;color:#858a82;">CONCEPTION ET INSTALLATION SUR MESURE</div>
              </div>
              <div style="padding:32px 34px;">
                <div style="display:inline-block;padding:7px 10px;background:#f5e8df;color:#a85226;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Commande confirmée</div>
                <h1 style="margin:18px 0 12px;font-size:25px;line-height:1.25;color:#24281f;">Merci pour votre confiance, ${escapeHtml(customerName)}.</h1>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#5d635b;">Nous vous confirmons l’enregistrement de votre commande. Votre bon de commande est joint à cet e-mail.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f8f7f3;border:1px solid #ebe8e1;">
                  <tr><td style="padding:13px 15px;color:#747a72;font-size:12px;border-bottom:1px solid #ebe8e1;">Référence</td><td style="padding:13px 15px;text-align:right;color:#24281f;font-size:13px;font-weight:700;border-bottom:1px solid #ebe8e1;">${escapeHtml(orderId)}</td></tr>
                  <tr><td style="padding:13px 15px;color:#747a72;font-size:12px;">Montant TTC</td><td style="padding:13px 15px;text-align:right;color:#a85226;font-size:15px;font-weight:700;">${escapeHtml(total)}</td></tr>
                </table>
                <h2 style="margin:28px 0 8px;font-size:15px;color:#24281f;">Les prochaines étapes</h2>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#5d635b;">Notre conseiller vérifiera les dimensions et la faisabilité de votre projet avant fabrication. Nous vous recontacterons ensuite pour confirmer les derniers détails.</p>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#5d635b;">Si vous avez la moindre question, notre équipe reste à votre écoute.</p>
              </div>
              <div style="padding:22px 34px;background:#24281f;color:#ffffff;">
                <div style="font-size:17px;font-weight:700;">B&amp;B <span style="color:#d98b52;">Pergolas</span></div>
                <div style="margin-top:8px;font-size:12px;line-height:1.7;color:#d9ddd7;">68700 Cernay · 06 15 36 75 04<br><a href="mailto:eminbilici68@gmail.com" style="color:#f0b28a;text-decoration:none;">eminbilici68@gmail.com</a></div>
                <div style="margin-top:18px;padding-top:12px;border-top:1px solid #4c514b;font-size:11px;color:#aeb5ac;">Au plaisir de vous accompagner dans votre projet extérieur.</div>
              </div>
            </div>
          </div>`,
        attachments: [{ filename: `Bon de commande - ${customerName}.pdf`, content: pdfAttachment, contentType: 'application/pdf' }],
      } catch (error) {
        console.error(`Paiement ${session.id} confirmé, mais e-mail non envoyé :`, error);
      }

    }
    console.log(`Paiement Stripe confirmé et e-mails envoyés : ${session.id}`);
  }
  return res.json({ received: true });
});
app.use(express.json());

function calculateQuotation(product, config) {
  const material = product.materials.find((candidate) => candidate.id === config.materialId);
  if (!material) {
    throw new Error('Matériau invalide pour ce produit');
  }

  const { widthMinCm, widthMaxCm, depthMinCm, depthMaxCm, surfaceMaxM2 } = product.constraints;
  if (config.widthCm < widthMinCm || config.widthCm > widthMaxCm) {
    throw new Error(`Largeur hors limites (${widthMinCm}–${widthMaxCm} cm)`);
  }
  if (config.depthCm < depthMinCm || config.depthCm > depthMaxCm) {
    throw new Error(`Profondeur hors limites (${depthMinCm}–${depthMaxCm} cm)`);
  }

  const surfaceM2 = (config.widthCm / 100) * (config.depthCm / 100);
  if (surfaceMaxM2 && surfaceM2 > surfaceMaxM2) {
    throw new Error(`Surface ${surfaceM2.toFixed(1)} m² supérieure au maximum autorisé (${surfaceMaxM2} m²)`);
  }

  let totalHT = product.basePriceHT + surfaceM2 * material.priceParM2HT;
  const lines = [
    { libelle: 'Forfait de base', montantHT: product.basePriceHT },
    { libelle: `Structure ${material.name} — ${surfaceM2.toFixed(2)} m²`, montantHT: surfaceM2 * material.priceParM2HT },
  ];

  for (const optionId of config.optionIds || []) {
    const option = product.options.find((candidate) => candidate.id === optionId);
    if (!option) continue;

    let optionAmount = 0;
    if (option.typeCalcul === 'forfait') optionAmount = option.valueHT;
    if (option.typeCalcul === 'parM2') optionAmount = option.valueHT * surfaceM2;
    if (option.typeCalcul === 'pourcentageStructure') optionAmount = (surfaceM2 * material.priceParM2HT) * (option.valueHT / 100);

    lines.push({ libelle: option.name, montantHT: optionAmount });
    totalHT += optionAmount;
  }

  for (const [side, type] of Object.entries(config.sideSelections || {})) {
    const sideOption = product.sideOptions?.[type];
    if (!sideOption || !['haut', 'bas', 'gauche', 'droite'].includes(side)) continue;
    if (config.construction === 'adossee' && side === 'haut') {
      throw new Error('Le côté adossé à la façade ne peut pas recevoir de store ou de baie vitrée.');
    }
    const lengthCm = side === 'haut' || side === 'bas' ? config.widthCm : config.depthCm;
    const amount = (lengthCm / 100) * sideOption.priceParMLHT;
    lines.push({ libelle: `${sideOption.name} — côté ${side} (${(lengthCm / 100).toFixed(2)} m)`, montantHT: amount });
    totalHT += amount;
  }

  return {
    lines,
    totalHT,
    totalTTC: totalHT * (1 + product.vat),
    tauxTVA: product.vat,
  };
}

app.get('/api/products', (req, res) => {
  res.json(PRODUCT_CATALOG.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    featured: product.id === 'pergola-bioclimatique',
    image: product.id === 'pergola-bioclimatique'
      ? '/pergola-bioclimatique-cocoon-xl-mixte-gris-anthracite-blanc-700x4987m.webp'
      : product.id === 'pergola-classique'
        ? 'https://bbpergolas.com/wp-content/uploads/2026/01/16F4D4B6-A771-45ED-A379-CEE252636320.png.webp'
        : 'https://bbpergolas.com/wp-content/uploads/2026/01/vitre.jpeg.webp',
    tagline: product.id === 'pergola-bioclimatique' ? 'Lames orientables' : product.id === 'pergola-classique' ? 'Toile rétractable' : 'Grandes vitrines',
    basePriceHT: product.basePriceHT,
    vat: product.vat,
    materials: product.materials,
    constraints: product.constraints,
    options: product.options,
    sideOptions: product.sideOptions,
  })));
});

app.post('/api/quote', (req, res) => {
  const {
    productId,
    materialId,
    widthCm,
    depthCm,
    optionIds = [],
    sideSelections = {},
    construction = 'autoportee',
    typeClient = 'particulier',
  } = req.body || {};

  if (!productId || !materialId || !widthCm || !depthCm) {
    return res.status(400).json({ error: 'Données incomplètes pour le devis.' });
  }

  const product = PRODUCT_CATALOG.find((entry) => entry.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Produit introuvable.' });
  }

  try {
    const result = calculateQuotation(product, { materialId, widthCm, depthCm, optionIds, sideSelections, construction });
    const orderId = `BB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    return res.json({
      ...result,
      orderId,
      typeClient,
      totalHT: result.totalHT,
      totalTTC: result.totalTTC,
    });
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

app.post('/api/quote-request', async (req, res) => {
  const { firstName, lastName, email, phone, message = '', configuration = {} } = req.body || {};
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Merci de renseigner votre nom, prénom, e-mail et téléphone.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'L’adresse e-mail n’est pas valide.' });
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    return res.status(503).json({ error: 'Le service d’envoi des demandes est momentanément indisponible.' });
  }

  const requestId = `DEV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });

  const configurationLines = Object.entries(configuration)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join('\n');
  const configurationHtml = Object.entries(configuration)
    .map(([key, value]) => `
      <tr>
        <td style="padding:10px 0;color:#70766f;font-size:13px;border-bottom:1px solid #e9e6df;">${escapeHtml(key)}</td>
        <td style="padding:10px 0;text-align:right;color:#20251f;font-size:13px;font-weight:600;border-bottom:1px solid #e9e6df;">${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value)}</td>
      </tr>`)
    .join('');

  try {
    await transporter.sendMail({
      from: SMTP_USER,
      to: QUOTE_RECIPIENT,
      replyTo: email.trim(),
      subject: `Nouvelle demande de devis ${requestId} — ${firstName.trim()} ${lastName.trim()}`,
      text: [
        `Référence : ${requestId}`,
        `Client : ${firstName.trim()} ${lastName.trim()}`,
        `E-mail : ${email.trim()}`,
        `Téléphone : ${phone.trim()}`,
        '',
        'Configuration :',
        configurationLines || 'Non renseignée',
        '',
        'Message :',
        message.trim() || 'Aucun message complémentaire.',
      ].join('\n'),
      html: `
        <div style="margin:0;background:#f4f1eb;padding:32px 16px;font-family:Arial,sans-serif;color:#20251f;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e0d7;">
            <div style="padding:28px 32px;background:#20251f;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c9d0c8;">B&amp;B Pergolas</div>
              <h1 style="margin:12px 0 4px;font-size:25px;font-weight:600;">Nouvelle demande de devis</h1>
              <div style="font-size:13px;color:#d8ddd7;">Référence ${escapeHtml(requestId)}</div>
            </div>
            <div style="padding:28px 32px;">
              <div style="display:inline-block;margin-bottom:22px;padding:7px 10px;background:#f0e2d8;color:#a85226;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">À traiter</div>
              <h2 style="margin:0 0 14px;font-size:18px;">${escapeHtml(firstName.trim())} ${escapeHtml(lastName.trim())} souhaite un devis.</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr><td style="padding:11px 0;color:#70766f;font-size:13px;border-bottom:1px solid #e9e6df;">E-mail</td><td style="padding:11px 0;text-align:right;font-size:13px;border-bottom:1px solid #e9e6df;"><a href="mailto:${escapeHtml(email.trim())}" style="color:#a85226;">${escapeHtml(email.trim())}</a></td></tr>
                <tr><td style="padding:11px 0;color:#70766f;font-size:13px;border-bottom:1px solid #e9e6df;">Téléphone</td><td style="padding:11px 0;text-align:right;font-size:13px;border-bottom:1px solid #e9e6df;"><a href="tel:${escapeHtml(phone.trim())}" style="color:#a85226;">${escapeHtml(phone.trim())}</a></td></tr>
              </table>
              <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Configuration du projet</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">${configurationHtml}</table>
              <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Message du client</h3>
              <div style="padding:16px;background:#f7f5f0;color:#50574f;font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(message.trim() || 'Aucun message complémentaire.')}</div>
              <a href="mailto:${escapeHtml(email.trim())}?subject=Votre%20projet%20B%26B%20Pergolas%20%2D%20${encodeURIComponent(requestId)}" style="display:inline-block;margin-top:24px;padding:13px 18px;background:#a85226;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;">Répondre au client</a>
            </div>
            <div style="padding:18px 32px;border-top:1px solid #e9e6df;color:#8a9088;font-size:11px;">B&amp;B Pergolas · 68700 Cernay · 06 15 36 75 04</div>
          </div>
        </div>`,
    });
  } catch (error) {
    console.error(`Échec d’envoi de la demande ${requestId}:`, error);
    return res.status(502).json({ error: 'La demande n’a pas pu être envoyée. Veuillez réessayer.' });
  }

  return res.status(201).json({
    requestId,
    message: 'Votre demande a bien été envoyée. Un conseiller B&B vous recontactera rapidement.',
  });
});

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Le paiement sécurisé sera disponible après configuration de Stripe.' });
  }
  const { customer = {}, items = [] } = req.body || {};
  if (!customer.firstName?.trim() || !customer.lastName?.trim() || !customer.email?.trim() || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Informations client ou panier incomplets.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
    return res.status(400).json({ error: 'L’adresse e-mail n’est pas valide.' });
  }
  try {
    const orderId = `BB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const baseUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
    const customerAddress = customer.address?.trim() && customer.postalCode?.trim() && customer.city?.trim()
      ? {
          line1: customer.address.trim(),
          postal_code: customer.postalCode.trim(),
          city: customer.city.trim(),
          country: 'FR',
        }
      : undefined;
    const stripeCustomer = await stripe.customers.create({
      name: `${customer.firstName.trim()} ${customer.lastName.trim()}`,
      email: customer.email.trim(),
      phone: customer.phone?.trim() || undefined,
      address: customerAddress,
      metadata: { orderId, source: 'bb-pergolas-checkout' },
    });
    const lineItems = items.map((item) => {
      const product = PRODUCT_CATALOG.find((entry) => entry.id === item.productId);
      if (!product) throw new Error('Produit du panier introuvable.');
      const quotation = calculateQuotation(product, {
        materialId: item.materialId,
        widthCm: Number(item.width),
        depthCm: Number(item.depth),
        optionIds: item.optionIds,
        sideSelections: item.sideSelections,
        construction: item.construction,
      });
      return {
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(quotation.totalTTC * 100),
          product_data: {
            name: `${product.name} — ${item.width} × ${item.depth} cm`,
            description: `Configuration sur mesure B&B Pergolas • ${item.materialId || 'Aluminium'} • Prix TTC`,
            images: [item.image?.startsWith('http')
              ? item.image
              : `${baseUrl}${item.image?.startsWith('/') ? item.image : '/pergola-bioclimatique-cocoon-xl-mixte-gris-anthracite-blanc-700x4987m.webp'}`],
          },
        },
        quantity: Math.max(1, Math.min(10, Number(item.quantity) || 1)),
      };
    });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'fr',
      customer: stripeCustomer.id,
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ['FR'] },
      line_items: lineItems,
      success_url: `${baseUrl}/?payment=success&order=${encodeURIComponent(orderId)}&session_id={CHECKOUT_SESSION_ID}#top`,
      cancel_url: `${baseUrl}/?payment=cancelled#top`,
      custom_text: {
        submit: {
          message: 'Paiement sécurisé par Stripe. Votre bon de commande vous sera envoyé par e-mail après confirmation.',
        },
        after_submit: {
          message: 'Merci pour votre confiance. B&B Pergolas va préparer la confirmation de votre projet.',
        },
      },
      payment_intent_data: {
        description: `B&B Pergolas — commande ${orderId}`,
        receipt_email: customer.email.trim(),
        metadata: { orderId },
      },
      metadata: { orderId, firstName: customer.firstName.trim(), lastName: customer.lastName.trim() },
    });
    return res.json({ url: session.url, orderId });
  } catch (error) {
    return res.status(422).json({ error: error.message || 'Impossible de créer la session de paiement.' });
  }
});

app.use(express.static(DIST_DIR));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(DIST_DIR, 'index.html'));
});

export function createServer(port = PORT) {
  return app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  createServer();
}
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';
import { jsPDF } from 'jspdf';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 3001);
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(ROOT_DIR, '..', 'dist');
const QUOTE_RECIPIENT = process.env.QUOTE_RECIPIENT || 'eminbilici68@gmail.com';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const safeFilePart = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
const PRODUCT_CATALOG = [
  {
    id: 'pergola-bioclimatique',
    name: 'Pergola bioclimatique',
    description: 'Pergola bioclimatique aluminium sur mesure.',
    basePriceHT: 450,
    vat: 0.2,
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
  },
  {
    id: 'pergola-classique',
    name: 'Pergola classique',
    description: 'Pergola classique toile rétractable.',
    basePriceHT: 320,
    vat: 0.2,
    materials: [
      { id: 'alu', name: 'Aluminium', priceParM2HT: 195 },
    ],
    constraints: { widthMinCm: 150, widthMaxCm: 500, depthMinCm: 150, depthMaxCm: 350 },
    options: [
      { id: 'led', name: 'Éclairage LED', typeCalcul: 'forfait', valueHT: 150 },
      { id: 'toile', name: 'Toile brise-vue', typeCalcul: 'parM2', valueHT: 28 },
    ],
    sideOptions: { store: { name: 'Store vertical', priceParMLHT: 220 }, vitrage: { name: 'Paroi vitrée', priceParMLHT: 620 } },
  },
  {
    id: 'veranda',
    name: 'Véranda',
    description: 'Véranda aluminium sur mesure.',
    basePriceHT: 900,
    vat: 0.2,
    materials: [
      { id: 'alu', name: 'Aluminium', priceParM2HT: 950 },
    ],
    constraints: { widthMinCm: 250, widthMaxCm: 700, depthMinCm: 250, depthMaxCm: 500 },
    options: [
      { id: 'triple', name: 'Vitrage triple', typeCalcul: 'pourcentageStructure', valueHT: 12 },
      { id: 'porte', name: 'Porte coulissante', typeCalcul: 'forfait', valueHT: 850 },
    ],
    sideOptions: { vitrage: { name: 'Baie vitrée coulissante', priceParMLHT: 760 } },
  },
];

const app = express();
app.use(cors());
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Stripe webhook non configuré');
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Webhook invalide: ${error.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error(`Paiement ${session.id} reçu mais e-mail non envoyé : variables SMTP manquantes.`);
      return res.status(503).send('Service e-mail non configuré');
    }
    const customerEmail = session.customer_details?.email || session.customer_email;
    if (customerEmail) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      });
      const orderId = session.metadata?.orderId || session.id;
      const total = session.amount_total ? `${(session.amount_total / 100).toFixed(2).replace('.', ',')} €` : 'Montant à confirmer';
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      pdf.setFillColor(145, 69, 38);
      pdf.rect(0, 0, 210, 3, 'F');
      pdf.setTextColor(36, 40, 31);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.text('B&B Pergolas', 18, 22);
      pdf.setFontSize(15);
      pdf.text('BON DE COMMANDE', 192, 22, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(104, 109, 101);
      pdf.text(`Référence : ${orderId}`, 18, 33);
      pdf.text(`Client : ${session.metadata?.firstName || ''} ${session.metadata?.lastName || ''}`, 18, 41);
      pdf.text(`Montant TTC : ${total}`, 18, 49);
      pdf.setDrawColor(224, 222, 214);
      pdf.line(18, 59, 192, 59);
      pdf.setTextColor(36, 40, 31);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Confirmation de commande', 18, 73);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.text('Merci pour votre paiement. Votre commande a bien été enregistrée.', 18, 84);
      pdf.text('Un conseiller B&B Pergolas vérifiera votre projet avant fabrication.', 18, 93);
      pdf.setFontSize(9);
      pdf.setTextColor(104, 109, 101);
      pdf.text('B&B Pergolas · 68700 Cernay · 06 15 36 75 04 · eminbilici68@gmail.com', 18, 275);
      const firstName = safeFilePart(session.metadata?.firstName || 'Client');
      const lastName = safeFilePart(session.metadata?.lastName || '');
      const customerName = `${firstName} ${lastName}`.trim();
      const pdfAttachment = Buffer.from(pdf.output('arraybuffer'));
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: customerEmail,
        bcc: QUOTE_RECIPIENT,
        subject: `B&B Pergolas — Confirmation de votre commande ${orderId}`,
        text: [
          `Bonjour ${customerName},`,
          '',
          'Nous vous remercions pour votre confiance. Votre commande a bien été enregistrée.',
          `Référence : ${orderId}`,
          `Montant TTC : ${total}`,
          '',
          'Vous trouverez votre bon de commande en pièce jointe.',
          'Un conseiller B&B Pergolas vérifiera les dimensions et la faisabilité de votre projet avant la fabrication, puis vous recontactera pour la suite.',
          '',
          'Bien cordialement,',
          'L’équipe B&B Pergolas',
          '68700 Cernay · 06 15 36 75 04 · eminbilici68@gmail.com',
        ].join('\n'),
        html: `
          <div style="margin:0;background:#f3f1ec;padding:36px 16px;font-family:Arial,Helvetica,sans-serif;color:#252820;">
            <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e1ded5;">
              <div style="height:5px;background:#a85226;"></div>
              <div style="padding:28px 34px 22px;border-bottom:1px solid #ebe8e1;">
                <div style="font-size:23px;font-weight:700;letter-spacing:-.5px;color:#24281f;">B&amp;B <span style="color:#a85226;">Pergolas</span></div>
                <div style="margin-top:7px;font-size:10px;letter-spacing:1.5px;color:#858a82;">CONCEPTION ET INSTALLATION SUR MESURE</div>
              </div>
              <div style="padding:32px 34px;">
                <div style="display:inline-block;padding:7px 10px;background:#f5e8df;color:#a85226;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Commande confirmée</div>
                <h1 style="margin:18px 0 12px;font-size:25px;line-height:1.25;color:#24281f;">Merci pour votre confiance, ${escapeHtml(customerName)}.</h1>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#5d635b;">Nous vous confirmons l’enregistrement de votre commande. Votre bon de commande est joint à cet e-mail.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f8f7f3;border:1px solid #ebe8e1;">
                  <tr><td style="padding:13px 15px;color:#747a72;font-size:12px;border-bottom:1px solid #ebe8e1;">Référence</td><td style="padding:13px 15px;text-align:right;color:#24281f;font-size:13px;font-weight:700;border-bottom:1px solid #ebe8e1;">${escapeHtml(orderId)}</td></tr>
                  <tr><td style="padding:13px 15px;color:#747a72;font-size:12px;">Montant TTC</td><td style="padding:13px 15px;text-align:right;color:#a85226;font-size:15px;font-weight:700;">${escapeHtml(total)}</td></tr>
                </table>
                <h2 style="margin:28px 0 8px;font-size:15px;color:#24281f;">Les prochaines étapes</h2>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#5d635b;">Notre conseiller vérifiera les dimensions et la faisabilité de votre projet avant fabrication. Nous vous recontacterons ensuite pour confirmer les derniers détails.</p>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#5d635b;">Si vous avez la moindre question, notre équipe reste à votre écoute.</p>
              </div>
              <div style="padding:22px 34px;background:#24281f;color:#ffffff;">
                <div style="font-size:17px;font-weight:700;">B&amp;B <span style="color:#d98b52;">Pergolas</span></div>
                <div style="margin-top:8px;font-size:12px;line-height:1.7;color:#d9ddd7;">68700 Cernay · 06 15 36 75 04<br><a href="mailto:eminbilici68@gmail.com" style="color:#f0b28a;text-decoration:none;">eminbilici68@gmail.com</a></div>
                <div style="margin-top:18px;padding-top:12px;border-top:1px solid #4c514b;font-size:11px;color:#aeb5ac;">Au plaisir de vous accompagner dans votre projet extérieur.</div>
              </div>
            </div>
          </div>`,
        attachments: [{ filename: `Bon de commande - ${customerName}.pdf`, content: pdfAttachment, contentType: 'application/pdf' }],
      });
    }
    console.log(`Paiement Stripe confirmé et e-mails envoyés : ${session.id}`);
  }
  return res.json({ received: true });
});
app.use(express.json());

function calculateQuotation(product, config) {
  const material = product.materials.find((candidate) => candidate.id === config.materialId);
  if (!material) {
    throw new Error('Matériau invalide pour ce produit');
  }

  const { widthMinCm, widthMaxCm, depthMinCm, depthMaxCm, surfaceMaxM2 } = product.constraints;
  if (config.widthCm < widthMinCm || config.widthCm > widthMaxCm) {
    throw new Error(`Largeur hors limites (${widthMinCm}–${widthMaxCm} cm)`);
  }
  if (config.depthCm < depthMinCm || config.depthCm > depthMaxCm) {
    throw new Error(`Profondeur hors limites (${depthMinCm}–${depthMaxCm} cm)`);
  }

  const surfaceM2 = (config.widthCm / 100) * (config.depthCm / 100);
  if (surfaceMaxM2 && surfaceM2 > surfaceMaxM2) {
    throw new Error(`Surface ${surfaceM2.toFixed(1)} m² supérieure au maximum autorisé (${surfaceMaxM2} m²)`);
  }

  let totalHT = product.basePriceHT + surfaceM2 * material.priceParM2HT;
  const lines = [
    { libelle: 'Forfait de base', montantHT: product.basePriceHT },
    { libelle: `Structure ${material.name} — ${surfaceM2.toFixed(2)} m²`, montantHT: surfaceM2 * material.priceParM2HT },
  ];

  for (const optionId of config.optionIds || []) {
    const option = product.options.find((candidate) => candidate.id === optionId);
    if (!option) continue;

    let optionAmount = 0;
    if (option.typeCalcul === 'forfait') optionAmount = option.valueHT;
    if (option.typeCalcul === 'parM2') optionAmount = option.valueHT * surfaceM2;
    if (option.typeCalcul === 'pourcentageStructure') optionAmount = (surfaceM2 * material.priceParM2HT) * (option.valueHT / 100);

    lines.push({ libelle: option.name, montantHT: optionAmount });
    totalHT += optionAmount;
  }

  for (const [side, type] of Object.entries(config.sideSelections || {})) {
    const sideOption = product.sideOptions?.[type];
    if (!sideOption || !['haut', 'bas', 'gauche', 'droite'].includes(side)) continue;
    if (config.construction === 'adossee' && side === 'haut') {
      throw new Error('Le côté adossé à la façade ne peut pas recevoir de store ou de baie vitrée.');
    }
    const lengthCm = side === 'haut' || side === 'bas' ? config.widthCm : config.depthCm;
    const amount = (lengthCm / 100) * sideOption.priceParMLHT;
    lines.push({ libelle: `${sideOption.name} — côté ${side} (${(lengthCm / 100).toFixed(2)} m)`, montantHT: amount });
    totalHT += amount;
  }

  return {
    lines,
    totalHT,
    totalTTC: totalHT * (1 + product.vat),
    tauxTVA: product.vat,
  };
}

app.get('/api/products', (req, res) => {
  res.json(PRODUCT_CATALOG.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    featured: product.id === 'pergola-bioclimatique',
    image: product.id === 'pergola-bioclimatique'
      ? '/pergola-bioclimatique-cocoon-xl-mixte-gris-anthracite-blanc-700x4987m.webp'
      : product.id === 'pergola-classique'
        ? 'https://bbpergolas.com/wp-content/uploads/2026/01/16F4D4B6-A771-45ED-A379-CEE252636320.png.webp'
        : 'https://bbpergolas.com/wp-content/uploads/2026/01/vitre.jpeg.webp',
    tagline: product.id === 'pergola-bioclimatique' ? 'Lames orientables' : product.id === 'pergola-classique' ? 'Toile rétractable' : 'Grandes vitrines',
    basePriceHT: product.basePriceHT,
    vat: product.vat,
    materials: product.materials,
    constraints: product.constraints,
    options: product.options,
    sideOptions: product.sideOptions,
  })));
});

app.post('/api/quote', (req, res) => {
  const {
    productId,
    materialId,
    widthCm,
    depthCm,
    optionIds = [],
    sideSelections = {},
    construction = 'autoportee',
    typeClient = 'particulier',
  } = req.body || {};

  if (!productId || !materialId || !widthCm || !depthCm) {
    return res.status(400).json({ error: 'Données incomplètes pour le devis.' });
  }

  const product = PRODUCT_CATALOG.find((entry) => entry.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Produit introuvable.' });
  }

  try {
    const result = calculateQuotation(product, { materialId, widthCm, depthCm, optionIds, sideSelections, construction });
    const orderId = `BB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    return res.json({
      ...result,
      orderId,
      typeClient,
      totalHT: result.totalHT,
      totalTTC: result.totalTTC,
    });
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

app.post('/api/quote-request', async (req, res) => {
  const { firstName, lastName, email, phone, message = '', configuration = {} } = req.body || {};
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Merci de renseigner votre nom, prénom, e-mail et téléphone.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'L’adresse e-mail n’est pas valide.' });
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    return res.status(503).json({ error: 'Le service d’envoi des demandes est momentanément indisponible.' });
  }

  const requestId = `DEV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });

  const configurationLines = Object.entries(configuration)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join('\n');
  const configurationHtml = Object.entries(configuration)
    .map(([key, value]) => `
      <tr>
        <td style="padding:10px 0;color:#70766f;font-size:13px;border-bottom:1px solid #e9e6df;">${escapeHtml(key)}</td>
        <td style="padding:10px 0;text-align:right;color:#20251f;font-size:13px;font-weight:600;border-bottom:1px solid #e9e6df;">${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value)}</td>
      </tr>`)
    .join('');

  try {
    await transporter.sendMail({
      from: SMTP_USER,
      to: QUOTE_RECIPIENT,
      replyTo: email.trim(),
      subject: `Nouvelle demande de devis ${requestId} — ${firstName.trim()} ${lastName.trim()}`,
      text: [
        `Référence : ${requestId}`,
        `Client : ${firstName.trim()} ${lastName.trim()}`,
        `E-mail : ${email.trim()}`,
        `Téléphone : ${phone.trim()}`,
        '',
        'Configuration :',
        configurationLines || 'Non renseignée',
        '',
        'Message :',
        message.trim() || 'Aucun message complémentaire.',
      ].join('\n'),
      html: `
        <div style="margin:0;background:#f4f1eb;padding:32px 16px;font-family:Arial,sans-serif;color:#20251f;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e0d7;">
            <div style="padding:28px 32px;background:#20251f;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c9d0c8;">B&amp;B Pergolas</div>
              <h1 style="margin:12px 0 4px;font-size:25px;font-weight:600;">Nouvelle demande de devis</h1>
              <div style="font-size:13px;color:#d8ddd7;">Référence ${escapeHtml(requestId)}</div>
            </div>
            <div style="padding:28px 32px;">
              <div style="display:inline-block;margin-bottom:22px;padding:7px 10px;background:#f0e2d8;color:#a85226;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">À traiter</div>
              <h2 style="margin:0 0 14px;font-size:18px;">${escapeHtml(firstName.trim())} ${escapeHtml(lastName.trim())} souhaite un devis.</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr><td style="padding:11px 0;color:#70766f;font-size:13px;border-bottom:1px solid #e9e6df;">E-mail</td><td style="padding:11px 0;text-align:right;font-size:13px;border-bottom:1px solid #e9e6df;"><a href="mailto:${escapeHtml(email.trim())}" style="color:#a85226;">${escapeHtml(email.trim())}</a></td></tr>
                <tr><td style="padding:11px 0;color:#70766f;font-size:13px;border-bottom:1px solid #e9e6df;">Téléphone</td><td style="padding:11px 0;text-align:right;font-size:13px;border-bottom:1px solid #e9e6df;"><a href="tel:${escapeHtml(phone.trim())}" style="color:#a85226;">${escapeHtml(phone.trim())}</a></td></tr>
              </table>
              <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Configuration du projet</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">${configurationHtml}</table>
              <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Message du client</h3>
              <div style="padding:16px;background:#f7f5f0;color:#50574f;font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(message.trim() || 'Aucun message complémentaire.')}</div>
              <a href="mailto:${escapeHtml(email.trim())}?subject=Votre%20projet%20B%26B%20Pergolas%20%2D%20${encodeURIComponent(requestId)}" style="display:inline-block;margin-top:24px;padding:13px 18px;background:#a85226;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;">Répondre au client</a>
            </div>
            <div style="padding:18px 32px;border-top:1px solid #e9e6df;color:#8a9088;font-size:11px;">B&amp;B Pergolas · 68700 Cernay · 06 15 36 75 04</div>
          </div>
        </div>`,
    });
  } catch (error) {
    console.error(`Échec d’envoi de la demande ${requestId}:`, error);
    return res.status(502).json({ error: 'La demande n’a pas pu être envoyée. Veuillez réessayer.' });
  }

  return res.status(201).json({
    requestId,
    message: 'Votre demande a bien été envoyée. Un conseiller B&B vous recontactera rapidement.',
  });
});

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Le paiement sécurisé sera disponible après configuration de Stripe.' });
  }
  const { customer = {}, items = [] } = req.body || {};
  if (!customer.firstName?.trim() || !customer.lastName?.trim() || !customer.email?.trim() || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Informations client ou panier incomplets.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
    return res.status(400).json({ error: 'L’adresse e-mail n’est pas valide.' });
  }
  try {
    const orderId = `BB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const baseUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
    const customerAddress = customer.address?.trim() && customer.postalCode?.trim() && customer.city?.trim()
      ? {
          line1: customer.address.trim(),
          postal_code: customer.postalCode.trim(),
          city: customer.city.trim(),
          country: 'FR',
        }
      : undefined;
    const stripeCustomer = await stripe.customers.create({
      name: `${customer.firstName.trim()} ${customer.lastName.trim()}`,
      email: customer.email.trim(),
      phone: customer.phone?.trim() || undefined,
      address: customerAddress,
      metadata: { orderId, source: 'bb-pergolas-checkout' },
    });
    const lineItems = items.map((item) => {
      const product = PRODUCT_CATALOG.find((entry) => entry.id === item.productId);
      if (!product) throw new Error('Produit du panier introuvable.');
      const quotation = calculateQuotation(product, {
        materialId: item.materialId,
        widthCm: Number(item.width),
        depthCm: Number(item.depth),
        optionIds: item.optionIds,
        sideSelections: item.sideSelections,
        construction: item.construction,
      });
      return {
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(quotation.totalTTC * 100),
          product_data: {
            name: `${product.name} — ${item.width} × ${item.depth} cm`,
            description: `Configuration sur mesure B&B Pergolas • ${item.materialId || 'Aluminium'} • Prix TTC`,
            images: [item.image?.startsWith('http')
              ? item.image
              : `${baseUrl}${item.image?.startsWith('/') ? item.image : '/pergola-bioclimatique-cocoon-xl-mixte-gris-anthracite-blanc-700x4987m.webp'}`],
          },
        },
        quantity: Math.max(1, Math.min(10, Number(item.quantity) || 1)),
      };
    });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'fr',
      customer: stripeCustomer.id,
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ['FR'] },
      line_items: lineItems,
      success_url: `${baseUrl}/?payment=success&order=${encodeURIComponent(orderId)}&session_id={CHECKOUT_SESSION_ID}#top`,
      cancel_url: `${baseUrl}/?payment=cancelled#top`,
      custom_text: {
        submit: {
          message: 'Paiement sécurisé par Stripe. Votre bon de commande vous sera envoyé par e-mail après confirmation.',
        },
        after_submit: {
          message: 'Merci pour votre confiance. B&B Pergolas va préparer la confirmation de votre projet.',
        },
      },
      payment_intent_data: {
        description: `B&B Pergolas — commande ${orderId}`,
        receipt_email: customer.email.trim(),
        metadata: { orderId },
      },
      metadata: { orderId, firstName: customer.firstName.trim(), lastName: customer.lastName.trim() },
    });
    return res.json({ url: session.url, orderId });
  } catch (error) {
    return res.status(422).json({ error: error.message || 'Impossible de créer la session de paiement.' });
  }
});

app.use(express.static(DIST_DIR));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(DIST_DIR, 'index.html'));
});

export function createServer(port = PORT) {
  return app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  createServer();
}
