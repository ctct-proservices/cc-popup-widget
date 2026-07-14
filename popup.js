(function(window, document) {
    const STORAGE_KEYS = {
    ACTIVE_TAB: "cc_popup_active_tab",
    CLOSED_PREFIX: "cc_popup_closed_",
    LAST_HEARTBEAT: "cc_popup_last_heartbeat"
};

const SESSION = {
    shown: false,
    activeInstance: null,
    rendering: false
};

function domainAllowed(host, allowedDomains) {

return allowedDomains.some(domain => {

    domain = domain.toLowerCase();
    host = host.toLowerCase();

    // Exact match
    if (host === domain) {
        return true;
    }

    // Wildcard (*.example.com)
    if (domain.startsWith("*.")) {

        const root = domain.substring(2);

        return (
            host === root ||
            host.endsWith("." + root)
        );

    }

    return false;

});

}


class CCPopupInstance {

    constructor(config = {}) {
        

        /*
        =========================================================
        INSTANCE STATE (must exist first)
        =========================================================
        */
    
        this.modal = null;
        this.contentEl = null;
    
        this.isAnimating = false;
        this.animationState = "idle";
    
        this.exitBound = false;
        this.resizeBound = false;
    
        this.lastIsMobile = this.isMobile?.() ?? false;
    
        /*
        =========================================================
        RAW CONFIG BUILD
        =========================================================
        */
    
        this.config = {
    
            id: config.id || `cc_${Math.random().toString(36).slice(2)}`,
    
            mobile: config.mobile ?? true,
    
            crossTabSessionLock: config.crossTabSessionLock ?? true,
    
            widthType: config.widthType || "fixed",
    
            /*
            =========================================================
            TRIGGERS
            =========================================================
            */
    
            trigger: {
                type: config.trigger?.type ?? (config.exitIntent ? "exit" : "delay"),
                selector: config.trigger?.selector || "",
                delay: config.trigger?.delay ?? config.delay ?? 3000,
                exitIntent: config.trigger?.exitIntent ?? config.exitIntent ?? true,
                exitIntentDelay: config.trigger?.exitIntentDelay ?? config.exitIntentDelay ?? 15000
            },
    
            /*
            =========================================================
            ANIMATION (RAW INPUT)
            =========================================================
            */
    
            animation: {
                enabled: config.animation?.enabled ?? false,
                enter: config.animation?.enter ?? config.animation?.type ?? "fade",
                exit: config.animation?.exit ?? config.animation?.type ?? "fade",
                duration: config.animation?.duration ?? 300,
                easing: config.animation?.easing ?? "ease",
                animateOnClose: config.animation?.animateOnClose ?? true
            },
    
            /*
            =========================================================
            MEDIA
            =========================================================
            */
    
            sideImage: config.sideImage || "",
            topImage: config.topImage || "",
            backgroundImage: config.backgroundImage || "",
    
            /*
            =========================================================
            STYLES
            =========================================================
            */
    
            styles: config.styles || {},
    
            /*
            =========================================================
            LAYOUT
            =========================================================
            */
    
            layout: config.layout || {},
            
            /*
            =========================================================
            CACHE
            =========================================================
            */

            cache: {
                enabled: config.cache?.enabled ?? true,
                duration: config.cache?.duration ?? 300000
            },
            /*
            =========================================================
            MOBILE
            =========================================================
            */
    
            mobileLayout: config.mobileLayout || {},
    
            /*
            =========================================================
            FORM (RAW - WILL BE NORMALIZED BELOW)
            =========================================================
            */
    
            form: config.form || {},
    
            /*
            =========================================================
            FOOTER
            =========================================================
            */
    
            footerClosePopupButton:
                config.footerClosePopupButton ?? false,
    
            footerClosePopupButtonText:
                config.footerClosePopupButtonText ?? "Close",


        };
    
        /*
        =========================================================
        CONFIG NORMALIZATION PATCH
        =========================================================
        */
    
        // FORM normalization (supports both form + formConfig)
        this.config.form = {
            account: config.form?.account || config.formConfig?.account || "",
            formID: config.form?.formID || config.formConfig?.formID || "",
            mobileFormID: config.form?.mobileFormID || config.formConfig?.mobileFormID || "",
            domain: config.form?.domain || config.formConfig?.domain || "",
            formScriptUrl: config.form?.formScriptUrl || config.formConfig?.formScriptUrl || "",
            width: config.form?.width || config.formConfig?.width || "100%",
            hidden: config.form?.hidden || config.formConfig?.hidden || {}
        };
    
        // Animation normalization
        const rawAnimation = config.animation || {};
    
        const normalizeAnimationType = (type) => {
            if (!type) return "fade";
    
            const t = String(type).toLowerCase();
    
            if (t === "slideright" || t === "slide-right") return "slide-right";
            if (t === "slideleft" || t === "slide-left") return "slide-left";
            if (t === "fadein" || t === "fade") return "fade";
    
            return t;
        };
    
        this.config.animation = {
            enabled: rawAnimation.enabled ?? false,
    
            enter: normalizeAnimationType(
                rawAnimation.enter || rawAnimation.type || "fade"
            ),
    
            exit: normalizeAnimationType(
                rawAnimation.exit || rawAnimation.type || "fade"
            ),
    
            duration: rawAnimation.duration ?? 300,
            easing: rawAnimation.easing ?? "ease",
            animateOnClose: rawAnimation.animateOnClose ?? true
        };
    }

    getAnimationClass() {
        const type = this.config.animation?.enter ?? "fade";

        switch (type) {
            case "slideright":
            case "slide-right":
            case "slideRight":
                return "cc-slide-right";

            case "slideleft":
            case "slide-left":
            case "slideLeft":
                return "cc-slide-left";

            case "slideup":
            case "slide-up":
            case "slideUp":
                return "cc-slide-up";

            case "slidedown":
            case "slide-down":
            case "slideDown":
                return "cc-slide-down";

            case "zoom":
                return "cc-zoom";

            case "fade":
            default:
                return "cc-fade";
        }
    }

    getAnimationTransform(type) {

        switch ((type || "").toLowerCase()) {

            case "slideright":
            case "slide-right":
                return "translateX(100%)";

            case "slideleft":
            case "slide-left":
                return "translateX(-100%)";

            case "slideup":
            case "slide-up":
                return "translateY(100%)";

            case "slidedown":
            case "slide-down":
                return "translateY(-100%)";

            case "zoom":
                return "scale(.8)";

            default:
                return null;
        }
        }

    /*
    =========================================================
    SESSION HELPERS (TEMP PLACEHOLDER)
    =========================================================
    */

    isMobile() {
        return window.innerWidth <= 768;
    }

    /*
    =========================================================
    STORAGE
    =========================================================
    */

    getTabId() {

        let id = sessionStorage.getItem("cc_tab_id");

        if (!id) {

            id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
            sessionStorage.setItem("cc_tab_id", id);

        }

        return id;
    }

    isClosed() {

        const key = STORAGE_KEYS.CLOSED_PREFIX + this.config.id;
        const value = localStorage.getItem(key);

        if (!value) return false;

        const closedAt = Number(value);
        if (!closedAt) return false;

        const expiration = 7 * 24 * 60 * 60 * 1000;

        if (Date.now() - closedAt > expiration) {
            this.clearClosed();
            return false;
        }

        return true;
    }

    markClosed() {

        localStorage.setItem(
            STORAGE_KEYS.CLOSED_PREFIX + this.config.id,
            Date.now().toString()
        );
    }

    clearClosed() {

        localStorage.removeItem(
            STORAGE_KEYS.CLOSED_PREFIX + this.config.id
        );
    }

    /*
    =========================================================
    TAB LOCKING
    =========================================================
    */

    getActiveTab() {
        return localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    }

    isOwnedByAnotherTab() {

        if (!this.config.crossTabSessionLock) return false;

        const active = this.getActiveTab();
        const me = this.getTabId();

        if (!active) return false;

        // 🚀 allow takeover if stale session
        const heartbeat = Number(localStorage.getItem("cc_popup_last_heartbeat"));
        const stale = !heartbeat || Date.now() - heartbeat > 15000;

        if (stale) {
            this.claimTabLock();
            return false;
        }

        return active !== me;
        }

    claimTabLock() {

        if (!this.config.crossTabSessionLock) return true;

        const HEARTBEAT_TIMEOUT = 10000;

        const heartbeat = Number(
            localStorage.getItem(STORAGE_KEYS.LAST_HEARTBEAT)
        );

        if (heartbeat && Date.now() - heartbeat > HEARTBEAT_TIMEOUT) {
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB);
            localStorage.removeItem(STORAGE_KEYS.LAST_HEARTBEAT);
        }

        const tabId = this.getTabId();
        const active = this.getActiveTab();

        if (active && active !== tabId) return false;

        localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tabId);
        localStorage.setItem(STORAGE_KEYS.LAST_HEARTBEAT, Date.now().toString());

        return true;
    }

    releaseTabLock() {

        if (!this.config.crossTabSessionLock) return;

        const active = this.getActiveTab();

        if (active === this.getTabId()) {
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB);
            localStorage.removeItem(STORAGE_KEYS.LAST_HEARTBEAT);
        }
    }

    refreshHeartbeat() {

        if (this.getActiveTab() === this.getTabId()) {
            localStorage.setItem(
                STORAGE_KEYS.LAST_HEARTBEAT,
                Date.now().toString()
            );
        }
    }

    /*
    =========================================================
    SESSION
    =========================================================
    */

    get session() {
        return SESSION;
    }

    isPopupVisible() {
        return this.modal && this.modal.style.display === "block";
    }


     /*
    =========================================================
    LIFECYCLE + ANIMATION SAFE ENGINE (STABLE v1)
    =========================================================
    */

    /*
    =========================================================
    INIT
    =========================================================
    */

    init() {

        const boot = () => {

        //  ADD THIS GUARD
        if (!this.config.mobile && this.isMobile()) {
            return;
        }

            this.injectStyles?.();
            this.injectAnimationStyles?.();

            this.mount();
            this.bindEvents();
            this.bindResponsiveWatcher?.();
            };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", boot);
        } else {
            boot();
        }
    }

    /*
    =========================================================
    MOUNT / UNMOUNT
    =========================================================
    */

    mount() {

        this.modal = this.isMobile()
            ? this.renderMobile()
            : this.renderDesktop();

        document.body.appendChild(this.modal);

        this.loadForm();
    }

    unmount() {

        if (!this.modal) return;

        this.modal.remove();
        this.modal = null;
        this.contentEl = null;
    }

    /*
    =========================================================
    DOM HELPERS (INSTANCE SAFE)
    =========================================================
    */

    getContentEl() {

        if (!this.modal) return null;

        if (!this.contentEl) {
            this.contentEl = this.modal.querySelector(".cc-modal-content");
        }

        return this.contentEl;
    }

    /*
    =========================================================
    STATE GUARDS
    =========================================================
    */

    isBusy() {
        return this.isAnimating === true;
    }

    /*
    =========================================================
    SHOW
    =========================================================
    */

    show() {
       
        if (this.isBusy()) return;
        if (!this.modal) return;
        if (this.isClosed()) return;
        if (!this.claimTabLock()) return;

        this.session.activeInstance = this;
        this.session.shown = true;

        const content = this.getContentEl();
        if (!content) return;

        this.modal.style.display = "block";
        this.onShow?.();

        const duration = this.config.animation?.duration || 400;
        const easing = this.config.animation?.easing || "ease";

        const animationEnabled = this.config.animation?.enabled;

        const enterTransform =
            this.getAnimationTransform?.(this.config.animation?.enter);

        // 1. initial state
        content.style.transition = "none";

        if (enterTransform) {
            content.style.transform = enterTransform;
        }

        content.style.opacity = "0";

       

        // 3. animation pipeline
        requestAnimationFrame(() => {

            requestAnimationFrame(() => {

                content.style.transition =
                    `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;

                content.style.transform = "translate(0,0) scale(1)";
                content.style.opacity = "1";
            });

        });
        }

        loadForm(options = {}) {

        const force = options.force || false;

        const isMobile = this.isMobile();

        if (
            !force &&
            this.formLoaded &&
            this.loadedFormMode === (isMobile ? "mobile" : "desktop")
        ) {
            return;
        }

        this.loadedFormMode = isMobile ? "mobile" : "desktop";
        this.formLoaded = true;

        const cfg = this.config;

        const container = document.getElementById(`cc-form-${cfg.id}`);
        if (!container) return;

        container.innerHTML = "";

        const form = cfg.form || cfg.formConfig;
        if (!form) return;

        window.ss_form = {
            account: form.account,
            formID: cfg.isMobile?.() && form.mobileFormID ? form.mobileFormID : form.formID,
            target_id: `cc-form-${cfg.id}`,
            width: form.width || "100%",
            domain: form.domain,
            hidden: form.hidden || undefined
        };

        const script = document.createElement("script");
        script.src = form.formScriptUrl + "&t=" + Date.now();
        script.async = true;

        container.appendChild(script);
        }

    /*
    =========================================================
    CLOSE
    =========================================================
    */

    close() {

        if (this.isBusy()) return;
        if (!this.modal) return;

        const content = this.getContentEl();
        if (!content) return;


        if (this.footerButton) {
            this.footerButton.style.display = "none";
        }

        if (this.formContainer) {
            this.formContainer.style.height = "auto";
        }

        if (this.modalContent) {
            this.modalContent.style.height = "auto";
        }

        const duration = this.config.animation?.duration || 400;

        if (this.config.animation?.enabled &&
            this.config.animation.animateOnClose) {

            this.isAnimating = true;

            const transform = this.getAnimationTransform(this.config.animation.exit);

            content.style.transition =
                `transform ${duration}ms ${this.config.animation.easing}, opacity ${duration}ms ${this.config.animation.easing}`;

            requestAnimationFrame(() => {

                if (transform) {
                    content.style.transform = transform;
                }

                content.style.opacity = "0";

                setTimeout(() => {

                    this.modal.style.display = "none";
                    this._finalizeClose();

                    this.isAnimating = false;
                    this.contentEl = null;

                }, duration);

            });

        } else {

            this.modal.style.display = "none";
            this._finalizeClose();
        }
        }

    /*
    =========================================================
    FINALIZE CLOSE
    =========================================================
    */

    _finalizeClose() {

        if (this.session.activeInstance === this) {

            this.session.activeInstance = null;
            this.session.shown = false;

            this.markClosed();
            this.releaseTabLock();
        }
    }
 /*
    =========================================================
    EVENT BINDING
    =========================================================
    */

    bindEvents() {
        
        const trigger = this.config.trigger;

        if (trigger.type === "delay") {

            setTimeout(() => this.show(), trigger.delay);
        }

        if (trigger.type === "click") {

            document.addEventListener("click", (e) => {

                if (e.target.closest(trigger.selector)) {
                    this.show();
                }
            });
        }

        if (trigger.type === "exit") {

            let engaged = false;
            let enabled = false;

            document.addEventListener("mousemove", () => engaged = true, { once: true });

            setTimeout(() => enabled = true, trigger.exitIntentDelay);

            document.addEventListener("mouseout", (e) => {

                if (this.session.shown) return;
                if (!engaged || !enabled) return;
                if (e.clientY > 10) return;

                this.show();
            });
        }
    }

    /*
    =========================================================
    RESPONSIVE RERENDER
    =========================================================
    */

    bindResponsiveWatcher() {

        this.lastIsMobile = this.isMobile();

        window.addEventListener("resize", () => {

            const current = this.isMobile();

            if (current !== this.lastIsMobile) {

                this.lastIsMobile = current;

                this.rerender();
            }
        });
    }

    rerender() {

        if (!this.config.mobile && this.isMobile()) {
            this.unmount();
            return;
        }

        if (this.isBusy()) return;

        const wasVisible = this.isPopupVisible?.();

        this.unmount();

        this.modal = null;
        this.contentEl = null;

        this.mount();

        this.loadForm();

        if (wasVisible) {
            this.show();
        }
    }
  
      /*
      =========================================================
      STYLES
      =========================================================
      */
  
      injectStyles() {
          

        const styleId = `cc-style-${this.config.id}`;
        if (document.getElementById(styleId)) return;
  
        const style = document.createElement("style");
        style.id = styleId;

        let position = "relative";
          
        if (this.config.layout.position === "center") {
            position = "position:relative;";
        }

        if (this.config.layout.position === "right") {
            position = "position:fixed;right:0";
        }

        if (this.config.layout.position === "left") {
            position = "position:fixed;left:0";
        }

        style.innerHTML = `
        .cc-modal-content {
            will-change: transform, opacity;
            transform: translateZ(0);
        }
          .cc-animation-visible {
              opacity:1;
              transform:none;
          }

          .cc-slide-right {
              opacity:0;
              transform:translateX(100%);
          }

          .cc-slide-left {
              opacity:0;
              transform:translateX(-100%);
          }

          .cc-slide-up {
              opacity:0;
              transform:translateY(100%);
          }

          

          .cc-slide-right-enter {
            transform: translateX(100%);
            opacity: 0;
        }

        .cc-slide-right-enter-active {
            transform: translateX(0);
            opacity: 1;
            transition: all 400ms ease;
        }

        .cc-slide-right-exit {
            transform: translateX(0);
            opacity: 1;
        }

        .cc-slide-right-exit-active {
            transform: translateX(100%);
            opacity: 0;
            transition: all 400ms ease;
        }

          .cc-slide-down {
              opacity:0;
              transform:translateY(-100%);
          }

          .cc-fade {
              opacity:0;
          }

          .cc-zoom {
              opacity:0;
              transform:scale(.8);
          }
          

            .cc-animation-visible {
                opacity: 1;
                transform: translate(0,0) scale(1);
            }
          .cc-modal {
            display:none;
            position:fixed;
            inset:0;
            z-index:99999;
          }

          
          .cc-modal-content { ${position} }
          .cc-close {
            position:absolute;
            top:10px;
            right:15px;
            font-size:30px;
            cursor:pointer;
            z-index:10;
          }
          .cc-left img {
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
          }

          .footerClosePopupBtn {
              width: 100%;
              height: 30px;
              background: transparent;
              border: none;
              margin-top: -25px;
              margin-bottom: 10px;
              font-size: 16px;
              color: ${this.config.styles.footerClosePopupButtonTextColor};

          }
          .footerClosePopupBtn:hover {
              width:100%;
              color: ${this.config.styles.footerClosePopupButtonTextColorHover};

          }
        `;
  
        document.head.appendChild(style);
      }

       /*
      =========================================================
      RENDER DESKTOP
      =========================================================
      */
  
      renderDesktop() {

        const cfg = this.config;

        const modal = document.createElement("div");

        this.formContainer = modal.querySelector(`#cc-form-${cfg.id}`);
        this.modalContent = modal.querySelector(".cc-modal-content");
        this.footerButton = modal.querySelector(".footerClosePopupBtn");

        modal.className = "cc-modal";

        modal.style.background =
            cfg.styles.backdropColor ||
            "rgba(0,0,0,0.5)";

        let flexDirection = "row";

            if (cfg.layout.imagePosition === "right") {
            flexDirection = "row-reverse";
            }

            if (cfg.layout.imagePosition === "left") {
            flexDirection = "row";
            }

            if (cfg.layout.imagePosition === "top") {
            flexDirection = "column";
            }

        const hasBg =
            cfg.backgroundImage &&
            cfg.backgroundImage.trim() !== "";

        const backgroundStyles = hasBg
            ? `
            background-image:url('${cfg.backgroundImage}');
            background-size:cover;
            background-position:center;
            `
            : `
            background:${cfg.styles.backgroundColor || "#fff"};
            `;

        modal.innerHTML = `
            <div
            class="cc-modal-content"
            style="
                display:flex;

                flex-direction:${flexDirection};
                width:${cfg.layout.popupWidth || "600px"};
                height:${cfg.layout.popupHeight || "500px"};
                margin:10% auto;
                border-radius:${cfg.styles.borderRadius || "12px"};
                border: ${cfg.styles.popupBorder || "none"};
                overflow:hidden;
                ${backgroundStyles}
            "
            >

            ${cfg.sideImage ? `
                <div
                class="cc-left"
                style="
                    width:${cfg.layout.imageColumnWidth || "40%"};
                "
                >
                <img src="${cfg.sideImage}" />
                </div>
            ` : ""}

            ${cfg.topImage ? `
                <div
                class="cc-left"
                style="
                    width:${cfg.layout.imageColumnWidth || "100%"};
                    height: auto;
                    padding-top:20px;
                    z-index:998;
                "
                >
                <img src="${cfg.topImage}" style="width:${cfg.layout.topImageWidth || "200px"}; margin: 0 auto;"/>
                </div>
            ` : ""}


            <div
                class="cc-right"
                style="
                width:${cfg.layout.formColumnWidth || "60%"};
                padding:${cfg.styles.padding || "20px"};
                margin:${cfg.styles.margin || "0"};
                "
            >

                <span
                class="cc-close"
                style="
                    color:${cfg.styles.closeColor || "#fff"};
                    z-index:999;
                "
                >
                &times;
                </span>

                <div id="cc-form-${cfg.id}"></div>


                ${cfg.footerClosePopupButton ? `
                        <button
                        aria-label="Close Popup" class="footerClosePopupBtn"
                        
                        >${cfg.footerClosePopupButtonText}
                        </button>
                    
                    ` : ""}
            </div>

            </div>
        `;

        modal.querySelector(".cc-close").onclick =
            () => this.close();
        
        modal.querySelector(".footerClosePopupBtn").onclick=
            () => this.close();


        modal.onclick = (e) => {

            if (e.target === modal) {
            this.close();
            }
        };
        
        return modal;
        }

    /*
    =========================================================
    RENDER MOBILE
    =========================================================
    */

    renderMobile() {
  
        const cfg = this.config;

        const modal = document.createElement("div");

        modal.className = "cc-modal";

        modal.style.background =
            cfg.styles.backdropColor ||
            "rgba(0,0,0,0.5)";

        const hasBg =
            cfg.mobileLayout.mobileBackgroundImage &&
            cfg.mobileLayout.mobileBackgroundImage.trim() !== "";

        const backgroundStyles = hasBg
            ? `
            background-image:url('${cfg.mobileLayout.mobileBackgroundImage}');
            background-size:cover;
            background-position:center;
            `
            : `
            background:${cfg.styles.backgroundColor || "#fff"};
            `;

        modal.innerHTML = `
            <div
            class="cc-modal-content"
            style="
                display:flex;
                flex-direction:column;
                width:${cfg.mobileLayout.popupWidth || "300px"};
                margin:10% auto;
                border-radius:${cfg.styles.borderRadius || "12px"};
                overflow:hidden;
                ${backgroundStyles}
            "
            >

            ${cfg.mobileLayout.displayImage ? `
                <div
                class="cc-left"
                style="
                    width:100%;
                    height:${cfg.mobileLayout.imageHeight || "200px"};
                "
                >
                <img
                    src="${cfg.mobileLayout.topImage || cfg.sideImage}"
                    style="
                        width:${cfg.mobileLayout.imageWidth || "100%"};
                        margin:${cfg.mobileLayout.topMargin || "0"} auto ${cfg.mobileLayout.bottomMargin || "0"} auto" !important;
                "
                />
                </div>
            ` : ""}

            <div
                class="cc-right"
                style="
                width:100%;
                padding:${cfg.styles.padding || "20px"};
                margin:
                    ${cfg.mobileLayout.topMargin || "0"}
                    0
                    ${cfg.mobileLayout.bottomMargin || "0"}
                    0;
                "
            >

                <span
                class="cc-close"
                style="
                    color:${cfg.styles.closeColor || "#fff"};
                "
                >
                &times;
                </span>

                <div id="cc-form-${cfg.id}">

                ${cfg.footerClosePopupButton ? `
                <button
                aria-label="Close Popup" class="footerClosePopupBtn"
                
                >${cfg.footerClosePopupButtonText}
                </button>
            
            ` : ""}



            </div>

            </div>
        `;

        modal.querySelector(".cc-close").onclick =
            () => this.close();

        modal.onclick = (e) => {

            if (e.target === modal) {
            this.close();
            }
        };

        return modal;
        }     
    }
  
    window.CCPopup = {

        __engine: true,

        instances: [],

        async fetchConfig(popupId) {

            const cacheKey = `ccpopup_${popupId}`;
        
            // -----------------------------------------------------
            // Check session cache
            // -----------------------------------------------------
        
            const cached = sessionStorage.getItem(cacheKey);
        
            if (cached) {
        
                try {
        
                    const cache = JSON.parse(cached);
        
                    if (cache.enabled) {
        
                        const age = Date.now() - cache.timestamp;
        
                        if (age < cache.duration) {
        
                            console.log("Loaded popup from session cache");
        
                            return cache.config;
        
                        }
        
                        console.log("Popup cache expired");
        
                    }
        
                    sessionStorage.removeItem(cacheKey);
        
                } catch (err) {
        
                    console.warn("Invalid popup cache. Clearing.", err);
        
                    sessionStorage.removeItem(cacheKey);
        
                }
        
            }
        
            // -----------------------------------------------------
            // Fetch from Supabase
            // -----------------------------------------------------
        
            console.log("Fetching popup from Supabase...");
        
            const response = await fetch(
                `https://cznzuqceeqgqytzpimvy.supabase.co/rest/v1/popup?popup_id=eq.${popupId}&select=config,domains`,
                {
                    headers: {
                        apikey: "sb_publishable_GoeP2Tly0Jl55vY6d258cQ_kf3st7XN",
                        Authorization: `Bearer ${"sb_publishable_GoeP2Tly0Jl55vY6d258cQ_kf3st7XN"}`
                    }
                }
            );
        
            if (!response.ok) {
                throw new Error(`Supabase error: ${response.status}`);
            }
        
            const rows = await response.json();

            if (!rows.length) {
                throw new Error(`Popup '${popupId}' not found.`);
            }

            const row = rows[0];

            const config = row.config;
            const domains = row.domains || [];

            const host = window.location.hostname || "localhost";

            if (!domainAllowed(host, domains)) {
                throw new Error(
                    `Popup '${popupId}' is not authorized for '${host}'.`
                );
            }
        
            // -----------------------------------------------------
            // Cache if enabled
            // -----------------------------------------------------
        
            const cacheSettings = config.cache || {};
        
            if (cacheSettings.enabled) {
        
                sessionStorage.setItem(
                    cacheKey,
                    JSON.stringify({
                        timestamp: Date.now(),
                        duration: cacheSettings.duration ?? 60000,
                        enabled: true,
                        config
                    })
                );
        
            }
        
            return config;
        
        },

        async init(config) {

            if (config.popupId) {
                config = await this.fetchConfig(config.popupId);
            }

            const instance = new CCPopupInstance(config);

            instance.init();

            this.instances.push(instance);

            return instance;
        }

        };
  
  })(window, document);