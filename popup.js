(function (window, document) {
    if (window.CCPopup) return;
  
    const CCPopup = {
      init(config) {
        this.config = {
          delay: config.delay || 5000,
          image: config.image || "",
          formConfig: config.formConfig || null,
          formScriptUrl: config.formScriptUrl || "",
          exitIntent: config.exitIntent || false,
          cookieDays: config.cookieDays || 7
        };
  
        this.injectStyles();
        this.createModal();
        this.setupEvents();
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
            background-color: rgba(0,0,0,0.5);
          }
  
          .cc-modal-content {
            background: #fff;
            margin: 10% auto;
            padding: 0;
            border-radius: 12px;
            max-width: 800px;
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
        const modal = document.createElement("div");
        modal.className = "cc-modal";
        modal.id = "cc-modal";
  
        modal.innerHTML = `
          <div class="cc-modal-content">
            <div class="cc-left">
              <img src="${this.config.image}" />
            </div>
            <div class="cc-right">
              <span class="cc-close">&times;</span>
              <div class="cc-form"></div>
            </div>
          </div>
        `;
  
        // 1. Append to DOM FIRST
        document.body.appendChild(modal);
  
        // 2. Now safely scope query INSIDE modal
        const container = modal.querySelector(".cc-form");
  
        if (!container) {
          console.error("CCPopup: form container not found");
          return;
        }
  
        // 3. Attach form config globally (required by vendor script)
        window.ss_form = this.config.formConfig;
  
        // 4. Load external form script properly
        if (this.config.formScriptUrl) {
          const script = document.createElement("script");
          script.src = this.config.formScriptUrl;
          script.async = true;
          container.appendChild(script);
        } else {
          console.warn("CCPopup: formScriptUrl not provided");
        }
  
        // 5. Close handlers
        modal.querySelector(".cc-close").onclick = () => this.close();
  
        modal.onclick = (e) => {
          if (e.target === modal) this.close();
        };
  
        this.modal = modal;
      },
  
      setupEvents() {
        window.addEventListener("load", () => {
          if (!this.getCookie("cc_closed")) {
            setTimeout(() => this.show(), this.config.delay);
          }
        });
  
        if (this.config.exitIntent) {
          document.addEventListener("mouseout", (e) => {
            if (e.clientY < 50 && !this.getCookie("cc_exit")) {
              this.show();
              this.setCookie("cc_exit", true, this.config.cookieDays);
            }
          });
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