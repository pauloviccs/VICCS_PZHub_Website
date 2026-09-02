/**
 * VICCS PZHub Website - Sistema de Internacionalização (i18n) Multilíngue
 * Suporte nativo para Português (Brasil), English (US) e Español (ES)
 */

export const PZ_CATEGORIES = [
  // Versões
  { id: "Build 42", group: "versions", label: { pt: "Build 42 (Recomendado)", en: "Build 42 (Recommended)", es: "Build 42 (Recomendado)" } },
  { id: "Build 41", group: "versions", label: { pt: "Build 41.78 Legacy", en: "Build 41.78 Legacy", es: "Build 41.78 Legacy" } },
  { id: "Build 40", group: "versions", label: { pt: "Build 40", en: "Build 40", es: "Build 40" } },

  // Elementos e Mecânicas
  { id: "Military", group: "elements", label: { pt: "Militar & Armas", en: "Military & Weapons", es: "Militar y Armas" } },
  { id: "Weapons", group: "elements", label: { pt: "Armas de Fogo e Brancas", en: "Weapons & Guns", es: "Armas y Combate" } },
  { id: "Vehicles", group: "elements", label: { pt: "Veículos & Transporte", en: "Vehicles & Transport", es: "Vehículos y Transporte" } },
  { id: "Building", group: "elements", label: { pt: "Construção & Estruturas", en: "Building & Base", es: "Construcción y Base" } },
  { id: "Clothing/Armor", group: "elements", label: { pt: "Roupas & Armaduras", en: "Clothing & Armor", es: "Ropa y Armadura" } },
  { id: "Food", group: "elements", label: { pt: "Comidas & Culinária", en: "Food & Cooking", es: "Comida y Cocina" } },
  { id: "Farming", group: "elements", label: { pt: "Agricultura & Plantação", en: "Farming & Agriculture", es: "Agricultura" } },
  { id: "Animals", group: "elements", label: { pt: "Animais & Criação", en: "Animals & Husbandry", es: "Animales" } },
  { id: "Items", group: "elements", label: { pt: "Itens Variados", en: "Items & Gear", es: "Objetos e Ítems" } },
  { id: "Literature", group: "elements", label: { pt: "Literatura & Livros", en: "Literature & Books", es: "Literatura y Libros" } },
  { id: "Map", group: "elements", label: { pt: "Mapas & Cidades Adicionais", en: "Maps & Cities", es: "Mapas y Ciudades" } },
  { id: "Audio", group: "elements", label: { pt: "Áudio & Efeitos Sonoros", en: "Audio & Sounds", es: "Audio y Sonidos" } },

  // Estilo e Gameplay
  { id: "Hardmode", group: "gameplay", label: { pt: "Sobrevivência Hardcore", en: "Hardcore Survival", es: "Supervivencia Hardcore" } },
  { id: "QoL", group: "gameplay", label: { pt: "Qualidade de Vida (QoL)", en: "Quality of Life (QoL)", es: "Calidad de Vida (QoL)" } },
  { id: "Multiplayer", group: "gameplay", label: { pt: "Multiplayer & Servidores", en: "Multiplayer & Servers", es: "Multijugador" } },
  { id: "Realistic", group: "gameplay", label: { pt: "Realismo & Imersão", en: "Realism & Immersion", es: "Realismo e Inmersión" } },
  { id: "Balance", group: "gameplay", label: { pt: "Ajustes de Balanceamento", en: "Game Balance", es: "Ajustes de Balance" } },
  { id: "Silly/Fun", group: "gameplay", label: { pt: "Diversão & Cômico", en: "Fun & Silly", es: "Diversión y Cómico" } },

  // Técnica e Estrutura
  { id: "Framework", group: "technical", label: { pt: "Framework & Bibliotecas", en: "Framework & Libraries", es: "Framework y Librerías" } },
  { id: "Interface", group: "technical", label: "Interface (UI & Menus)", label: { pt: "Interface (UI & Menus)", en: "Interface & UI", es: "Interfaz y HUD" } },
  { id: "Language/Translation", group: "technical", label: { pt: "Traduções & Idiomas", en: "Language & Translations", es: "Traducciones" } },
  { id: "Models", group: "technical", label: { pt: "Modelos 3D", en: "3D Models", es: "Modelos 3D" } },
  { id: "Textures", group: "technical", label: { pt: "Texturas Visuais", en: "Textures & Overhauls", es: "Texturas" } },
  { id: "Skills", group: "technical", label: { pt: "Habilidades & Níveis", en: "Skills & Leveling", es: "Habilidades" } },
  { id: "Traits", group: "technical", label: { pt: "Traços & Profissões", en: "Traits & Occupations", es: "Rasgos y Profesiones" } },
  { id: "Pop Culture", group: "technical", label: { pt: "Cultura Pop & Séries", en: "Pop Culture & Easter Eggs", es: "Cultura Pop" } },
  { id: "WIP", group: "technical", label: { pt: "Em Desenvolvimento (WIP)", en: "Work in Progress (WIP)", es: "En Desarrollo (WIP)" } },
  { id: "Misc", group: "technical", label: { pt: "Miscelânea / Outros", en: "Miscellaneous", es: "Miscelánea" } }
];

