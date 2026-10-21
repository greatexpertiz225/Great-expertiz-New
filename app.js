/* =========================================================
   GREAT EXPERTIZ — APPLICATION PRINCIPALE
   Fichier : app.js
   Version : 1.0
   ========================================================= */

"use strict";

/*
 * CONFIGURATION
 *
 * Renseigner l'URL de la Web App Google Apps Script après
 * installation et déploiement du backend.
 *
 * Ne pas utiliser une URL fictive : sans URL réelle, les
 * opérations serveur restent indisponibles.
 */
const GE_CONFIG = {
  API_URL: "",
  COMPANY: "GREAT EXPERTIZ",
  COUNTRY: "Côte d'Ivoire",
  DEFAULT_CITY: "Abidjan",
  MAP_CENTER: [5.3599, -4.0083],
  MAP_ZOOM: 11,
  MAP_TILE_URL: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  MAP_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  NOMINATIM_URL: "https://nominatim.openstreetmap.org/search",
  ROUTING_URL: "https://router.project-osrm.org/route/v1/driving/",
  SEARCH_LIMIT: 5
};

/* =========================================================
   1. OUTILS GÉNÉRAUX
   ========================================================= */

const GE = {
  $: (selector, root = document) => root.querySelector(selector),
  $$: (selector, root = document) => Array.from(root.querySelectorAll(selector)),

  text(value) {
    return String(value ?? "").trim();
  },

  number(value) {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  },

  escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  },

  normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  show(element, display = "") {
    if (!element) return;
    element.hidden = false;
    if (display) element.style.display = display;
  },

  hide(element) {
    if (!element) return;
    element.hidden = true;
    element.style.display = "none";
  },

  message(element, message, type = "info") {
    if (!element) return;
    element.className = "notice";
    if (type === "error") element.classList.add("notice-error");
    if (type === "success") element.classList.add("notice-success");
    if (type === "warning") element.classList.add("notice-warning");
    element.textContent = message;
    element.hidden = false;
    element.style.display = "block";
    element.setAttribute("role", "status");
  },

  formatNumber(value, decimals = 2) {
    return new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: decimals
    }).format(value);
  },

  formatFCFA(value) {
    return new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0
    }).format(value) + " FCFA";
  },

  formatDate(value) {
    if (!value) return "Non précisée";
    const date = new Date(value + (String(value).length === 10 ? "T12:00:00" : ""));
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  },

  async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      throw new Error("Le serveur a répondu avec le statut " + response.status + ".");
    }

    return response;
  },

  apiConfigured() {
    return Boolean(
      GE_CONFIG.API_URL &&
      /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(GE_CONFIG.API_URL)
    );
  }
};

/* =========================================================
   2. CATALOGUE DES MARCHANDISES
   ========================================================= */

