/* =========================================================
   GREAT EXPERTIZ — ADMINISTRATION
   Fichier : admin.js
   Frontend d'administration connecté à Google Apps Script.
   ========================================================= */

"use strict";

/*
 * CONFIGURATION
 *
 * Laisser API_URL vide tant que l'URL du nouveau déploiement
 * Google Apps Script n'a pas été configurée et vérifiée.
 *
 * IMPORTANT :
 * Le backend doit vérifier les droits de chaque utilisateur.
 * Les contrôles de cette interface ne remplacent pas la sécurité
 * côté serveur.
 */

const ADMIN_CONFIG = {
  API_URL: "",
  SESSION_KEY: "ge_admin_session",
  USER_KEY: "ge_admin_user",
  PAGE_SIZE: 25
};


/* =========================================================
   ÉTAT DE L'APPLICATION
   ========================================================= */

const ADMIN_STATE = {
  token: "",
  user: null,
  orders: [],
  archives: [],
  trash: [],
  members: [],
  currentOrder: null,
  currentSection: "dashboard",
  selectedOrders: new Set(),
  selectedArchives: new Set(),
  selectedTrash: new Set(),
  currentPage: 1,
  confirmCallback: null,
  loading: false
};


/* =========================================================
   OUTILS GÉNÉRAUX
   ========================================================= */

const Admin = {
  $: (selector, root = document) => root.querySelector(selector),

  $$: (selector, root = document) =>
    Array.from(root.querySelectorAll(selector)),

  text(value) {
    return value === null || value === undefined
      ? ""
      : String(value);
  },

  normalize(value) {
    return this.text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  },

  escape(value) {
    return this.text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  setMessage(element, message, type = "info") {
    if (!element) return;

    element.textContent = message || "";
    element.className = "form-message";

    if (message) {
      element.classList.add(type);
    }
  },

  showMessage(selector, message, type = "info") {
    this.setMessage(this.$(selector), message, type);
  },

  formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return this.text(value);
    }

    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  },

  formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return this.text(value);
    }

    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  },

  getOrderCode(order) {
    return this.text(
      order.code ||
      order.reference ||
      order.orderCode ||
      order.Code ||
      order.Reference ||
      ""
    );
  },

  getOrderDate(order) {
    return (
      order.createdAt ||
      order.date ||
      order.Date ||
      order.created ||
      ""
    );
  },

  getCustomerName(order) {
    return this.text(
      order.customerName ||
      order.clientName ||
      order.expediteur ||
      order.sender ||
      order.Expediteur ||
      order.client ||
      "Client"
    );
  },

  getCustomerPhone(order) {
    return this.text(
      order.customerPhone ||
      order.clientPhone ||
      order.telephone ||
      order.phone ||
      order.Telephone ||
      ""
    );
  },

  getService(order) {
    return this.text(
      order.transportType ||
      order.prestation ||
      order.service ||
      order.type ||
      order.Prestation ||
      "Transport"
    );
  },

  getPickup(order) {
    return this.text(
      order.pickupAddress ||
      order.enlevement ||
      order.pickup ||
      order.Enlevement ||
      ""
    );
  },

  getDelivery(order) {
    return this.text(
      order.deliveryAddress ||
      order.livraison ||
      order.delivery ||
      order.Livraison ||
      ""
    );
  },

  getStatus(order) {
    return this.text(
      order.status ||
      order.statut ||
      order.Statut ||
      "En attente"
    );
  },

  getItem(order) {
    return this.text(
      order.cargoDescription ||
      order.marchandise ||
      order.goods ||
      order.detail ||
      order.Détail ||
      ""
    );
  },

  getOrderByCode(code, list = ADMIN_STATE.orders) {
    return list.find(
      order => this.getOrderCode(order) === code
    );
  },

  roleLabel(role) {
    const value = this.normalize(role);

    if (value.includes("proprietaire") || value === "owner") {
      return "Propriétaire";
    }

    if (value.includes("admin")) {
      return "Administrateur";
    }

    if (value.includes("manager") || value.includes("responsable")) {
      return "Responsable";
    }

    if (value.includes("agent")) {
      return "Agent";
    }

    return role || "Utilisateur";
  },

  statusClass(status) {
    const value = this.normalize(status);

    if (value.includes("attente") || value.includes("nouveau")) {
      return "status-pending";
    }

    if (value.includes("confirm")) {
      return "status-confirmed";
    }

    if (value.includes("cours") || value.includes("progress")) {
      return "status-progress";
    }

    if (
      value.includes("termine") ||
      value.includes("livre") ||
      value.includes("complete")
    ) {
      return "status-completed";
    }

    if (value.includes("annul")) {
      return "status-cancelled";
    }

    return "status-unknown";
  },

  statusBadge(status) {
    const safeStatus = this.escape(status || "En attente");

    return `
      <span class="status-badge ${this.statusClass(status)}">
        ${safeStatus}
      </span>
    `;
  },

  showToast(message, type = "info") {
    const container = this.$("#toastContainer");

    if (!container) {
      window.alert(message);
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 4500);
  },

  setButtonLoading(button, loading, loadingText = "Chargement…") {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.innerHTML;
      }

      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;

      if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }
};


