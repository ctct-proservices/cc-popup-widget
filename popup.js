 /*
    =========================================================
    CCPopup Reactive Engine v4.3
    =========================================================
    
    FEATURES
    --------
    ✓ Multiple popup instances
    ✓ Delay popup support
    ✓ Exit intent popup support
    ✓ Click trigger support
    ✓ Reactive mobile/desktop rendering
    ✓ Form lazy loading
    ✓ Safe rerendering at 768px
    ✓ Per-popup localStorage tracking
    ✓ Single active popup protection
    ✓ Clean mobile/desktop render architecture
    
    =========================================================
    */
    
    (function(window, document) {
    
        // Prevent engine from loading twice
        if (window.CCPopup && window.CCPopup.__engine) return;
      
        /*
        =========================================================
        GLOBAL SESSION STATE
        =========================================================
        Shared across ALL popup instances
        */
      
        const SESSION = {
          shown: false,
          activeInstance: null,
          delayActive: false,
          rendering: false
        };
      
        /*
        =========================================================
        POPUP INSTANCE CLASS
        =========================================================
        Every popup created with CCPopup.init()
        becomes its own instance of this class.
        */
      
        class CCPopupInstance {
          
          hasShownThisSession() {
  
              return (
                  sessionStorage.getItem(
                      `cc_shown_${this.config.id}`
                  ) === "true"
              );
          }
          constructor(config = {}) {
      
            this.config = {
      
              // unique popup id
              id: config.id || `cc_${Math.random().toString(36).slice(2)}`,
      
              // trigger settings
              trigger: config.trigger || {
                type: config.exitIntent ? "exit" : "delay"
              },
      
              delay: config.delay || 3000,
      
              // popup assets
              sideImage: config.sideImage || "",
              backgroundImage: config.backgroundImage || "",
      
              // form settings
              formConfig: config.formConfig || {},
              formScriptUrl: config.formScriptUrl || "",
      
              // popup behavior
              exitIntent: config.exitIntent ?? true,
              mobile: config.mobile ?? true,
      
              // style/layout settings
              styles: config.styles || {},
              layout: config.layout || {},
              mobileLayout: config.mobileLayout || {},
      
              widthType: config.widthType || "fixed",
      
              // localStorage key
              storageKey:
                config.storageKey ||
                `closed_popup_${config.id || "default"}`,
      
              ...config
            };
      
            // popup DOM reference
            this.modal = null;
      
            // internal flags
            this.exitBound = false;
            this.resizeBound = false;
      
            // track current viewport state
            this.lastIsMobile = this.isMobile();
          }
      
          /*
          =========================================================
          SESSION ACCESS
          =========================================================
          */
      
          get session() {
            return SESSION;
          }
      
          /*
          =========================================================
          INITIALIZATION
          =========================================================
          */
      
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
      
          /*
          =========================================================
          VIEWPORT DETECTION
          =========================================================
          */
      
          isMobile() {
            return window.innerWidth <= 768;
          }
      
          /*
          =========================================================
          RESPONSIVE RERENDERING
          =========================================================
          Rebuild popup if crossing 768px breakpoint
          */
      
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
      
          rerender() {
      
            // was popup open before rerender?
            const wasVisible =
              this.modal &&
              this.modal.style.display === "block";
      
            this.session.rendering = true;
      
            // destroy current DOM
            this.unmount();
      
            // rebuild correct layout
            this.mount();
      
            requestAnimationFrame(() => {
      
              // restore visibility
              if (wasVisible) {
      
                this.show();
              }
      
              this.session.rendering = false;
            });
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
      
            style.innerHTML = `
              .cc-modal {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 99999;
              }
      
              .cc-modal-content {
                position: relative;
              }
      
              .cc-close {
                position: absolute;
                top: 10px;
                right: 15px;
                font-size: 30px;
                cursor: pointer;
                z-index: 10;
                line-height: 1;
              }
      
              .cc-left img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display:block;
              }
            `;
      
            document.head.appendChild(style);
          }
      
          /*
          =========================================================
          MOUNT / UNMOUNT
          =========================================================
          */
      
          mount() {
      
            this.modal =
              this.isMobile()
                ? this.renderMobile()
                : this.renderDesktop();
      
            document.body.appendChild(this.modal);
          }
      
          unmount() {
      
            if (this.modal) {
      
              this.modal.remove();
      
              this.modal = null;
            }
          }
      
          /*
          =========================================================
          DESKTOP RENDER
          =========================================================
          */
      
          renderDesktop() {
      
            const cfg = this.config;
      
            const modal = document.createElement("div");
      
            modal.className = "cc-modal";
      
            modal.style.background =
              cfg.styles.backdropColor ||
              "rgba(0,0,0,0.5)";
      
            const flexDirection =
              cfg.layout.imagePosition === "right"
                ? "row-reverse"
                : "row";
      
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
                  overflow:hidden;
                  ${backgroundStyles}
                "
              >
      
                ${cfg.sideImage ? `
                  <div
                    class="cc-left"
                    style="
                      width:${cfg.layout.imageWidth || "40%"};
                    "
                  >
                    <img src="${cfg.sideImage}" />
                  </div>
                ` : ""}
      
                <div
                  class="cc-right"
                  style="
                    width:${cfg.layout.formWidth || "60%"};
                    padding:${cfg.styles.padding || "20px"};
                    margin:${cfg.styles.margin || "0"};
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
      
                  <div id="cc-form-${cfg.id}"></div>
      
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
      
          /*
          =========================================================
          MOBILE RENDER
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
                  width:300px;
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
      
                  <div id="cc-form-${cfg.id}"></div>
      
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
      
          /*
          =========================================================
          FORM LOADING
          =========================================================
          */
      
          loadForm() {
      
            const cfg = this.config;
      
            const formID =
              this.isMobile() &&
              cfg.formConfig.mobileFormID
                ? cfg.formConfig.mobileFormID
                : cfg.formConfig.formID;
      
            const container =
              document.getElementById(`cc-form-${cfg.id}`);
      
            if (!container) {
      
              console.error("Form container missing");
      
              return;
            }
      
            // clear previous form
            container.innerHTML = "";
      
            // vendor config
            window.ss_form = {
              account: cfg.formConfig.account,
              formID,
              target_id: `cc-form-${cfg.id}`,
              width: cfg.formConfig.width || "100%",
              domain: cfg.formConfig.domain,
              hidden: cfg.formConfig.hidden || undefined
            };
      
            // inject fresh script
            const script = document.createElement("script");
      
            script.src =
              cfg.formScriptUrl +
              "&instance=" +
              Date.now();
      
            script.async = true;
      
            container.appendChild(script);
          }
      
          /*
          =========================================================
          EVENT BINDING
          =========================================================
          */
      
          bindEvents() {
      
            // already closed?
            if (
              localStorage.getItem(this.config.storageKey) === "true"
            ) {
              return;
            }
      
            /*
            ---------------------------------------------------------
            DELAY TRIGGER
            ---------------------------------------------------------
            */
      
            if (!this.config.exitIntent) {
      
              setTimeout(() => {
      
                this.session.delayActive = true;
      
                this.show();
      
              }, this.config.delay);
            }
      
            /*
            ---------------------------------------------------------
            CLICK TRIGGER
            ---------------------------------------------------------
            */
      
            if (
              this.config.trigger.type === "click" &&
              this.config.trigger.selector
            ) {
      
              document.addEventListener("click", (e) => {
      
                if (
                  e.target.closest(
                    this.config.trigger.selector
                  )
                ) {
                  this.show();
                }
              });
            }
      
            /*
            ---------------------------------------------------------
            EXIT INTENT
            ---------------------------------------------------------
            */
      
            if (
              this.config.exitIntent &&
              !this.exitBound
            ) {
      
              this.exitBound = true;
      
              let engaged = false;
      
              let enabled = false;
      
              // require engagement first
              document.addEventListener(
                "mousemove",
                () => {
                  engaged = true;
                },
                { once: true }
              );
      
              // wait before enabling
              setTimeout(() => {
                enabled = true;
              }, 5000);
      
              document.addEventListener("mouseout", (e) => {
      
               if (this.hasShownThisSession()) return;
  
                // internal movement
                if (e.relatedTarget || e.toElement) return;
      
                // only near top
                if (e.clientY > 10) return;
      
                // prevent during rerender
                if (this.session.rendering) return;
      
                // another popup already shown
                if (this.session.shown) return;
      
                // require engagement
                if (!enabled || !engaged) return;
      
                this.show();
              });
            }
          }
      
          /*
          =========================================================
          SHOW POPUP
          =========================================================
          */
      
          show() {
  
              if (this.hasShownThisSession()) return;
  
              if (!this.modal) return;
  
              if (
              this.session.activeInstance &&
              this.session.activeInstance !== this
              ) {
              return;
              }
  
              this.session.activeInstance = this;
  
              this.session.shown = true;
  
              this.modal.style.display = "block";
  
              this.loadForm();
          }
      
          /*
          =========================================================
          CLOSE POPUP
          =========================================================
          */
      
          close() {
  
              if (this.modal) {
              this.modal.style.display = "none";
              }
  
              if (this.session.activeInstance === this) {
  
              this.session.activeInstance = null;
  
              this.session.delayActive = false;
  
              sessionStorage.setItem(
              `cc_shown_${this.config.id}`,
              "true"
              );
              
               // allow other popup types
              this.session.shown = false;
  
              }
          }
        }
      
        /*
        =========================================================
        PUBLIC API
        =========================================================
        */
      
        window.CCPopup = {
      
          __engine: true,
      
          __session: SESSION,
      
          instances: [],
      
          init(config) {
      
            const instance =
              new CCPopupInstance(config);
      
            instance.init();
      
            this.instances.push(instance);
      
            return instance;
          },
      
          create(config) {
      
            return this.init(config);
          }
        };
      
      })(window, document);