export const translations = {
  pt: {
    // Top Nav
    "nav_brand": "PZHUB",
    "nav_brand_sub": "COMUNIDADE PROJECT ZOMBOID B42",
    "nav_workshop": "01 // CATÁLOGO",
    "nav_dashboard": "02 // DASHBOARD GERAL",
    "nav_builder": "03 // ESTÚDIO DO CRIADOR",
    "nav_feed": "04 // RADAR SOCIAL (FEED)",
    "nav_admin": "👑 // MODERAÇÃO & STAFF",
    "nav_login": "ENTRAR / CADASTRO",
    "nav_signup": "CADASTRAR",
    "nav_logout": "SAIR",
    "nav_profile": "👤 MEU PERFIL SOCIAL",
    "nav_download_app": "BAIXAR SOFTWARE DESKTOP",
    "btn_download_software": "⬇️ BAIXAR PZHUB DESKTOP (.EXE)",

    // Hero
    "hero_title": "ECOSSISTEMA SOCIAL & TÁCTICO DE MODPACKS",
    "hero_desc": "Publique suas coleções de mods com 1 clique, siga seus criadores favoritos, interaja no mural de recados e sincronize instantaneamente com o aplicativo desktop PZHub.",

    // Workshop View
    "ws_category_all": "TODOS OS MODPACKS",
    "ws_search_placeholder": "Buscar modpack...",
    "ws_sort_popular": "🔥 Mais Populares (Relevância)",
    "ws_sort_likes": "⭐ Mais Votados (Likes)",
    "ws_sort_recent": "⚡ Recentes (Novidades)",
    "btn_copy_manifest": "COPIAR LINK P/ PZHub",
    "btn_view_details": "INSPECIONAR DETALHES",
    "btn_download_zip": "DOWNLOAD DIRETO (.ZIP)",

    // Builder View
    "builder_title": "MODPACK BUILDER // NUVEM",
    "builder_subtitle": "Crie coleções oficiais ou personalizadas para a comunidade importar no PZHub.",
    "builder_name_label": "Nome Oficial do Modpack *",
    "builder_version_label": "Versão Inicial *",
    "builder_cat_label": "Categoria Principal",
    "builder_compat_label": "Compatibilidade Zomboid",
    "builder_desc_label": "Descrição Completa / Manifesto *",
    "builder_image_label": "Imagem de Capa (Banner HD)",
    "builder_crop_btn": "📷 AJUSTAR & ENVIAR",
    "builder_mods_title": "COMPONENTES DO MODPACK",
    "btn_add_mod": "+ ADICIONAR MOD / ITEM",
    "btn_save_publish": "🚀 SALVAR & PUBLICAR NO WORKSHOP",

    // Modals
    "auth_modal_title": "ACESSO À REDE PZHUB",
    "auth_email": "E-mail do Sobrevivente",
    "auth_pass": "Chave de Acesso (Senha)",
    "auth_btn_login": "ENTRAR NO SISTEMA",
    "auth_btn_signup": "CRIAR CONTA NOVA"
  },

  en: {
    // Top Nav
    "nav_brand": "PZHUB",
    "nav_brand_sub": "PROJECT ZOMBOID B42 COMMUNITY",
    "nav_workshop": "01 // WORKSHOP",
    "nav_dashboard": "02 // DASHBOARD",
    "nav_builder": "03 // CREATOR STUDIO",
    "nav_feed": "04 // SOCIAL RADAR",
    "nav_admin": "👑 // MODERATION & STAFF",
    "nav_login": "LOGIN / SIGNUP",
    "nav_signup": "REGISTER",
    "nav_logout": "LOGOUT",
    "nav_profile": "👤 MY SOCIAL PROFILE",
    "nav_download_app": "DOWNLOAD DESKTOP APP",
    "btn_download_software": "⬇️ DOWNLOAD PZHUB DESKTOP (.EXE)",

    // Hero
    "hero_title": "SOCIAL & TACTICAL MODPACK ECOSYSTEM",
    "hero_desc": "Publish your mod collections with 1 click, follow your favorite creators, post on bulletin boards and sync instantly with PZHub desktop app.",

    // Workshop View
    "ws_category_all": "ALL MODPACKS",
    "ws_search_placeholder": "Search modpack...",
    "ws_sort_popular": "🔥 Most Popular (Relevance)",
    "ws_sort_likes": "⭐ Top Rated (Likes)",
    "ws_sort_recent": "⚡ New Releases",
    "btn_copy_manifest": "COPY LINK TO PZHub",
    "btn_view_details": "INSPECT DETAILS",
    "btn_download_zip": "DIRECT DOWNLOAD (.ZIP)",

    // Builder View
    "builder_title": "MODPACK BUILDER // CLOUD",
    "builder_subtitle": "Create official or custom collections for the community to import into PZHub.",
    "builder_name_label": "Official Modpack Name *",
    "builder_version_label": "Initial Version *",
    "builder_cat_label": "Primary Category",
    "builder_compat_label": "Zomboid Compatibility",
    "builder_desc_label": "Full Description / Lore *",
    "builder_image_label": "Cover Image (HD Banner)",
    "builder_crop_btn": "📷 CROP & UPLOAD",
    "builder_mods_title": "MODPACK COMPONENTS",
    "btn_add_mod": "+ ADD MOD / COMPONENT",
    "btn_save_publish": "🚀 SAVE & PUBLISH TO WORKSHOP",

    // Modals
    "auth_modal_title": "PZHUB NETWORK ACCESS",
    "auth_email": "Survivor Email",
    "auth_pass": "Access Password",
    "auth_btn_login": "LOGIN TO NETWORK",
    "auth_btn_signup": "CREATE NEW ACCOUNT"
  },

  es: {
    // Top Nav
    "nav_brand": "PZHUB",
    "nav_brand_sub": "COMUNIDAD PROJECT ZOMBOID B42",
    "nav_workshop": "01 // CATÁLOGO",
    "nav_dashboard": "02 // PANEL GENERAL",
    "nav_builder": "03 // ESTUDIO CREADOR",
    "nav_feed": "04 // RADAR SOCIAL",
    "nav_admin": "👑 // MODERACIÓN Y STAFF",
    "nav_login": "INICIAR SESIÓN / REGISTRO",
    "nav_signup": "REGISTRARSE",
    "nav_logout": "SALIR",
    "nav_profile": "👤 MI PERFIL SOCIAL",
    "nav_download_app": "DESCARGAR APP ESCRITORIO",
    "btn_download_software": "⬇️ DESCARGAR PZHUB DESKTOP (.EXE)",

    // Hero
    "hero_title": "ECOSISTEMA SOCIAL Y TÁCTICO DE MODPACKS",
    "hero_desc": "Publica tus colecciones de mods con 1 clic, sigue a tus creadores favoritos, interactúa en el muro de mensajes y sincroniza al instante con la app de escritorio PZHub.",

    // Workshop View
    "ws_category_all": "TODOS LOS MODPACKS",
    "ws_search_placeholder": "Buscar modpack...",
    "ws_sort_popular": "🔥 Más Populares (Relevancia)",
    "ws_sort_likes": "⭐ Más Votados (Likes)",
    "ws_sort_recent": "⚡ Recientes (Novedades)",
    "btn_copy_manifest": "COPIAR LINK P/ PZHub",
    "btn_view_details": "INSPECCIONAR DETALLES",
    "btn_download_zip": "DESCARGA DIRECTA (.ZIP)",

    // Builder View
    "builder_title": "CONSTRUCTOR DE MODPACKS // NUBE",
    "builder_subtitle": "Crea colecciones oficiales o personalizadas para que la comunidad las importe en PZHub.",
    "builder_name_label": "Nombre Oficial del Modpack *",
    "builder_version_label": "Versión Inicial *",
    "builder_cat_label": "Categoría Principal",
    "builder_compat_label": "Compatibilidad Zomboid",
    "builder_desc_label": "Descripción Completa / Manifiesto *",
    "builder_image_label": "Imagen de Portada (Banner HD)",
    "builder_crop_btn": "📷 AJUSTAR Y SUBIR",
    "builder_mods_title": "COMPONENTES DEL MODPACK",
    "btn_add_mod": "+ AÑADIR MOD / ÍTEM",
    "btn_save_publish": "🚀 GUARDAR Y PUBLICAR EN WORKSHOP",

    // Modals
    "auth_modal_title": "ACCESO A LA RED PZHUB",
    "auth_email": "Correo del Superviviente",
    "auth_pass": "Contraseña de Acceso",
    "auth_btn_login": "ENTRAR AL SISTEMA",
    "auth_btn_signup": "CREAR CUENTA NUEVA"
  }
};

