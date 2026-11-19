// Annonces de démonstration (portage de app-flutter/lib/demo_data.dart).
// Les règles Firestore interdisent d'écrire des annonces au nom de « DEMO » :
// ces annonces fictives vivent donc en mémoire, avec les mêmes identifiants
// (demo_0, demo_1, …) et le même ordre que dans Flutter, ce qui permet de
// retrouver les favoris de démonstration enregistrés par l'autre application.

import {
  DEMO_OWNER_ID,
  isDemoListing,
  normalizeListing,
} from '../features/listings/listingModel';
import type { Listing } from '../features/listings/listingModel';

interface DemoRaw {
  titre: string;
  description: string;
  typeTransaction: string;
  typeBien: string;
  prix: number;
  surface: number;
  nombrePieces: number;
  ville: string;
  adresse: string;
  photos: string[];
  latitude: number;
  longitude: number;
}

const U = 'https://images.unsplash.com/';

const RAW: DemoRaw[] = [
  {
    titre: 'Appartement moderne avec vue mer – Les Berges du Lac',
    description:
      'Magnifique appartement de 3 chambres avec vue imprenable sur le lac. Cuisine équipée, double vitrage, parking sous-sol. Résidence sécurisée 24h/24. Idéal pour famille ou investissement locatif. Charges de copropriété : 150 TND/mois.',
    typeTransaction: 'vente',
    typeBien: 'appartement',
    prix: 420000,
    surface: 135,
    nombrePieces: 4,
    ville: 'Tunis',
    adresse: 'Les Berges du Lac II, Tunis',
    photos: [`${U}photo-1560448204-e02f11c3d0e2?w=800`, `${U}photo-1502672260266-1c1ef2d93688?w=800`],
    latitude: 36.8392,
    longitude: 10.2378,
  },
  {
    titre: 'Studio meublé tout confort – Centre-ville Sfax',
    description:
      'Studio entièrement meublé et équipé, idéal pour étudiant ou jeune actif. Climatisation, Wi-Fi inclus, cuisine équipée, salle de bain moderne. Proche facultés et commerces. Disponible immédiatement.',
    typeTransaction: 'location',
    typeBien: 'appartement',
    prix: 650,
    surface: 38,
    nombrePieces: 1,
    ville: 'Sfax',
    adresse: 'Avenue Habib Bourguiba, Centre-ville, Sfax',
    photos: [`${U}photo-1522708323590-d24dbb6b0267?w=800`, `${U}photo-1536376072261-38c75010e6c9?w=800`],
    latitude: 34.7398,
    longitude: 10.76,
  },
  {
    titre: 'Appartement S+2 rénové – La Marsa',
    description:
      'Appartement S+2 entièrement rénové dans la résidence El Menzah. Parquet en bois, cuisine américaine, 2 salles de bain, terrasse de 20 m². Résidence avec gardien, ascenseur, parking. À 5 min de la plage.',
    typeTransaction: 'vente',
    typeBien: 'appartement',
    prix: 285000,
    surface: 95,
    nombrePieces: 3,
    ville: 'La Marsa',
    adresse: 'Résidence El Amel, La Marsa, Tunis',
    photos: [`${U}photo-1493809842364-78817add7ffb?w=800`, `${U}photo-1484154218962-a197022b5858?w=800`],
    latitude: 36.8831,
    longitude: 10.3247,
  },
  {
    titre: 'Appartement S+3 avec terrasse – Sousse Khezama',
    description:
      'Grand appartement S+3 dans une résidence calme et sécurisée. Terrasse panoramique de 35 m², cuisine équipée, 2 salles de bain. Parking privatif. Proche centre commercial et plage de Sousse.',
    typeTransaction: 'vente',
    typeBien: 'appartement',
    prix: 320000,
    surface: 120,
    nombrePieces: 4,
    ville: 'Sousse',
    adresse: 'Khezama Est, Sousse',
    photos: [`${U}photo-1512917774080-9991f1c4c750?w=800`, `${U}photo-1556909114-f6e7ad7d3136?w=800`],
    latitude: 35.8256,
    longitude: 10.641,
  },
  {
    titre: 'Appartement haut standing – Lac 2 Tunis',
    description:
      'Appartement de luxe au 8e étage avec vue sur les deux lacs. Finitions haut de gamme, cuisine Allemande équipée, 3 chambres avec placards. Dressing, buanderie, 2 parkings. Accès direct aux commerces et restaurants.',
    typeTransaction: 'location',
    typeBien: 'appartement',
    prix: 2800,
    surface: 160,
    nombrePieces: 4,
    ville: 'Tunis',
    adresse: 'Lac 2, Les Berges du Lac, Tunis',
    photos: [`${U}photo-1486304873000-235643847519?w=800`, `${U}photo-1560448075-cbc16bb4af8e?w=800`],
    latitude: 36.8456,
    longitude: 10.2512,
  },
  {
    titre: 'Maison arabe traditionnelle rénovée – Médina de Tunis',
    description:
      'Authentique maison arabe (dar) entièrement restaurée dans la Médina classée UNESCO. Patio central avec fontaine, 4 chambres, salon oriental, cuisine moderne. Idéale pour gîte, hôtel de charme ou résidence principale. Superficie habitable : 220 m² sur 2 niveaux.',
    typeTransaction: 'vente',
    typeBien: 'maison',
    prix: 550000,
    surface: 220,
    nombrePieces: 6,
    ville: 'Tunis',
    adresse: 'Médina de Tunis, Tunis',
    photos: [`${U}photo-1512917774080-9991f1c4c750?w=800`, `${U}photo-1570129477492-45c003edd2be?w=800`],
    latitude: 36.7987,
    longitude: 10.171,
  },
  {
    titre: 'Maison individuelle avec jardin – Menzah 6',
    description:
      'Belle maison de 4 chambres dans quartier résidentiel calme. Jardin paysager de 300 m², piscine hors-sol, garage 2 voitures. Cuisine américaine, salon avec cheminée. Proche écoles internationales.',
    typeTransaction: 'vente',
    typeBien: 'maison',
    prix: 680000,
    surface: 280,
    nombrePieces: 7,
    ville: 'Tunis',
    adresse: 'Menzah 6, Ariana, Tunis',
    photos: [`${U}photo-1568605114967-8130f3a36994?w=800`, `${U}photo-1558618666-fcd25c85cd64?w=800`],
    latitude: 36.8723,
    longitude: 10.1891,
  },
  {
    titre: 'Maison de ville à louer – Hammamet',
    description:
      "Maison de 3 chambres à 10 min des plages de Hammamet. Terrasse, barbecue, parking. Idéale pour famille ou location vacances. Disponible à l'année. Eau et électricité non comprises.",
    typeTransaction: 'location',
    typeBien: 'maison',
    prix: 1800,
    surface: 140,
    nombrePieces: 4,
    ville: 'Hammamet',
    adresse: 'Zone touristique Nord, Hammamet',
    photos: [`${U}photo-1575517111839-3a3843ee7f5d?w=800`, `${U}photo-1583608205776-bfd35f0d9f83?w=800`],
    latitude: 36.41,
    longitude: 10.6124,
  },
  {
    titre: 'Maison S+4 neuve – Ain Zaghouan Tunis',
    description:
      'Maison neuve jamais habitée, construction 2024. Double vitrage, isolation thermique renforcée, chauffe-eau solaire. Sous-sol entier, 4 chambres avec placards, 2 salles de bain, grande terrasse. Financement bancaire possible.',
    typeTransaction: 'vente',
    typeBien: 'maison',
    prix: 480000,
    surface: 230,
    nombrePieces: 6,
    ville: 'Tunis',
    adresse: 'Ain Zaghouan Nord, Tunis',
    photos: [`${U}photo-1600596542815-ffad4c1539a9?w=800`, `${U}photo-1600585154526-990dced4db0d?w=800`],
    latitude: 36.8012,
    longitude: 10.2156,
  },
  {
    titre: 'Villa de luxe avec piscine – Sidi Bou Saïd',
    description:
      'Somptueuse villa andalouse avec piscine chauffée et vue panoramique sur le golfe de Tunis. 5 suites, hammam privatif, cuisine professionnelle, salle de cinéma. Jardin paysager de 1200 m² avec oliviers centenaires. Domotique complète.',
    typeTransaction: 'vente',
    typeBien: 'villa',
    prix: 2500000,
    surface: 650,
    nombrePieces: 10,
    ville: 'Sidi Bou Saïd',
    adresse: 'Rue Sidi Dhrif, Sidi Bou Saïd',
    photos: [`${U}photo-1613490493576-7fde63acd811?w=800`, `${U}photo-1512917774080-9991f1c4c750?w=800`],
    latitude: 36.8697,
    longitude: 10.3484,
  },
  {
    titre: 'Villa S+5 neuve – Gammarth Village',
    description:
      'Villa contemporaine de standing dans résidence fermée sécurisée. Architecture moderne, piscine 10x5, jardin 800 m². 5 chambres toutes avec salle de bain, dressing, coin bureau. Cuisine haut de gamme, cave à vin, garage 3 voitures.',
    typeTransaction: 'vente',
    typeBien: 'villa',
    prix: 1800000,
    surface: 480,
    nombrePieces: 8,
    ville: 'Gammarth',
    adresse: 'Résidence Les Dunes, Gammarth Village',
    photos: [`${U}photo-1600047508788-786f3865b4d9?w=800`, `${U}photo-1600566753376-12c8ab7fb75b?w=800`],
    latitude: 36.9124,
    longitude: 10.2978,
  },
  {
    titre: 'Villa à louer pour événements – Djerba',
    description:
      'Villa exceptionnelle à louer en Tunisie, face à la mer. Piscine privée, 6 chambres, grand salon, terrasses multiples. Cuisine équipée, barbecue, terrain 1500 m². Idéale mariages et séminaires. Tarif semaine haute saison : 4500 TND.',
    typeTransaction: 'location',
    typeBien: 'villa',
    prix: 4500,
    surface: 400,
    nombrePieces: 8,
    ville: 'Djerba',
    adresse: 'Zone Touristique, Midoun, Djerba',
    photos: [`${U}photo-1600596542815-ffad4c1539a9?w=800`, `${U}photo-1540518614846-7eded433c457?w=800`],
    latitude: 33.8073,
    longitude: 10.9898,
  },
  {
    titre: 'Belle villa avec piscine – Sousse Kantaoui',
    description:
      'Villa en résidence fermée avec gardiennage 24/7. Piscine privée, 4 chambres avec climatisation, terrasse couverte. À 5 min du port el Kantaoui et de ses golfs. Idéale résidence secondaire ou investissement locatif touristique.',
    typeTransaction: 'vente',
    typeBien: 'villa',
    prix: 950000,
    surface: 320,
    nombrePieces: 6,
    ville: 'Sousse',
    adresse: 'Port el Kantaoui, Sousse',
    photos: [`${U}photo-1600585154340-be6161a56a0c?w=800`, `${U}photo-1575517111839-3a3843ee7f5d?w=800`],
    latitude: 35.8972,
    longitude: 10.5916,
  },
  {
    titre: 'Terrain constructible viabilisé – Ennasr 2 Tunis',
    description:
      "Terrain plat, entièrement viabilisé (eau, électricité, assainissement). COS 60%, hauteur max 15m (R+4). Idéal pour immeuble d'appartements ou villa. Titre foncier, mutation possible rapidement.",
    typeTransaction: 'vente',
    typeBien: 'terrain',
    prix: 380000,
    surface: 450,
    nombrePieces: 0,
    ville: 'Tunis',
    adresse: 'Ennasr 2, Ariana, Tunis',
    photos: [`${U}photo-1500382017468-9049fed747ef?w=800`],
    latitude: 36.8945,
    longitude: 10.2012,
  },
  {
    titre: 'Terrain agricole avec puits – Zaghouan',
    description:
      "Grand terrain agricole avec puits artésien et plantations d'oliviers (200 arbres). Accès route asphaltée, électricité à 50m. Idéal pour projet agrotouristique ou ferme. Eau disponible toute l'année.",
    typeTransaction: 'vente',
    typeBien: 'terrain',
    prix: 95000,
    surface: 8500,
    nombrePieces: 0,
    ville: 'Zaghouan',
    adresse: 'Route de Nabeul, Zaghouan',
    photos: [`${U}photo-1464226184884-fa280b87c399?w=800`],
    latitude: 36.4028,
    longitude: 10.142,
  },
  {
    titre: 'Terrain bord de mer à vendre – Hammamet Nord',
    description:
      'Rare opportunité : terrain de première ligne avec accès direct à la plage. Zone touristique, permis de construire hôtel/résidence délivré. Superficie : 2500 m². Idéal promoteur immobilier ou investisseur.',
    typeTransaction: 'vente',
    typeBien: 'terrain',
    prix: 1200000,
    surface: 2500,
    nombrePieces: 0,
    ville: 'Hammamet',
    adresse: 'Zone Touristique Nord, Hammamet',
    photos: [`${U}photo-1507525428034-b723cf961d3e?w=800`],
    latitude: 36.4312,
    longitude: 10.6089,
  },
  {
    titre: 'Terrain résidentiel – Bizerte Corniche',
    description:
      'Terrain avec vue sur la mer à Bizerte. Zone résidentielle calme, tous réseaux disponibles. Permis de construire villa accordé. Documents juridiques complets.',
    typeTransaction: 'vente',
    typeBien: 'terrain',
    prix: 180000,
    surface: 650,
    nombrePieces: 0,
    ville: 'Bizerte',
    adresse: 'Corniche de Bizerte, Bizerte',
    photos: [`${U}photo-1500534314209-a25ddb2bd429?w=800`],
    latitude: 37.2744,
    longitude: 9.8739,
  },
  {
    titre: 'Local commercial – Avenue Habib Bourguiba Tunis',
    description:
      'Local commercial de prestige sur la plus belle avenue de Tunis. Vitrine de 8m de façade, hauteur sous plafond 4m. Idéal boutique luxe, agence bancaire, restaurant. Pas de porte : 150 000 TND. Loyer mensuel : 8 500 TND.',
    typeTransaction: 'location',
    typeBien: 'local',
    prix: 8500,
    surface: 220,
    nombrePieces: 2,
    ville: 'Tunis',
    adresse: 'Avenue Habib Bourguiba, Tunis Centre',
    photos: [`${U}photo-1497366216548-37526070297c?w=800`, `${U}photo-1580587771525-78b9dba3b914?w=800`],
    latitude: 36.7975,
    longitude: 10.1813,
  },
  {
    titre: 'Local commercial avec parking – Sfax Rte de Tunis',
    description:
      "Local en rez-de-chaussée d'immeuble, idéal showroom automobile, pharmacie, supermarché. Grand parking de 20 places. Visibilité excellente sur voie principale. Charges locatives incluses dans le loyer.",
    typeTransaction: 'location',
    typeBien: 'local',
    prix: 3200,
    surface: 320,
    nombrePieces: 3,
    ville: 'Sfax',
    adresse: 'Route de Tunis Km 2, Sfax',
    photos: [`${U}photo-1486325212027-8081e485255e?w=800`],
    latitude: 34.7513,
    longitude: 10.7612,
  },
  {
    titre: 'Plateau de bureaux à vendre – Lac 1 Tunis',
    description:
      "Plateau de bureaux haut de gamme dans immeuble à ossature métallique. Open space modulable, faux-plancher informatique, groupe électrogène. Stationnement : 5 places désignées. Idéal pour siège social ou centre d'appels.",
    typeTransaction: 'vente',
    typeBien: 'local',
    prix: 650000,
    surface: 450,
    nombrePieces: 6,
    ville: 'Tunis',
    adresse: "Lac 1, Centre d'Affaires, Tunis",
    photos: [`${U}photo-1497366754035-f200968a6e72?w=800`, `${U}photo-1497366216548-37526070297c?w=800`],
    latitude: 36.8341,
    longitude: 10.2289,
  },
  {
    titre: 'Entrepôt logistique – Zone Industrielle Sousse',
    description:
      'Entrepôt neuf en zone industrielle aménagée. Hauteur libre : 8m, 2 quais de déchargement, bureau de 60 m². Accès PL, cour de manœuvre, gardiennage. Idéal stockage, distribution, light manufacturing.',
    typeTransaction: 'location',
    typeBien: 'local',
    prix: 4500,
    surface: 1200,
    nombrePieces: 2,
    ville: 'Sousse',
    adresse: 'Zone Industrielle Sousse Sud',
    photos: [`${U}photo-1565793298595-6a879b1d9492?w=800`],
    latitude: 35.7612,
    longitude: 10.6234,
  },
  {
    titre: 'Appartement S+1 vue plage – Monastir',
    description:
      'Charmant appartement en front de mer. Salon avec terrasse vue mer, chambre spacieuse, cuisine équipée. Résidence avec piscine commune et gardien. À 300m de la plage Skanes. Idéal investissement locatif touristique.',
    typeTransaction: 'vente',
    typeBien: 'appartement',
    prix: 195000,
    surface: 65,
    nombrePieces: 2,
    ville: 'Monastir',
    adresse: 'Zone Touristique Skanes, Monastir',
    photos: [`${U}photo-1499793983690-e29da59ef1c2?w=800`, `${U}photo-1502005229762-cf1b2da7c5d6?w=800`],
    latitude: 35.7612,
    longitude: 10.8456,
  },
  {
    titre: 'Villa traditionnelle – Nabeul',
    description:
      'Charmante villa de style tunisien dans quartier résidentiel de Nabeul. Patio avec fontaine et jasmin, 3 chambres, salon maure, cuisine spacieuse. Jardin de 400 m² avec citronniers et grenadiers. Très bon état général.',
    typeTransaction: 'vente',
    typeBien: 'villa',
    prix: 420000,
    surface: 185,
    nombrePieces: 5,
    ville: 'Nabeul',
    adresse: 'Quartier Résidentiel, Nabeul',
    photos: [`${U}photo-1570129477492-45c003edd2be?w=800`],
    latitude: 36.4512,
    longitude: 10.7345,
  },
  {
    titre: 'Duplex moderne – Ain Draham',
    description:
      'Magnifique duplex en montagne avec vue sur forêt de chênes-lièges. Architecture contemporaine, cheminée, terrasse panoramique. 2 chambres, 2 salles de bain. Idéal résidence de vacances ou gîte écotouristique.',
    typeTransaction: 'vente',
    typeBien: 'maison',
    prix: 220000,
    surface: 110,
    nombrePieces: 3,
    ville: 'Ain Draham',
    adresse: 'Route de la Forêt, Ain Draham',
    photos: [`${U}photo-1449844908441-8829872d2607?w=800`],
    latitude: 36.7801,
    longitude: 8.6942,
  },
  {
    titre: 'Appartement S+2 rénové – Sfax Mida',
    description:
      'Appartement rénové avec goût dans quartier calme et sécurisé. Parquet, cuisine américaine, 2 chambres avec placards encastrés. Proche marché et transports. Eau chaude solaire incluse.',
    typeTransaction: 'location',
    typeBien: 'appartement',
    prix: 900,
    surface: 85,
    nombrePieces: 3,
    ville: 'Sfax',
    adresse: 'Mida, Sfax',
    photos: [`${U}photo-1555041469-a586c61ea9bc?w=800`],
    latitude: 34.7212,
    longitude: 10.7523,
  },
  {
    titre: 'Villa en bord de mer à louer – Zarzis',
    description:
      'Superbe villa avec accès direct à une plage privée. Idéale location vacances famille. 4 chambres, grande terrasse, barbecue, parking. Piscine privée, Wi-Fi, télévision satellite. Haute saison : 3000 TND/semaine.',
    typeTransaction: 'location',
    typeBien: 'villa',
    prix: 3000,
    surface: 250,
    nombrePieces: 5,
    ville: 'Zarzis',
    adresse: 'Zone Balnéaire, Zarzis',
    photos: [`${U}photo-1540518614846-7eded433c457?w=800`],
    latitude: 33.5012,
    longitude: 11.1123,
  },
  {
    titre: 'Local commercial – Centre commercial Bizerte',
    description:
      "Local dans centre commercial moderne très fréquenté. Idéal franchise, restauration rapide, télécommunications. Superficie modifiable. Kitchenette et sanitaires inclus. Droit d'entrée : 25 000 TND. Charges copro : 300 TND/mois.",
    typeTransaction: 'location',
    typeBien: 'local',
    prix: 2200,
    surface: 85,
    nombrePieces: 1,
    ville: 'Bizerte',
    adresse: 'Centre Commercial El Corniche, Bizerte',
    photos: [`${U}photo-1555529669-e69e7aa0ba9a?w=800`],
    latitude: 37.2712,
    longitude: 9.8734,
  },
  {
    titre: 'Terrain urbain à saisir – Médenine',
    description:
      'Terrain plat en zone urbaine avec tous les réseaux. Idéal pour résidence ou commerce. Documents en règle. Proche du centre-ville de Médenine et des transports.',
    typeTransaction: 'vente',
    typeBien: 'terrain',
    prix: 55000,
    surface: 300,
    nombrePieces: 0,
    ville: 'Médenine',
    adresse: 'Zone Urbaine, Médenine',
    photos: [`${U}photo-1500382017468-9049fed747ef?w=800`],
    latitude: 33.3545,
    longitude: 10.5056,
  },
  {
    titre: 'Appartement neuf en VEFA – Ariana Sup Tech',
    description:
      "Appartement neuf sur plan (VEFA) dans programme immobilier haut standing. Livraison T2 2025. S+2, cuisine américaine, terrasse 20 m². Double vitrage K-glass, isolation phonique renforcée. Facilités de paiement sur 7 ans. Prix promotionnel jusqu'au 31/12.",
    typeTransaction: 'vente',
    typeBien: 'appartement',
    prix: 245000,
    surface: 95,
    nombrePieces: 3,
    ville: 'Ariana',
    adresse: "Sup'Com, Ariana, Tunis",
    photos: [`${U}photo-1486304873000-235643847519?w=800`],
    latitude: 36.9012,
    longitude: 10.1856,
  },
  {
    titre: "Ferme avec maison d'habitation – Béja",
    description:
      "Magnifique exploitation agricole de 15 hectares avec maison d'habitation de 180 m². Verger d'orangers et mandariniers, céréales. Puit artésien, 2 hangars. Idéale pour agriculture biologique ou agrotourisme. À 5 km de Béja ville.",
    typeTransaction: 'vente',
    typeBien: 'terrain',
    prix: 420000,
    surface: 150000,
    nombrePieces: 4,
    ville: 'Béja',
    adresse: 'Route de Testour, Béja',
    photos: [`${U}photo-1464226184884-fa280b87c399?w=800`],
    latitude: 36.7245,
    longitude: 9.1823,
  },
  {
    titre: 'Appartement en colocation – El Menzah Tunis',
    description:
      'Chambre meublée dans appartement S+3 partagé. Cuisine équipée, Wi-Fi fibre optique, linge de maison fourni. Colocation sérieuse et calme, proche faculté de médecine et bus. Toutes charges incluses. Idéal étudiant ou stagiaire.',
    typeTransaction: 'location',
    typeBien: 'appartement',
    prix: 420,
    surface: 20,
    nombrePieces: 1,
    ville: 'Tunis',
    adresse: 'El Menzah 5, Ariana, Tunis',
    photos: [`${U}photo-1522708323590-d24dbb6b0267?w=800`],
    latitude: 36.8656,
    longitude: 10.1934,
  },
];

// Catalogue en mémoire (ids demo_0 … demo_29).
export const DEMO_CATALOG: Listing[] = RAW.map((item, index) =>
  normalizeListing(`demo_${index}`, {
    ...item,
    statut: 'active',
    proprietaireId: DEMO_OWNER_ID,
  }),
);

export function demoById(id: string): Listing | null {
  return DEMO_CATALOG.find(listing => listing.id === id) ?? null;
}

// Annonces de démo à ajouter aux annonces réelles. Vide si des annonces DEMO
// existent déjà dans Firestore (évite les doublons) — comme fallbackFor Flutter.
export function demoFallbackFor(real: Listing[]): Listing[] {
  return real.some(isDemoListing) ? [] : DEMO_CATALOG;
}
