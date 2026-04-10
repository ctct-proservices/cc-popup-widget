(function (window, document) {
  if (window.CCPopup) return; // prevent duplicate loads

  const CCPopup = {
    init(config) {
      this.config = {
        delay: config.delay || 5000,
        image: config.image || "",
        formScript: config.formScript || "",
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
          display:none; position:fixed; top:0; left:0;
          width:100%; height:100%;
          background:rgba(0,0,0,0.5); z-index:99999;
        }
        .cc-modal-content {
          background:#fff; margin:10% auto; padding:0;
          max-width:800px; border-radius:12px;
          display:flex; overflow:hidden;
        }
        .cc-left img {
          width:100%; height:100%; object-fit:cover;
        }
        .cc-right {
          padding:20px; width:100%;
        }
        .cc-close {
          float:right; cursor:pointer; font-size:20px;
        }
        @media(max-width:768px){
          .cc-modal-content{flex-direction:column;}
          .cc-left{display:none;}
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
            <div id="cc-form"></div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Inject form safely
      const container = modal.querySelector("#cc-form");
      const script = document.createElement("script");
      script.innerHTML = this.config.formScript;
      container.appendChild(script);

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
      this.modal.style.display = "block";
    },

    close() {
      this.modal.style.display = "none";
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