/* =========================================================
   STOCKAGE DE SESSION
   ========================================================= */

const AdminSession = {
  save(token, user) {
    ADMIN_STATE.token = token || "";
    ADMIN_STATE.user = user || null;

    try {
      sessionStorage.setItem(
        ADMIN_CONFIG.SESSION_KEY,
        ADMIN_STATE.token
      );

      sessionStorage.setItem(
        ADMIN_CONFIG.USER_KEY,
        JSON.stringify(ADMIN_STATE.user)
      );
    } catch (error) {
      console.warn("Stockage de session indisponible.", error);
    }
  },

  load() {
    try {
      ADMIN_STATE.token =
        sessionStorage.getItem(ADMIN_CONFIG.SESSION_KEY) || "";

      const user = sessionStorage.getItem(ADMIN_CONFIG.USER_KEY);

      ADMIN_STATE.user = user ? JSON.parse(user) : null;
    } catch (error) {
      ADMIN_STATE.token = "";
      ADMIN_STATE.user = null;
    }

    return Boolean(ADMIN_STATE.token);
  },

  clear() {
    ADMIN_STATE.token = "";
    ADMIN_STATE.user = null;

    try {
      sessionStorage.removeItem(ADMIN_CONFIG.SESSION_KEY);
      sessionStorage.removeItem(ADMIN_CONFIG.USER_KEY);
    } catch (error) {
      console.warn("Impossible de nettoyer la session locale.", error);
    }
  }
};


/* =========================================================
   COMMUNICATION AVEC GOOGLE APPS SCRIPT
   ========================================================= */

const AdminAPI = {
  configured() {
    return Boolean(
      ADMIN_CONFIG.API_URL &&
      /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(
        ADMIN_CONFIG.API_URL
      )
    );
  },

  async request(action, data = {}, method = "GET") {
    if (!this.configured()) {
      throw new Error(
        "Backend non configuré : l’URL du nouveau déploiement Google Apps Script doit être ajoutée dans admin.js."
      );
    }

    const payload = {
      action,
      ...data
    };

    if (ADMIN_STATE.token) {
      payload.token = ADMIN_STATE.token;
    }

    let url = ADMIN_CONFIG.API_URL;
    const options = {
      method: "GET",
      redirect: "follow",
      cache: "no-store"
    };

    if (method === "GET") {
      const params = new URLSearchParams();

      Object.entries(payload).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          typeof value !== "object"
        ) {
          params.set(key, String(value));
        }
      });

      url += (url.includes("?") ? "&" : "?") + params.toString();
    } else {
      /*
       * Apps Script et les navigateurs peuvent traiter les requêtes
       * cross-origin différemment selon le type de contenu.
       * Le backend devra être conçu pour accepter ce format.
       */
      options.method = "POST";
      options.headers = {
        "Content-Type": "text/plain;charset=utf-8"
      };
      options.body = JSON.stringify(payload);
    }

    let response;

    try {
      response = await fetch(url, options);
    } catch (error) {
      throw new Error(
        "Connexion au serveur impossible. Vérifiez l’URL du déploiement, l’accès Internet et la configuration du backend."
      );
    }

    let result;

    try {
      result = await response.json();
    } catch (error) {
      throw new Error(
        "Le serveur n’a pas renvoyé une réponse JSON exploitable."
      );
    }

    if (!response.ok) {
      throw new Error(
        result.message ||
        result.error ||
        `Erreur serveur (${response.status}).`
      );
    }

    if (result.ok === false || result.success === false) {
      throw new Error(
        result.message ||
        result.error ||
        "L’opération n’a pas été acceptée par le serveur."
      );
    }

    return result;
  },

  login(email, password) {
    return this.request(
      "adminLogin",
      { email, password },
      "POST"
    );
  },

  logout() {
    return this.request("adminLogout", {}, "POST");
  },

  getDashboard() {
    return this.request("adminDashboard");
  },

  getOrders() {
    return this.request("adminListOrders");
  },

  getArchives() {
    return this.request("adminListArchives");
  },

  getTrash() {
    return this.request("adminListTrash");
  },

  getMembers() {
    return this.request("adminListMembers");
  },

  updateOrderStatus(code, status) {
    return this.request(
      "adminUpdateOrderStatus",
      { code, status },
      "POST"
    );
  },

  archiveOrder(code) {
    return this.request(
      "adminArchiveOrder",
      { code },
      "POST"
    );
  },

  restoreOrder(code) {
    return this.request(
      "adminRestoreOrder",
      { code },
      "POST"
    );
  },

  moveToTrash(code) {
    return this.request(
      "adminMoveOrderToTrash",
      { code },
      "POST"
    );
  },

  restoreFromTrash(code) {
    return this.request(
      "adminRestoreFromTrash",
      { code },
      "POST"
    );
  },

  deletePermanently(code) {
    return this.request(
      "adminDeleteOrderPermanently",
      { code },
      "POST"
    );
  },

  createMember(member) {
    return this.request(
      "adminCreateMember",
      member,
      "POST"
    );
  },

  updateMemberStatus(email, active) {
    return this.request(
      "adminUpdateMemberStatus",
      { email, active },
      "POST"
    );
  },

  testConnection() {
    return this.request("health");
  }
};


