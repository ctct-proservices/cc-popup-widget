(function (window, document) {
    if (window.CCPopup) return;
  
    const CCPopup = {
      config: null,
      modal: null,
  
      init(config) {
        this.config = {
          delay: config.delay || 3000,
          sideImage: config.sideImage || "",
          backgroundImage: config.backgroundImage || "",
          formConfig: config.formConfig || {},
          formScriptUrl: config.formScriptUrl || "",
          exitIntent: config.exitIntent ?? true,
          styles: config.styles || {},
          layout: config.layout || {}
        };
  
        const run = () => {
          this.injectStyles();
          this.createModal();
          this.setupEvents();
          this.loadForm();
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
            z-index: 2;
          }
  
          .cc-left img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
  
          @media (max-width: 768px) {
            .cc-modal-content {
              flex-direction: column !important;
            }
  
            .cc-left {
              display: none !important;
            }
          }
        `;
  
        document.head.appendChild(style);
      },
  
      createModal() {
    try {
      const { styles = {}, layout = {} } = this.config;
  
      const modal = document.createElement("div");
      modal.className = "cc-modal";
      modal.style.background = styles.backdropColor || "rgba(0,0,0,0.5)";
      const widthType = this.config.widthType;
      const popupWidth = widthType === "fixed" ? `width: ${layout.popupWidth}` : `max-width: ${layout.popupWidth}`;
      const bgImage = this.config.backgroundImage || "";
      const sideImage = this.config.sideImage || "";
      const hasBgImage = bgImage && bgImage.trim() !== "";
      const hasSideImage = sideImage && sideImage.trim() !== "";
  
      const flexDirection =
        layout.imagePosition === "right" ? "row-reverse" : "row";
  
      const imageWidth = layout.imageWidth || "40%";
      const formWidth = layout.formWidth || "60%";
  
      // SAFE background string
      let modalBackground = `background: ${styles.backgroundColor || "#fff"};`;
  
      if (hasBgImage) {
        modalBackground = `
          background-image: ${
            styles.imageOverlay
              ? `linear-gradient(${styles.imageOverlay}, ${styles.imageOverlay}), `
              : ""
          }url('${bgImage}');
          background-size: cover;
          background-position: center;
        `;
      }
  
      const columnBackground = hasBgImage
        ? "transparent"
        : (styles.backgroundColor || "#fff");
  
      const closeColor = styles.closeColor || "#fff";
  
      modal.innerHTML = `
        <div class="cc-modal-content" style="
          display: flex;
          flex-direction: ${flexDirection};
          ${popupWidth};
          height: ${layout.popupHeight};
          margin: 10% auto;
          border-radius: ${styles.borderRadius || "12px"};
          overflow: hidden;
          background-color: ${styles.backgroundColor || "#fff"};
          ${modalBackground}
        ">
  
          ${hasSideImage ? 
              `
              <div class="cc-left" style="
                width: ${imageWidth};
                background: ${columnBackground};
              ">
                <img src="${sideImage}" />
              </div>
            `
              : ""
          }
  
          <div class="cc-right" style="
            width: ${formWidth};
            padding: ${styles.padding|| "10px 10px 10px 10px"};
            margin: ${styles.margin};
            background: ${columnBackground};
          ">
            <span class="cc-close" style="color:${closeColor}">&times;</span>
            <div id="cc-form"></div>
          </div>
  
        </div>
      `;
  
      document.body.appendChild(modal);
  
      const closeBtn = modal.querySelector(".cc-close");
      if (closeBtn) {
        closeBtn.onclick = () => this.close();
      }
  
      modal.onclick = (e) => {
        if (e.target === modal) this.close();
      };
  
      this.modal = modal;
  
    } catch (err) {
      console.error("CCPopup createModal error:", err);
    }
  },
  
      loadForm() {
        const targetId = "cc-form";
  
        window.ss_form = {
          account: this.config.formConfig.account,
          formID: this.config.formConfig.formID,
          target_id: targetId,
          width: this.config.formConfig.width || "100%",
          domain: this.config.formConfig.domain
        };
  
        if (this.config.formConfig.hidden) {
          window.ss_form.hidden = this.config.formConfig.hidden;
        }
  
        if (this.config.formConfig.polling) {
          window.ss_form.polling = this.config.formConfig.polling;
        }
  
        if (!document.getElementById(targetId)) {
          console.error("CCPopup: target container not found");
          return;
        }
  
        const script = document.createElement("script");
        script.src = this.config.formScriptUrl;
        script.async = true;
  
        document.head.appendChild(script);
      },
  
      setupEvents() {
    const hasClosed = localStorage.getItem("cc_popup_closed");
  
    if (hasClosed === "true") return;
   
    if(!this.config.exitIntent) {
      setTimeout(() => this.show(), this.config.delay);
    }
    
  
    let exitEnabled = false;
  let hasEngaged = false;
  
  setTimeout(() => {
    exitEnabled = true;
  }, 5000);
  
  document.addEventListener("mousemove", () => {
    hasEngaged = true;
  }, { once: true });
  
  if (this.config.exitIntent) {
    document.addEventListener("mouseout", (e) => {
      const isNearTop = e.clientY <= 10;
  
      if (exitEnabled && hasEngaged && isNearTop) {
        this.show();
      }
    });
  }
  },
  
          show() {
          const hasClosed = localStorage.getItem("cc_popup_closed");
          if (hasClosed === "true") return;
  
          if (this.modal) this.modal.style.display = "block";
          },
  
          close() {
          if (this.modal) this.modal.style.display = "none";
  
          // ONLY set when user explicitly closes
          localStorage.setItem("cc_popup_closed", "true");
          },
  
    };
  
    window.CCPopup = CCPopup;
  
  })(window, document);