(function (window, document) {
    if (window.CCPopup) return;
  
    const CCPopup = {
      config: null,
      modal: null,
  
      init(config) {
        this.config = {
          delay: config.delay || 3000,
          image: config.image || "",
          formConfig: config.formConfig || {},
          formScriptUrl: config.formScriptUrl || "",
          exitIntent: config.exitIntent || false,
          cookieDays: config.cookieDays || 7
        };
  
        const run = () => {
          this.injectStyles();
          this.createModal();
          this.setupEvents();
          this.loadForm(); // 🔥 moved into its own safe loader
        };
  
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", run);
        } else {
          run();
        }
      },
  
      injectStyles() {
        if (document.getElementById("cc-popup-styles")) return;
  
        const style = document.createElement("style");
        style.id = "cc-popup-styles";
  
        style.innerHTML = `
          .cc-modal {
            display: none;
            position: fixed;
            z-index: 99999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
          }
  
          .cc-modal-content {
            background: #fff;
            margin: 10% auto;
            max-width: 800px;
            border-radius: 12px;
            display: flex;
            overflow: hidden;
          }
  
          .cc-left img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
  
          .cc-right {
            padding: 20px;
            width: 100%;
          }
  
          .cc-close {
            float: right;
            font-size: 20px;
            cursor: pointer;
          }
  
          @media (max-width: 768px) {
            .cc-modal-content {
              flex-direction: column;
            }
  
            .cc-left {
              display: none;
            }
          }
        `;
  
        document.head.appendChild(style);
      },
  
      createModal() {
        if (!document.body) {
          console.error("CCPopup: document.body not ready");
          return;
        }
  
        const modal = document.createElement("div");
        modal.className = "cc-modal";
  
        modal.innerHTML = `
          <div class="cc-modal-content">
            <div class="cc-left">
              <img src="${this.config.image}" />
            </div>
            <div class="cc-right">
              <span class="cc-close">&times;</span>
              <div id="cc-form"></div>
            </div>
          </div>
        `;
  
        document.body.appendChild(modal);
  
        modal.querySelector(".cc-close").onclick = () => this.close();
  
        modal.onclick = (e) => {
          if (e.target === modal) this.close();
        };
  
        this.modal = modal;
      },
  
      // =====================================================
      // 🔥 SHARPSPRING-COMPATIBLE FORM LOADER (FIXED)
      // =====================================================
      loadForm() {
        const targetId = "cc-form";
      
        // 1. Create base object
        window.ss_form = {
          account: this.config.formConfig.account,
          formID: this.config.formConfig.formID
        };
      
        // 2. REQUIRED: tell SharpSpring where to render
        window.ss_form.target_id = targetId;
      
        // 3. Other properties
        window.ss_form.width = this.config.formConfig.width || "100%";
        window.ss_form.domain = this.config.formConfig.domain;
      
        if (this.config.formConfig.hidden) {
          window.ss_form.hidden = this.config.formConfig.hidden;
        }
      
        if (this.config.formConfig.polling) {
          window.ss_form.polling = this.config.formConfig.polling;
        }
      
        // 4. ENSURE target exists BEFORE script loads
        const target = document.getElementById(targetId);
      
        if (!target) {
          console.error("CCPopup: target container not found");
          return;
        }
      
        // 5. Load script AFTER everything is ready
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = this.config.formScriptUrl;
        script.async = true;
      
        document.head.appendChild(script);
      },
  
      setupEvents() {
        const run = () => {
          if (!this.getCookie("cc_closed")) {
            setTimeout(() => this.show(), this.config.delay);
          }
  
          if (this.config.exitIntent) {
            document.addEventListener("mouseout", (e) => {
              if (e.clientY < 50 && !this.getCookie("cc_exit")) {
                this.show();
                this.setCookie("cc_exit", true, this.config.cookieDays);
              }
            });
          }
        };
  
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", run);
        } else {
          run();
        }
      },
  
      show() {
        if (this.modal) this.modal.style.display = "block";
      },
  
      close() {
        if (this.modal) this.modal.style.display = "none";
        this.setCookie("cc_closed", true, this.config.cookieDays);
      },
  
      setCookie(name, value, days) {
        const d = new Date();
        d.setTime(d.getTime() + days * 86400000);
        document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
      },
  
      getCookie(name) {
        return document.cookie
          .split("; ")
          .find(row => row.startsWith(name + "="))
          ?.split("=")[1];
      }
    };
  
    window.CCPopup = CCPopup;
  
  })(window, document);