/* =========================================================
   AFFICHAGE CONNEXION / APPLICATION
   ========================================================= */

const AdminView = {
  showLogin() {
    const login = Admin.$("#loginScreen");
    const app = Admin.$("#adminApp");

    if (login) login.hidden = false;
    if (app) app.hidden = true;
  },

  showApp() {
    const login = Admin.$("#loginScreen");
    const app = Admin.$("#adminApp");

    if (login) login.hidden = true;
    if (app) app.hidden = false;

    this.updateUser();
  },

  updateUser() {
    const user = ADMIN_STATE.user || {};
    const name =
      user.name ||
      user.fullName ||
      user.email ||
      "Administrateur";

    const role = Admin.roleLabel(user.role || user.type || "admin");

    const nameElement = Admin.$("#loggedInUser");
    const roleElement = Admin.$("#loggedInRole");
    const avatarElement = Admin.$("#userAvatar");

    if (nameElement) nameElement.textContent = name;
    if (roleElement) roleElement.textContent = role;

    if (avatarElement) {
      const initials = name
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");

      avatarElement.textContent = initials || "GE";
    }

    const isOwner =
      Admin.normalize(user.role || user.type || "") === "owner" ||
      Admin.normalize(user.role || user.type || "").includes("proprietaire");

    const membersNav = Admin.$("#membersNavItem");

    if (membersNav) {
      membersNav.hidden = !isOwner;
    }

    /*
     * La restriction de navigation n'est qu'une mesure d'interface.
     * Le serveur doit aussi refuser toute opération non autorisée.
     */
  },

  updateConnection(connected, description = "") {
    const indicator = Admin.$("#connectionIndicator");
    const label = Admin.$("#connectionLabel");
    const detail = Admin.$("#connectionDescription");
    const settings = Admin.$("#settingsConnectionStatus");
    const check = Admin.$("#lastConnectionCheck");

    if (indicator) {
      indicator.classList.toggle("connected", connected);
      indicator.classList.toggle("disconnected", !connected);
    }

    if (label) {
      label.textContent = connected ? "Service disponible" : "Service à vérifier";
    }

    if (detail) {
      detail.textContent = description ||
        (connected ? "Connexion confirmée" : "Connexion indisponible");
    }

    if (settings) {
      settings.textContent = connected ? "Connecté" : "Non connecté";
    }

    if (check) {
      check.textContent = Admin.formatDateTime(new Date());
    }
  },

  navigate(section) {
    const user = ADMIN_STATE.user || {};
    const role = Admin.normalize(user.role || user.type || "");
    const isOwner =
      role === "owner" ||
      role.includes("proprietaire");

    if (section === "members" && !isOwner) {
      Admin.showToast(
        "La gestion des utilisateurs est réservée au propriétaire.",
        "error"
      );
      return;
    }

    const sections = Admin.$$("[data-page]");
    const navItems = Admin.$$("#adminNav [data-section]");

    sections.forEach(item => {
      item.classList.toggle(
        "active",
        item.dataset.page === section
      );
    });

    navItems.forEach(item => {
      item.classList.toggle(
        "active",
        item.dataset.section === section
      );
    });

    ADMIN_STATE.currentSection = section;

    const titles = {
      dashboard: "Vue d’ensemble",
      orders: "Commandes",
      archive: "Archives",
      trash: "Corbeille",
      members: "Utilisateurs",
      settings: "Paramètres"
    };

    const title = Admin.$("#currentPageTitle");

    if (title) {
      title.textContent = titles[section] || "Administration";
    }

    this.closeSidebar();

    if (section === "orders") {
      AdminOrders.render();
    } else if (section === "archive") {
      AdminOrders.renderArchives();
    } else if (section === "trash") {
      AdminOrders.renderTrash();
    } else if (section === "dashboard") {
      AdminDashboard.renderRecentOrders();
    } else if (section === "members") {
      AdminMembers.render();
    }
  },

  openSidebar() {
    const sidebar = Admin.$("#adminSidebar");
    const overlay = Admin.$("#sidebarOverlay");

    if (sidebar) sidebar.classList.add("mobile-open");
    if (overlay) overlay.hidden = false;
  },

  closeSidebar() {
    const sidebar = Admin.$("#adminSidebar");
    const overlay = Admin.$("#sidebarOverlay");

    if (sidebar) sidebar.classList.remove("mobile-open");
    if (overlay) overlay.hidden = true;
  }
};


