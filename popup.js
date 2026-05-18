/*
CCPopup Reactive Engine (v4.2) — STABLE RERENDER + FIXED SESSION ARCHITECTURE
-----------------------------------------------------------------------------
FIXES INCLUDED:
- FIXED: resize no longer causes popup to disappear
- FIXED: session.shown no longer blocks rerender visibility
- FIXED: separation of session state vs rendering state
- FIXED: safe rerender with requestAnimationFrame stabilization
- KEEP: strict desktop/mobile render separation
- KEEP: exit intent + delay coordination rules
- KEEP: once-per-session behavior (correctly scoped)
*/

(function (window, document) {
  if (window.CCPopup && window.CCPopup.__engine) return;

  /* -------------------- GLOBAL SESSION (SAFE + CORRECT MODEL) -------------------- */
  const SESSION = {
    shown: false,              // true = popup has ever been shown this session
    activeInstance: null,      // currently active popup instance
    delayActive: false,        // delay popup has fired
    rendering: false           // prevents rerender conflicts
  };

  window.CCPopup = window.CCPopup || {};
  window.CCPopup.__session = SESSION;

  class CCPopupInstance {
    constructor(config = {}) {
      this.config = {
        id: config.id || `cc_${Math.random().toString(36).slice(2)}`,

        trigger: config.trigger || { type: "delay" },
        delay: config.delay || 3000,

        sideImage: config.sideImage || "",
        backgroundImage: config.backgroundImage || "",

        formConfig: config.formConfig || {},
        formScriptUrl: config.formScriptUrl || "",

        exitIntent: config.exitIntent ?? true,
        mobile: config.mobile ?? true,

        styles: config.styles || {},
        layout: config.layout || {},
        mobileLayout: config.mobileLayout || {},

        storageKey: config.storageKey || `cc_closed_${config.id || "default"}`,

        widthType: config.widthType || "fixed",

        ...config
      };

      this.modal = null;
      this.exitBound = false;
      this.lastIsMobile = this.isMobile();
      this.resizeBound = false;
    }

    /* -------------------- INIT -------------------- */
    init() {
      const boot = () => {
        this.injectStyles();
        this.mount();
        this.bindEvents();
        this.bindReactiveViewport();
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
      } else {
        boot();
      }
    }

    /* -------------------- SESSION ACCESS -------------------- */
    get session() {
      return window.CCPopup.__session;
    }

    /* -------------------- VIEWPORT -------------------- */
    isMobile() {
      return window.innerWidth <= 768;
    }

    bindReactiveViewport() {
      if (this.resizeBound) return;
      this.resizeBound = true;

      window.addEventListener("resize", () => {
        const current = this.isMobile();

        if (current !== this.lastIsMobile) {
          this.lastIsMobile = current;
          this.rerender();
        }
      });
    }

    /* -------------------- FIXED RERENDER -------------------- */
    rerender() {
      const wasVisible = this.modal && this.modal.style.display === "block";

      this.session.rendering = true;

      this.unmount();
      this.mount();

      requestAnimationFrame(() => {
        this.loadForm();

        if (wasVisible) {
          this.show();
        }

        this.session.rendering = false;
      });
    }

    /* -------------------- MOUNT / UNMOUNT -------------------- */
    mount() {
      this.modal = this.isMobile()
        ? this.renderMobile()
        : this.renderDesktop();

      document.body.appendChild(this.modal);

      this.loadForm();
    }

    unmount() {
      if (this.modal) {
        this.modal.remove();
        this.modal = null;
      }
    }

    /* -------------------- STYLES -------------------- */
    injectStyles() {
      const id = `cc_style_${this.config.id}`;
      if (document.getElementById(id)) return;

      const style = document.createElement("style");
      style.id = id;

      style.innerHTML = `
        .cc-modal {
          display:none;
          position:fixed;
          inset:0;
          z-index:99999;
        }

        .cc-modal-content { position:relative; }

        .cc-close {
          position:absolute;
          top:10px;
          right:15px;
          font-size:30px;
          cursor:pointer;
          z-index:2;
        }

        .cc-left img {
          width:100%;
          height:100%;
          object-fit:cover;
        }
      `;

      document.head.appendChild(style);
    }

    /* -------------------- DESKTOP RENDER -------------------- */
    renderDesktop() {
      const cfg = this.config;

      const modal = document.createElement("div");
      modal.className = "cc-modal";
      modal.style.background = cfg.styles.backdropColor || "rgba(0,0,0,0.5)";

      const width = cfg.layout.popupWidth || "600px";
      const height = cfg.layout.popupHeight ? `height:${cfg.layout.popupHeight};` : "";

      const flexDirection = cfg.layout.imagePosition === "right" ? "row-reverse" : "row";

      const bgImage = cfg.backgroundImage;
      const hasBg = bgImage && bgImage.trim() !== "";

      const bg = hasBg
        ? `background-image:url('${bgImage}');background-size:cover;background-position:center;`
        : `background:${cfg.styles.backgroundColor || "#fff"};`;

      modal.innerHTML = `
        <div class="cc-modal-content" style="
          display:flex;
          flex-direction:${flexDirection};
          width:${width};
          ${height}
          margin:10% auto;
          border-radius:${cfg.styles.borderRadius || "12px"};
          overflow:hidden;
          ${bg}
        ">
          ${cfg.sideImage ? `
            <div class="cc-left" style="width:${cfg.layout.imageWidth || "40%"};">
              <img src="${cfg.sideImage}" />
            </div>` : ""}

          <div class="cc-right" style="width:${cfg.layout.formWidth || "60%"};padding:${cfg.styles.padding || "20px"};margin:${cfg.styles.margin || "0"};">
            <span class="cc-close" style="color:${cfg.styles.closeColor || "#fff"}">&times;</span>
            <div id="cc-form-${cfg.id}"></div>
          </div>
        </div>
      `;

      modal.querySelector(".cc-close").onclick = () => this.close();
      modal.onclick = (e) => { if (e.target === modal) this.close(); };

      return modal;
    }

    /* -------------------- MOBILE RENDER -------------------- */
    renderMobile() {
      const cfg = this.config;

      const modal = document.createElement("div");
      modal.className = "cc-modal";
      modal.style.background = cfg.styles.backdropColor || "rgba(0,0,0,0.5)";

      const bg = cfg.mobileLayout.backgroundImage && cfg.mobileLayout.mobileBackgroundImage
        ? `background-image:url('${cfg.mobileLayout.mobileBackgroundImage}');background-size:cover;background-position:center;`
        : `background:${cfg.styles.backgroundColor || "#fff"};`;

      modal.innerHTML = `
        <div class="cc-modal-content" style="
          display:flex;
          flex-direction:column;
          width:300px;
          margin:10% auto;
          border-radius:${cfg.styles.borderRadius || "12px"};
          overflow:hidden;
          ${bg}
        ">
          ${cfg.mobileLayout.displayImage ? `
            <div class="cc-left" style="width:100%;height:${cfg.mobileLayout.imageHeight || "200px"};">
              <img src="${cfg.mobileLayout.topImage || cfg.sideImage}" />
            </div>` : ""}

          <div class="cc-right" style="width:100%;padding:${cfg.styles.padding || "20px"};margin:${cfg.mobileLayout.topMargin || "0"} 0 ${cfg.mobileLayout.bottomMargin || "0"} 0;">
            <span class="cc-close" style="color:${cfg.styles.closeColor || "#fff"}">&times;</span>
            <div id="cc-form-${cfg.id}"></div>
          </div>
        </div>
      `;

      modal.querySelector(".cc-close").onclick = () => this.close();
      modal.onclick = (e) => { if (e.target === modal) this.close(); };

      return modal;
    }

    /* -------------------- FORM -------------------- */
    loadForm() {
      const cfg = this.config;
      const isMobile = this.isMobile();

      const formID = (isMobile && cfg.formConfig.mobileFormID)
        ? cfg.formConfig.mobileFormID
        : cfg.formConfig.formID;

      window.ss_form = {
        account: cfg.formConfig.account,
        formID,
        target_id: `cc-form-${cfg.id}`,
        width: cfg.formConfig.width || "100%",
        domain: cfg.formConfig.domain,
        hidden: cfg.formConfig.hidden || undefined
      };

      const existing = document.querySelector(`script[src="${cfg.formScriptUrl}"]`);
      if (existing) existing.remove();

      const script = document.createElement("script");
      script.src = cfg.formScriptUrl;
      script.async = true;
      document.head.appendChild(script);
    }

    /* -------------------- EVENTS -------------------- */
    bindEvents() {
      if (localStorage.getItem(this.config.storageKey) === "true") return;

      const t = this.config.trigger;

      if (t.type === "delay") {
        setTimeout(() => {
          this.session.delayActive = true;
          this.show();
        }, this.config.delay);
      }

      if (t.type === "click" && t.selector) {
        document.addEventListener("click", (e) => {
          if (e.target.closest(t.selector)) this.show();
        });
      }

      if (this.config.exitIntent && !this.exitBound) {
        this.exitBound = true;

        let engaged = false;
        let enabled = false;

        setTimeout(() => enabled = true, 5000);

        document.addEventListener("mousemove", () => engaged = true, { once: true });

        document.addEventListener("mouseout", (e) => {
          if (this.session.delayActive) return;
          if (enabled && engaged && e.clientY <= 10) this.show();
        });
      }
    }

    /* -------------------- ACTIONS (FIXED) -------------------- */
    show() {
      if (!this.modal) return;
      if (localStorage.getItem(this.config.storageKey) === "true") return;

      this.session.shown = true;
      this.session.activeInstance = this;

      this.modal.style.display = "block";
    }

    close() {
      if (this.modal) this.modal.style.display = "none";

      localStorage.setItem(this.config.storageKey, "true");

      if (this.session.activeInstance === this) {
        this.session.activeInstance = null;
        this.session.delayActive = false;
        this.session.shown = false;
      }
    }
  }

  /* -------------------- PUBLIC API -------------------- */
  window.CCPopup = {
    __engine: true,
    __session: SESSION,
    instances: [],

    init(config) {
      const instance = new CCPopupInstance(config);
      instance.init();
      this.instances.push(instance);
      return instance;
    },

    create(config) {
      return this.init(config);
    }
  };

})(window, document);