const GE_CARGO_CATALOG = {
  "Colis et cartons": [
    "Cartons standards",
    "Cartons de documents",
    "Cartons de vêtements",
    "Colis divers",
    "Sacs et bagages",
    "Archives et dossiers"
  ],

  "Maison et déménagement": [
    "Canapé",
    "Fauteuil",
    "Lit et sommier",
    "Matelas",
    "Armoire",
    "Commode",
    "Table",
    "Chaises",
    "Réfrigérateur",
    "Congélateur",
    "Machine à laver",
    "Cuisinière",
    "Télévision",
    "Mobilier de maison",
    "Déménagement complet"
  ],

  "Mobilier et équipement professionnel": [
    "Bureau",
    "Fauteuil de bureau",
    "Armoire professionnelle",
    "Rayonnage",
    "Étagères",
    "Matériel informatique",
    "Imprimante et photocopieur",
    "Équipement commercial",
    "Mobilier de magasin",
    "Matériel événementiel"
  ],

  "Marchandises commerciales": [
    "Marchandises en cartons",
    "Sacs de marchandises",
    "Palettes de marchandises",
    "Produits alimentaires non réfrigérés",
    "Boissons emballées",
    "Textiles et tissus",
    "Produits d'entretien emballés",
    "Stocks de boutique",
    "Équipements de distribution",
    "Autres marchandises commerciales"
  ],

  "Matériaux de construction": [
    "Ciment en sacs",
    "Carrelage",
    "Peinture emballée",
    "Tôles",
    "Bois de construction",
    "Tuyaux",
    "Équipements de plomberie",
    "Matériel électrique",
    "Agrégats conditionnés",
    "Matériaux divers"
  ],

  "Bois et objets volumineux": [
    "Planches de bois",
    "Poutres",
    "Portes",
    "Fenêtres",
    "Mobilier volumineux",
    "Structures métalliques",
    "Objets encombrants",
    "Autres objets volumineux"
  ],

  "Machines et équipements industriels": [
    "Machine industrielle",
    "Groupe électrogène",
    "Compresseur",
    "Pompe industrielle",
    "Équipement d'atelier",
    "Équipement agricole",
    "Machine de chantier",
    "Moteur",
    "Pièces industrielles",
    "Autre équipement industriel"
  ],

  "Marchandises lourdes": [
    "Charge lourde",
    "Équipement lourd",
    "Machine lourde",
    "Structure métallique lourde",
    "Matériel de chantier lourd",
    "Autre marchandise lourde"
  ],

  "Transport frigorifique": [
    "Produits frais emballés",
    "Produits surgelés",
    "Produits sous température contrôlée",
    "Autres marchandises nécessitant le froid"
  ],

  "Véhicules et pièces": [
    "Moteur automobile",
    "Pièces automobiles",
    "Pneus",
    "Équipement mécanique",
    "Moto à transporter",
    "Voiture à transporter",
    "Autre équipement automobile"
  ],

  "Conteneurs et transport spécialisé": [
    "Conteneur 20 pieds",
    "Conteneur 40 pieds",
    "Matériel hors gabarit",
    "Charge nécessitant une remorque",
    "Autre transport spécialisé"
  ],

  "Autre marchandise": [
    "Autre marchandise — description obligatoire"
  ]
};

/* =========================================================
   3. ÉTAT DE L'APPLICATION
   ========================================================= */

const GE_STATE = {
  currentStep: 1,
  totalSteps: 5,
  map: null,
  pickupMarker: null,
  deliveryMarker: null,
  pickup: null,
  delivery: null,
  routeLayer: null,
  routeKm: null,
  orderDraft: null,
  serverOrder: null,
  searchTimers: {},
  isSubmitting: false
};

/* =========================================================
   4. MENU MOBILE
   ========================================================= */

