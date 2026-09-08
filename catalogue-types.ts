/**
 * STRUCTURE DE DONNÉES — CATALOGUE PRODUITS
 * Pergolas & Vérandas — vente de matériel (particuliers + professionnels)
 *
 * Principe : tous les prix sont stockés HT dans la base.
 * Le TTC est calculé à l'affichage (prix HT * (1 + tauxTVA)).
 * Le professionnel voit le HT en premier, le particulier voit le TTC en premier —
 * mais c'est le MÊME prix, seul l'ordre d'affichage change.
 */

// ---------- 1. CATÉGORIE DE PRODUIT ----------

export type CategorieProduit = 'pergola' | 'veranda';

// ---------- 2. MATÉRIAU ----------

export interface Materiau {
  id: string;                  // ex: "alu"
  nom: string;                 // ex: "Aluminium"
  description: string;         // ex: "Léger, sans entretien, garantie 10 ans"
  prixParM2HT: number;         // prix HT au m² pour ce matériau, sur CE produit
}

// ---------- 3. CONTRAINTES DE DIMENSIONS ----------
// Toutes les combinaisons largeur/profondeur ne sont pas possibles
// (portée max d'une lame, résistance d'une poutre, etc.)

export interface ContrainteDimensions {
  largeurMinCm: number;
  largeurMaxCm: number;
  profondeurMinCm: number;
  profondeurMaxCm: number;
  surfaceMaxM2?: number;       // optionnel : certains produits limitent la surface totale
                                 // plutôt que chaque côté indépendamment
}

// ---------- 4. OPTION ----------

export type TypeCalculOption = 'forfait' | 'parM2' | 'pourcentageStructure';

export interface OptionProduit {
  id: string;                  // ex: "led", "store"
  nom: string;
  description: string;
  typeCalcul: TypeCalculOption;
  valeurHT: number;            // montant fixe (forfait), prix/m² (parM2), ou % (pourcentageStructure)
  compatibleMateriaux?: string[]; // si absent : compatible avec tous les matériaux du produit
}

// ---------- 5. PRODUIT ----------

export interface Produit {
  id: string;                          // slug unique, ex: "pergola-bioclimatique-eclipse"
  categorie: CategorieProduit;
  nom: string;
  description: string;
  images: string[];
  materiaux: Materiau[];               // au moins 1
  contraintesDimensions: ContrainteDimensions;
  options: OptionProduit[];
  tauxTVA: number;                     // ex: 0.20 pour 20%
  forfaitBaseHT: number;               // partie fixe du prix (hors structure au m²), 0 si aucune
  actif: boolean;                      // permet de désactiver un produit sans le supprimer
}

// ---------- 6. CONFIGURATION CHOISIE PAR LE CLIENT ----------
// Ce qui est envoyé au serveur pour calculer le prix final (jamais faire confiance
// à un prix calculé côté client — toujours recalculer côté serveur avant paiement)

export interface ConfigurationClient {
  produitId: string;
  materiauId: string;
  largeurCm: number;
  profondeurCm: number;
  optionsChoisies: string[];   // liste d'ids d'OptionProduit
  typeClient: 'particulier' | 'professionnel'; // ne change QUE l'affichage HT/TTC
}

export interface DetailPrixLigne {
  libelle: string;
  montantHT: number;
}

export interface ResultatPrix {
  lignes: DetailPrixLigne[];
  totalHT: number;
  totalTTC: number;
  tauxTVA: number;
}

// ---------- 7. EXEMPLE DE DONNÉES ----------

export const exemplePergola: Produit = {
  id: 'pergola-bioclimatique-eclipse',
  categorie: 'pergola',
  nom: 'Pergola bioclimatique Eclipse',
  description: 'Lames orientables, structure autoportante, idéale terrasse.',
  images: ['/images/pergola-eclipse-1.jpg'],
  materiaux: [
    { id: 'alu', nom: 'Aluminium', description: 'Léger, sans entretien', prixParM2HT: 220 },
  ],
  contraintesDimensions: {
    largeurMinCm: 200,
    largeurMaxCm: 800,
    profondeurMinCm: 200,
    profondeurMaxCm: 700,
    surfaceMaxM2: 45,
  },
  options: [
    { id: 'led', nom: 'Éclairage LED intégré', description: 'Bandeau dimmable dans les lames', typeCalcul: 'forfait', valeurHT: 180 },
    { id: 'motor', nom: 'Motorisation des lames', description: 'Pilotage télécommande + appli', typeCalcul: 'forfait', valeurHT: 650 },
    { id: 'store', nom: 'Store latéral enroulable', description: 'Protection solaire additionnelle', typeCalcul: 'parM2', valeurHT: 35 },
  ],
  tauxTVA: 0.20,
  forfaitBaseHT: 450,
  actif: true,
};

// ---------- 8. MOTEUR DE CALCUL DE PRIX (référence) ----------
// À exécuter côté serveur uniquement, jamais faire confiance au prix du client.

export function calculerPrix(
  produit: Produit,
  config: ConfigurationClient
): ResultatPrix {
  const materiau = produit.materiaux.find(m => m.id === config.materiauId);
  if (!materiau) throw new Error('Matériau invalide pour ce produit');

  const { largeurMinCm, largeurMaxCm, profondeurMinCm, profondeurMaxCm, surfaceMaxM2 } =
    produit.contraintesDimensions;

  if (config.largeurCm < largeurMinCm || config.largeurCm > largeurMaxCm) {
    throw new Error('Largeur hors limites');
  }
  if (config.profondeurCm < profondeurMinCm || config.profondeurCm > profondeurMaxCm) {
    throw new Error('Profondeur hors limites');
  }

  const surfaceM2 = (config.largeurCm / 100) * (config.profondeurCm / 100);
  if (surfaceMaxM2 && surfaceM2 > surfaceMaxM2) {
    throw new Error('Surface totale dépasse le maximum autorisé pour ce produit');
  }

  const lignes: DetailPrixLigne[] = [];
  lignes.push({ libelle: 'Forfait de base', montantHT: produit.forfaitBaseHT });

  const prixStructure = surfaceM2 * materiau.prixParM2HT;
  lignes.push({
    libelle: `Structure ${materiau.nom} — ${surfaceM2.toFixed(2)} m²`,
    montantHT: prixStructure,
  });

  let totalHT = produit.forfaitBaseHT + prixStructure;

  for (const optionId of config.optionsChoisies) {
    const option = produit.options.find(o => o.id === optionId);
    if (!option) continue; // option inconnue : on l'ignore plutôt que de planter
    if (option.compatibleMateriaux && !option.compatibleMateriaux.includes(materiau.id)) {
      throw new Error(`L'option "${option.nom}" n'est pas compatible avec ce matériau`);
    }

    let montant = 0;
    if (option.typeCalcul === 'forfait') montant = option.valeurHT;
    if (option.typeCalcul === 'parM2') montant = option.valeurHT * surfaceM2;
    if (option.typeCalcul === 'pourcentageStructure') montant = prixStructure * (option.valeurHT / 100);

    lignes.push({ libelle: option.nom, montantHT: montant });
    totalHT += montant;
  }

  return {
    lignes,
    totalHT,
    totalTTC: totalHT * (1 + produit.tauxTVA),
    tauxTVA: produit.tauxTVA,
  };
}