/* =========================================================
   CONNEXION
   ========================================================= */

const AdminAuth = {
  async login(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = Admin.$("#loginButton");
    const message = Admin.$("#loginMessage");

    const email = Admin.$("#adminEmail")?.value.trim() || "";
    const password = Admin.$("#adminPassword")?.value || "";

    if (!email || !password) {
      Admin.setMessage(
        message,
        "Renseignez votre adresse e-mail et votre code d’accès.",
        "error"
      );
      return;
    }

    if (!AdminAPI.configured()) {
      Admin.setMessage(
        message,
        "Le backend n’est pas encore configuré. La connexion sera activée après l’installation et la vérification de Code.gs.",
        "error"
      );
      return;
    }

    Admin.setButtonLoading(button, true, "Connexion…");
    Admin.setMessage(message, "");

    try {
      const result = await AdminAPI.login(email, password);

      const token =
        result.token ||
        result.sessionToken ||
        result.session ||
        "";

      const user = result.user || result.member || {
        email,
        role: result.role || "admin"
      };

      if (!result.ok || !token) {
        throw new Error(
          "Le serveur n’a pas fourni de session valide. Vérifiez le contrat de connexion du backend."
        );
      }

      AdminSession.save(token, user);
      AdminView.showApp();

      Admin.setMessage(message, "");

      await AdminApp.loadInitialData();

      Admin.showToast("Connexion réussie.", "success");
    } catch (error) {
      Admin.setMessage(
        message,
        error.message || "Connexion impossible.",
        "error"
      );
    } finally {
      Admin.setButtonLoading(button, false);
    }
  },

  async logout() {
    const confirmed = window.confirm(
      "Voulez-vous vraiment vous déconnecter de l’administration ?"
    );

    if (!confirmed) return;

    try {
      if (AdminAPI.configured() && ADMIN_STATE.token) {
        await AdminAPI.logout();
      }
    } catch (error) {
      console.warn("Déconnexion serveur non confirmée.", error);
    } finally {
      AdminSession.clear();

      ADMIN_STATE.orders = [];
      ADMIN_STATE.archives = [];
      ADMIN_STATE.trash = [];
      ADMIN_STATE.members = [];

      AdminView.showLogin();

      Admin.showToast("Vous êtes déconnecté.", "info");
    }
  },

  async restoreSession() {
    if (!AdminSession.load()) {
      AdminView.showLogin();
      return false;
    }

    /*
     * Ne pas faire confiance au rôle stocké dans le navigateur.
     * La session doit être validée côté serveur.
     */
    if (!AdminAPI.configured()) {
      AdminSession.clear();
      AdminView.showLogin();
      return false;
    }

    try {
      const result = await AdminAPI.request("adminMe");

      if (!result.ok || !(result.user || result.member)) {
        throw new Error("Session invalide.");
      }

      ADMIN_STATE.user = result.user || result.member;

      AdminSession.save(ADMIN_STATE.tok