function initMenu() {
  const toggle = GE.$("#menuToggle");
  const navigation = GE.$("#mainNavigation");

  if (!toggle || !navigation) return;

  toggle.setAttribute("aria-expanded", "false");

  toggle.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Fermer le menu" : "Ouvrir le menu");
  });

  GE.$$("#mainNavigation a").forEach(link => {
    link.addEventListener("click", () => {
      navigation.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", event => {
    if (
      !navigation.contains(event.target) &&
      !toggle.contains(event.target)
    ) {
      navigation.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

/* =========================================================
   5. CHARGEMENT ET ANNÉE
   ========================================================= */

function initPageLoader() {
  const loader = GE.$("#pageLoader");
  if (!loader) return;

  window.addEventListener("load", () => {
    window.setTimeout(() => {
      loader.classList.add("hidden");
      window.setTimeout(() => loader.remove(), 500);
    }, 350);
  });

  // Évite de bloquer indéfiniment la page si une ressource externe
  // tarde à répondre.
  window.setTimeout(() => {
    if (loader.isConnected) {
      loader.classList.add("hidden");
      window.setTimeout(() => {
        if (loader.isConnected) loader.remove();
      }, 500);
    }
  }, 5000);
}

function initYear() {
  const year = GE.$("#currentYear");
  if (year) year.textContent = String(new Date().getFullYear());
}

/* =========================================================
   6. CATALOGUE DYNAMIQUE
   ========================================================= */

function initCargoCatalog() {
  const categorySelect = GE.$("#cargoCategory");
  const itemSelect = GE.$("#cargoItem");

  if (!categorySelect || !itemSelect) return;

  const originalCategory = categorySelect.value;

  categorySelect.innerHTML =
    '<option value="">Choisir une catégorie</option>' +
    Object.keys(GE_CARGO_CATALOG)
      .map(category =>
        `<option value="${GE.escape(category)}">${GE.escape(category)}</option>`
      )
      .join("");

  if (originalCategory && GE_CARGO_CATALOG[originalCategory]) {
    categorySelect.value = originalCategory;
  }

  function updateItems() {
    const category = categorySelect.value;
    const items = GE_CARGO_CATALOG[category] || [];

    itemSelect.innerHTML =
      '<option value="">Choisir une marchandise</option>' +
      items.map(item =>
        `<option value="${GE.escape(item)}">${GE.escape(item)}</option>`
      ).join("");

    itemSelect.disabled = items.length === 0;

    if (category === "Autre marchandise") {
      const description = GE.$("#cargoDescription");
      if (description) {
        description.required = true;
        description.placeholder = "Décrivez précisément la marchandise";
      }
    }
  }

  categorySelect.addEventListener("change", updateItems);
  updateItems();
}

/* =========================================================
   7. VOLUME ET UNITÉS
   ========================================================= */

function getCargoMeasurements() {
  const quantity = Math.max(1, GE.number(GE.$("#quantity")?.value) || 1);
  const length = GE.number(GE.$("#length")?.value);
  const width = GE.number(GE.$("#width")?.value);
  const height = GE.number(GE.$("#height")?.value);
  const declaredCbm = GE.number(GE.$("#declaredCbm")?.value);
  const weight = GE.number(GE.$("#weight")?.value);
  const weightUnit = GE.$("#weightUnit")?.value || "kg";
  const unknown = Boolean(GE.$("#unknownMeasurements")?.checked);

  const hasDimensions = length > 0 && width > 0 && height > 0;
  const calculatedCbm = hasDimensions
    ? length * width * height * quantity
    : 0;

  const cbm = declaredCbm > 0 ? declaredCbm : calculatedCbm;
  const weightTonnes = weightUnit === "t" ? weight : weight / 1000;

  return {
    quantity,
    length,
    width,
    height,
    declaredCbm,
    calculatedCbm,
    cbm,
    weight,
    weightUnit,
    weightTonnes,
    hasDimensions,
    unknown
  };
}

function updateMeasurementPreview() {
  const data = getCargoMeasurements();
  const output = GE.$("#measurementPreview");

  if (output) {
    if (data.unknown) {
      output.textContent = "Dimensions à vérifier avant confirmation.";
    } else if (data.cbm > 0) {
      output.textContent = `Volume indicatif : ${GE.formatNumber(data.cbm, 3)} m³ (CBM).`;
    } else {
      output.textContent = "Renseignez les dimensions ou le volume total.";
    }
  }

  const length = GE.$("#length");
  const width = GE.$("#width");
  const height = GE.$("#height");

  if (length && width && height && data.hasDimensions && !data.unknown) {
    [length, width, height].forEach(field => {
      field.setAttribute("aria-invalid", "false");
    });
  }
}

function initMeasurements() {
  [
    "#quantity",
    "#length",
    "#width",
    "#height",
    "#declaredCbm",
    "#weight",
    "#weightUnit",
    "#unknownMeasurements"
  ].forEach(selector => {
    const field = GE.$(selector);
    if (!field) return;
    field.addEventListener("input", updateMeasurementPreview);
    field.addEventListener("change", updateMeasurementPreview);
  });

  updateMeasurementPreview();
}

/* =========================================================
   8. CHOIX CBM / TONNAGE
   ========================================================= */

/*
 * Cette fonction n'est PAS un moteur tarifaire.
 * Elle identifie le mode de calcul à examiner par le backend.
 * Les règles définitives et seuils de tonnage doivent être validés.
 */
function determinePricingMode() {
  const category = GE.$("#cargoCategory")?.value || "";
  const nature = GE.$("#cargoNature")?.value || "";
  const weight = getCargoMeasurements().weightTonnes;

  const heavyCategories = [
    "Machines et équipements industriels",
    "Marchandises lourdes",
    "Conteneurs et transport spécialisé"
  ];

  const heavyNature = GE.normalize(nature).includes("lourd") ||
    GE.normalize(nature).includes("hors gabarit") ||
    GE.normalize(nature).includes("specialise");

  return {
    mode: heavyCategories.includes(category) || heavyNature
      ? "TONNAGE"
      : "CBM",
    weightTonnes: weight,
    volumeCbm: getCargoMeasurements().cbm,
    requiresReview: getCargoMeasurements().unknown ||
      (!getCargoMeasurements().hasDimensions &&
       getCargoMeasurements().declaredCbm <= 0)
  };
}

/* =========================================================
   9. CARTE LEAFLET
   ========================================================= */

function initMap() {
  const mapElement = GE.$("#orderMap");

  if (!mapElement) return;

  if (typeof L === "undefined") {
    console.warn("Leaflet n'est pas chargé. La carte est indisponible.");
    return;
  }

  GE_STATE.map = L.map(mapElement, {
    scrollWheelZoom: false
  }).setView(GE_CONFIG.MAP_CENTER, GE_CONFIG.MAP_ZOOM);

  L.tileLayer(GE_CONFIG.MAP_TILE_URL, {
    attribution: GE_CONFIG.MAP_ATTRIBUTION,
    maxZoom: 19
  }).addTo(GE_STATE.map);

  GE_STATE.map.on("click", event => {
    const point = {
      lat: event.latlng.lat,
      lon: event.latlng.lng,
      label: `Point sélectionné (${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)})`
    };

    const pickupAddress = GE.$("#pickupAddress");
    const deliveryAddress = GE.$("#deliveryAddress");

    if (pickupAddress && !pickupAddress.value.trim()) {
      setLocation("pickup", point);
      pickupAddress.value = point.label;
    } else if (deliveryAddress && !deliveryAddress.value.trim()) {
      setLocation("delivery", point);
      deliveryAddress.value = point.label;
    } else {
      showMapMessage(
        "Pour déplacer un point, effacez d'abord l'adresse correspondante puis sélectionnez la carte."
      );
    }
  });

  window.setTimeout(() => {
    if (GE_STATE.map) GE_STATE.map.invalidateSize();
  }, 250);
}

function showMapMessage(message) {
  const existing = GE.$("#mapMessage");
  if (existing) {
    GE.message(existing, message, "info");
    return;
  }

  const map = GE.$("#orderMap");
  if (!map) return;

  const notice = document.createElement("div");
  notice.id = "mapMessage";
  notice.className = "notice";
  notice.textContent = message;
  map.insertAdjacentElement("afterend", notice);
}

function setLocation(type, point) {
  if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lon))) {
    return;
  }

  const normalized = {
    lat: Number(point.lat),
    lon: Number(point.lon),
    label: GE.text(point.label) || "Position sélectionnée"
  };

  if (type === "pickup") {
    GE_STATE.pickup = normalized;
  } else {
    GE_STATE.delivery = normalized;
  }

  if (!GE_STATE.map || typeof L === "undefined") return;

  const markerKey = type === "pickup" ? "pickupMarker" : "deliveryMarker";
  const color = type === "pickup" ? "#087fbd" : "#a3bd22";

  const icon = L.divIcon({
    className: "ge-map-marker",
    html: `<span style="display:block;width:18px;height:18px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 1px 7px #1236"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  if (GE_STATE[markerKey]) {
    GE_STATE[markerKey].setLatLng([normalized.lat, normalized.lon]);
  } else {
    GE_STATE[markerKey] = L.marker(
      [normalized.lat, normalized.lon],
      { icon, draggable: true }
    ).addTo(GE_STATE.map);
  }

  GE_STATE[markerKey].bindPopup(GE.escape(normalized.label));

  GE_STATE[markerKey].off("dragend");
  GE_STATE[markerKey].on("dragend", event => {
    const position = event.target.getLatLng();
    const moved = {
      lat: position.lat,
      lon: position.lng,
      label: `Position ajustée (${position.lat.toFixed(5)}, ${position.lng.toFixed(5)})`
    };

    if (type === "pickup") GE_STATE.pickup = moved;
    else GE_STATE.delivery = moved;

    updateRoute();
  });

  GE_STATE.map.panTo([normalized.lat, normalized.lon]);
  updateRoute();
}

/* =========================================================
   10. RECHERCHE D'ADRESSES EN CÔTE D'IVOIRE
   ========================================================= */

const GE_LOCALITY_ALIASES = {
  "abidjan": "Abidjan, Côte d'Ivoire",
  "cocody": "Cocody, Abidjan, Côte d'Ivoire",
  "yopougon": "Yopougon, Abidjan, Côte d'Ivoire",
  "adjame": "Adjamé, Abidjan, Côte d'Ivoire",
  "attecoube": "Attécoubé, Abidjan, Côte d'Ivoire",
  "abobo": "Abobo, Abidjan, Côte d'Ivoire",
  "anyama": "Anyama, Côte d'Ivoire",
  "bingerville": "Bingerville, Côte d'Ivoire",
  "port bouet": "Port-Bouët, Abidjan, Côte d'Ivoire",
  "koumassi": "Koumassi, Abidjan, Côte d'Ivoire",
  "marcory": "Marcory, Abidjan, Côte d'Ivoire",
  "treichville": "Treichville, Abidjan, Côte d'Ivoire",
  "plateau": "Le Plateau, Abidjan, Côte d'Ivoire",
  "songon": "Songon, Côte d'Ivoire",
  "grand bassam": "Grand-Bassam, Côte d'Ivoire",
  "bassam": "Grand-Bassam, Côte d'Ivoire",
  "bonoua": "Bonoua, Côte d'Ivoire",
  "dabou": "Dabou, Côte d'Ivoire",
  "azopé": "Adzopé, Côte d'Ivoire",
  "azope": "Adzopé, Côte d'Ivoire",
  "adzopé": "Adzopé, Côte d'Ivoire",
  "beoumi": "Béoumi, Côte d'Ivoire",
  "béoumi": "Béoumi, Côte d'Ivoire",
  "bouake": "Bouaké, Côte d'Ivoire",
  "bouaké": "Bouaké, Côte d'Ivoire",
  "yamoussoukro": "Yamoussoukro, Côte d'Ivoire",
  "san pedro": "San-Pédro, Côte d'Ivoire",
  "korhogo": "Korhogo, Côte d'Ivoire",
  "man": "Man, Côte d'Ivoire",
  "daloa": "Daloa, Côte d'Ivoire",
  "gagnoa": "Gagnoa, Côte d'Ivoire",
  "agboville": "Agboville, Côte d'Ivoire",
  "abengourou": "Abengourou, Côte d'Ivoire",
  "divo": "Divo, Côte d'Ivoire",
  "soubré": "Soubré, Côte d'Ivoire",
  "soubre": "Soubré, Côte d'Ivoire",
  "odienne": "Odienné, Côte d'Ivoire",
  "odienné": "Odienné, Côte d'Ivoire",
  "ferkessedougou": "Ferkessédougou, Côte d'Ivoire",
  "ferkessédougou": "Ferkessédougou, Côte d'Ivoire",
  "bondoukou": "Bondoukou, Côte d'Ivoire",
  "séguéla": "Séguéla, Côte d'Ivoire",
  "seguela": "Séguéla, Côte d'Ivoire",
  "toumodi": "Toumodi, Côte d'Ivoire"
};

function resolveLocality(query) {
  const normalized = GE.normalize(query);

  for (const [alias, address] of Object.entries(GE_LOCALITY_ALIASES)) {
    if (GE.normalize(alias) === normalized) return address;
  }

  return `${query}, Côte d'Ivoire`;
}

async function geocodeAddress(query) {
  const normalizedQuery = GE.text(query);
  if (normalizedQuery.length < 3) return [];

  const resolved = resolveLocality(normalizedQuery