class I18nManager {
  constructor() {
    this.currentLang = localStorage.getItem('pzhub_web_lang') || 'pt';
    if (!translations[this.currentLang]) {
      this.currentLang = 'pt';
    }
    this.listeners = [];
  }

  setLanguage(lang) {
    if (!translations[lang]) return;
    this.currentLang = lang;
    localStorage.setItem('pzhub_web_lang', lang);
    this.updateDom();
    this.listeners.forEach(fn => fn(lang));
  }

  t(key, fallback = '') {
    return translations[this.currentLang]?.[key] || translations['pt']?.[key] || fallback || key;
  }

  getCategoryName(catId) {
    const found = PZ_CATEGORIES.find(c => c.id.toLowerCase() === (catId || '').toLowerCase());
    if (found) {
      return found.label[this.currentLang] || found.label.pt || catId;
    }
    return catId;
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  updateDom() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && translations[this.currentLang]?.[key]) {
        el.textContent = translations[this.currentLang][key];
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key && translations[this.currentLang]?.[key]) {
        el.placeholder = translations[this.currentLang][key];
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key && translations[this.currentLang]?.[key]) {
        el.title = translations[this.currentLang][key];
      }
    });

    // Atualiza botões do seletor
    document.querySelectorAll('.web-lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === this.currentLang);
    });
  }
}

export const i18n = new I18nManager();
