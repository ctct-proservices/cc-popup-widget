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
        
        this.formReady = false;
        this.animationStarted = false;
        this.animationFallback = null;

        this.isAnimating = false;
        this.animationState = "idle";
    
        this.exitBound = false;
        this.resizeBound = false;
    
        this.lastIsMobile = this.isMobile?.() ?? false;
        
        this.consentGranted = false;
    
        this.handleFormMessage = this.handleFormMessage.bind(this);

        if (config.type === "sticky") {
            this.displayState = "collapsed";
        } else {
            this.displayState = "hidden";
        }
    
        /*
        =========================================================
        RAW CONFIG BUILD FROM SUPABASE
        =========================================================
        */
    
        this.config = {
    
            id: config.id || `cc_${Math.random().toString(36).slice(2)}`,
    
            mobile: config.mobile ?? true,

            type: config.type ?? "modal",
    
            crossTabSessionLock: config.crossTabSessionLock ?? true,
    
            widthType: config.widthType || "fixed",

            sticky: config.sticky || {},
    
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
            FORM SUCCESS BUTTON
            =========================================================
            */

            successButtonText: config.successButtonText ?? "Close",

            successButtonStyles: config.successButtonStyles || {},

            /*
            =========================================================
            CONSENT
            =========================================================
            */

            consent: {
                provider: config.consent?.provider || "",
                required: config.consent?.required ?? false,
                requiredGroups: config.consent?.requiredGroups || []
            },
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
            subDomain: config.form?.subDomain || config.formConfig?.subDomain || "",
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

    waitForConsent(callback) {

            console.log("waitForConsent initialized", this.config.id);


            // -------------------------------------------------
            // Listen for consent event FIRST
            // -------------------------------------------------

            window.addEventListener(
                "ccConsentGranted",
                () => {

                    console.log("CCPopup: Consent received.");

                    if (typeof callback === "function") {
                        callback();
                    }

                },
                { once: true }
            );

            // -------------------------------------------------
            // Local Development
            // -------------------------------------------------

            if (
                location.protocol === "file:" ||
                location.hostname === "localhost" ||
                location.hostname === "127.0.0.1"
            ) {

                console.log("CCPopup: Debug consent mode enabled.");
                    window.ccRemoveOneTrustConsent = () => {

                document.cookie =
                    "OptanonConsent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";

                console.log(
                    "CCPopup: Mock OneTrust cookie removed"
                );

            };
            window.ccMockOneTrustConsent = () => {

                window.ccMockConsentEnabled = true;

                const value =
                    "isGpcEnabled=0" +
                    "&datestamp=Fri+Jul+24+2026+03%3A34%3A00+GMT-0700" +
                    "&version=202605.1.0" +
                    "&browserGpcFlag=0" +
                    "&isIABGlobal=false" +
                    "&hosts=" +
                    "&landingPath=NotLandingPage" +
                    "&groups=1%3A1%2C2%3A1%2C3%3A1%2C4%3A1%2C8%3A1";


                    document.cookie =
                    `OptanonConsent=${value}; path=/; max-age=31536000`;


                    console.log(
                        "CCPopup: Mock OneTrust cookie created"
                    );


                    window.dispatchEvent(
                        new Event("OneTrustGroupsUpdated")
                    );

                };

            window.ccSetMockConsent = (groups) => {

                window.ccMockConsentEnabled = true;

                const value =
                    `isGpcEnabled=0&groups=${groups}`;


                document.cookie =
                    `OptanonConsent=${value}; path=/; max-age=31536000`;


                console.log(
                    "CCPopup: Mock consent set:",
                    value
                );


                window.dispatchEvent(
                    new Event("OneTrustGroupsUpdated")
                );

                };

            }


            // -------------------------------------------------
            // Existing Consent Check
            // -------------------------------------------------

            if (this.hasRequiredConsent()) {

                console.log("CCPopup: Existing consent detected.");

                window.dispatchEvent(
                    new Event("ccConsentGranted")
                );

            }


            // -------------------------------------------------
            // OneTrust Updates
            // -------------------------------------------------

            window.addEventListener(
                "OneTrustGroupsUpdated",
                () => {

                    console.log("CCPopup: OneTrust update detected.");

                    const consent = this.hasRequiredConsent();

                    console.log(
                        "CCPopup: hasRequiredConsent returned:",
                        consent
                    );

                    if (consent) {

                        window.dispatchEvent(
                            new Event("ccConsentGranted")
                        );

                    }

                }
            );

    }

    hasRequiredConsent() {

        // -------------------------------------------------
        // Debug override
        // -------------------------------------------------

        if (sessionStorage.getItem("cc_debug_consent") === "true") {

            console.log(
                "CCPopup: Debug consent override enabled."
            );

            return true;
        }


        // -------------------------------------------------
        // Local testing protection
        // -------------------------------------------------

        const isLocal =
            location.protocol === "file:" ||
            location.hostname === "localhost" ||
            location.hostname === "127.0.0.1";


        if (isLocal && !window.ccMockConsentEnabled) {

            const hasMockConsentCookie =
                document.cookie
                    .split("; ")
                    .some(c =>
                        c.startsWith("OptanonConsent=")
                    );

            if (!hasMockConsentCookie) {

                console.log(
                    "CCPopup: Local environment, waiting for mock consent."
                );

                return false;

            }

            }


        // -------------------------------------------------
        // Required groups from config
        // -------------------------------------------------

        const required =
            this.config.consent?.requiredGroups || [];


        console.log(
            "CCPopup: Required groups:",
            required
        );


        // -------------------------------------------------
        // Find OneTrust cookie
        // -------------------------------------------------

        const cookie =
            document.cookie
                .split("; ")
                .find(c =>
                    c.startsWith("OptanonConsent=")
                );


        if (!cookie) {

            console.log(
                "CCPopup: OptanonConsent cookie not found."
            );

            return false;
        }


        // -------------------------------------------------
        // Decode cookie value
        // -------------------------------------------------

        let value =
            cookie.substring(
                cookie.indexOf("=") + 1
            );


        value =
            decodeURIComponent(value);


        console.log(
            "CCPopup: Decoded consent cookie:",
            value
        );


        // -------------------------------------------------
        // Extract groups
        // -------------------------------------------------

        const match =
            value.match(/groups=([^&]+)/);


        if (!match) {

            console.log(
                "CCPopup: No groups found in consent cookie."
            );

            return false;
        }


        const groups =
            decodeURIComponent(match[1]);


        console.log(
            "CCPopup: Consent groups string:",
            groups
        );


        // -------------------------------------------------
        // Convert groups into object
        // Example:
        // {
        //   "1": true,
        //   "2": true,
        //   "3": false
        // }
        // -------------------------------------------------

        const accepted = {};


        groups
            .split(",")
            .forEach(group => {

                console.log(
                    "CCPopup: Parsing group:",
                    group
                );


                const [
                    id,
                    enabled
                ] = group.split(":");


                accepted[id] =
                    enabled === "1";

            });


        console.log(
            "CCPopup: Parsed consent groups:",
            accepted
        );


        // -------------------------------------------------
        // Validate required groups
        // -------------------------------------------------

        const hasConsent =
            required.every(
                id => accepted[id]
            );


        console.log(
            "CCPopup: hasRequiredConsent result:",
            hasConsent
        );


        return hasConsent;

        }

        handleFormMessage(e) {



            const expectedOrigin =
        `${this.config.form?.subDomain}`.toLowerCase();

    const expectedFormName =
        this.config.form?.formName;


    // -------------------------------------------------
    // Validate origin
    // -------------------------------------------------

    if (e.origin.toLowerCase() !== expectedOrigin) {

        console.log(
            "CCPopup: Message rejected - origin mismatch",
            {
                expected: expectedOrigin,
                received: e.origin
            }
        );

        return;
    }


console.log(
    "CCPopup: Origin validated"
);


// -------------------------------------------------
// Validate message data
// -------------------------------------------------

if (!e.data) {

    console.log(
        "CCPopup: Message rejected - no data"
    );

    return;
}


// -------------------------------------------------
// Only process form submissions
// -------------------------------------------------

if (e.data.action !== "formSubmitted") {

    console.log(
        "CCPopup: Ignoring message - action:",
        e.data.action
    );

    return;
}


console.log(
    "CCPopup: formSubmitted event detected"
);


// -------------------------------------------------
// Validate form name
// -------------------------------------------------

console.log(
    "CCPopup: Expected form name:",
    expectedFormName
);

console.log(
    "CCPopup: Received form name:",
    e.data.formName
);


if (
    expectedFormName &&
    e.data.formName !== expectedFormName
) {

    console.log(
        "CCPopup: Form name mismatch"
    );

    return;
}


console.log(
    "CCPopup: Form name validated"
);


// -------------------------------------------------
// Form submission received
// -------------------------------------------------

console.log(
    "CCPopup: Form submitted"
);

console.log(
    "Form name:",
    e.data.formName
);

console.log(
    "Form ID:",
    e.data.formID
);

console.log(
    "Form data:",
    e.data.data
);


// -------------------------------------------------
// Handle submission
// -------------------------------------------------

console.log(
    "CCPopup: Calling handleFormSubmission()"
);

this.handleFormSubmission(e.data);

}

    bindFormSubmitListener() {

        console.log(
            "CCPopup: Binding form submit listener"
        );
    
        window.addEventListener(
            "message",
            this.handleFormMessage
        );
    
    }

    unbindFormSubmitListener() {

        window.removeEventListener(
            "message",
            this.handleFormMessage
        );
    
    }



    getFormSubmittedKey() {
        return `cc_popup_form_submitted_${this.config.id}`;
    }

    hasFormBeenSubmitted() {

        return localStorage.getItem(
            this.getFormSubmittedKey()
        ) === "true";

    }

    handleFormSubmission(data) {

        console.log(
        "CCPopup: Processing form submission",
        data
        );

        // Remember that this popup's form was submitted
        localStorage.setItem(
            this.getFormSubmittedKey(),
            "true"
        );

        console.log(
            "CCPopup: Form submission saved"
        );

        const styles =
            this.config.successButtonStyles || {};
            console.log(
            "CCPopup: Success styles:",
            styles
        );

        // -------------------------------------------------
        // Resize iframe
        // -------------------------------------------------

        if (styles.resizeIframe) {

            const iframe =
            this.modal?.querySelector(
                `#cc-form-${this.config.id} > iframe`
            );

        if (iframe) {

            // Resize iframe if configured
            if (styles.resizeIframe && styles.resizedIframeHeight) {

                iframe.style.height =
                    styles.resizedIframeHeight;

                console.log(
                    "CCPopup: Success iframe height set to",
                    styles.resizedIframeHeight
                );
            }

            // Center iframe within form container
            const formContainer =
                this.modal?.querySelector(
                    `#cc-form-${this.config.id}`
                );

            if (formContainer) {

                formContainer.style.display = "flex";
                formContainer.style.justifyContent = "center";
                formContainer.style.alignItems = "center";
                formContainer.style.width = styles.resizeFormWidth || "100%";
                formContainer.style.height = "100%";

                iframe.style.display = "block";
                iframe.style.margin = "0 auto";
            }

        }
        }


// -------------------------------------------------
// Hide logo
// -------------------------------------------------

if (styles.hideLogo) {

    const logo =
        this.modal?.querySelector(
            ".cc-popup-logo"
        );

    if (logo) {

        logo.style.display = "none";

        console.log(
            "CCPopup: Success logo hidden."
        );

    } else {

        console.warn(
            "CCPopup: Logo element not found."
        );

    }

}


// -------------------------------------------------
// Resize form width
// -------------------------------------------------

if (styles.resizeForm) {
console.log("test");
    const formContainer =
        this.modal?.querySelector(
            `#cc-form-${this.config.id}`
        );

    if (formContainer) {

        const width =
            styles.resizeFormWidth || "100%";

        formContainer.style.width =
            width;

        console.log(
            "CCPopup: Resized form container",
            {
                width: width
            }
        );

    } else {

        console.warn(
            "CCPopup: Form container not found."
        );

    }

}



        // -------------------------------------------------
        // Find success close button
        // -------------------------------------------------

        const button =
            this.modal?.querySelector(
                ".cc-popup-success-close"
            );
        const closePopupFooterBtn = 
            this.modal?.querySelector(
                ".footerClosePopupBtn"
            );
        const buttonContainer = 
            this.modal?.querySelector(
                ".cc-popup-success"
            );

        const ccRight = 
            this.modal?.querySelector(
                ".cc-right"
            );
        
        if (!closePopupFooterBtn) {

            console.warn(
                "CCPopup: Closes popup footer button not found."
            );

            return;
        }

        if (!button) {

            console.warn(
                "CCPopup: Success close button not found."
            );

            return;
        }


        // -------------------------------------------------
        // Apply button CSS styles
        // -------------------------------------------------

        Object.entries(styles).forEach(
            ([property, value]) => {

                // Don't try to apply configuration
                // properties as CSS properties.

                if (
                    property === "hideLogo" ||
                    property === "resizeIframe" ||
                    property === "resizedIframeHeight"
                ) {
                    return;
                }

                button.style.setProperty(
                    property,
                    value
                );

            }
        );
        
        // -------------------------------------------------
        // SHOW BUTTON CONTAINER
        // -------------------------------------------------

        buttonContainer.style.display = "flex";

        // -------------------------------------------------
        // Button text
        // -------------------------------------------------

        button.textContent =
            this.config.successButtonText || "Close";

        //--------------------------------------------------
        // HIDE FOOTER CLOSE BUTTON
        // ------------------------------------------------

        closePopupFooterBtn.style.display = "none";

        ccRight.style.minHeight = "0";
        ccRight.style.height = "auto";
        
        document.querySelector(`#cc-form-${this.config.id}`).style.minHeight = "0";
        document.querySelector(`#cc-form-${this.config.id}`).style.height = "auto";


        // -------------------------------------------------
        // Show button
        // -------------------------------------------------

        button.style.display =
            styles.display || "block";


        // -------------------------------------------------
        // Close popup
        // -------------------------------------------------

        button.onclick = () => {

            console.log(
                "CCPopup: Success close button clicked."
            );

            this.close();

        };


        console.log(
            "CCPopup: Success state displayed."
        );

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

        console.log("CCPopup: init() called");
    
        const boot = () => {
    
            console.log("CCPopup: BOOT");
    
            if (!this.config.mobile && this.isMobile()) {
    
                console.log(
                    "CCPopup: Skipping mobile device"
                );
    
                return;
            }
    
            this.injectStyles?.();
            this.injectAnimationStyles?.();
    
            console.log(
                "CCPopup: Consent required:",
                this.config.consent?.required
            );
            
            // FORM SUBMISSION CHECK

            if (
                this.config.type === "sticky" &&
                this.hasFormBeenSubmitted()
            ) {

                console.log(
                    "CCPopup: Sticky form already submitted - skipping mount."
                );

                return;
            }


            // CONSENT CHECK

            if (this.config.consent?.required) {
    
                console.log(
                    "CCPopup: Calling waitForConsent()"
                );
    
                this.waitForConsent(() => {

                    console.log(
                        "CCPopup: Consent granted."
                    );

                    const delay =
                        this.config.trigger?.delayAfterConsent ?? 5000;

                    console.log(
                        `CCPopup: Waiting ${delay}ms before mounting popup.`
                    );

                    setTimeout(() => {

                        if (
                            this.config.type === "sticky" &&
                            this.hasFormBeenSubmitted()
                        ) {

                            console.log(
                                "CCPopup: Sticky form already submitted - skipping mount."
                            );

                            return;
                        }

                        console.log(
                            "CCPopup: Consent delay complete - mounting popup."
                        );

                        this.mount();
                        this.bindEvents();

                    }, delay);

                    });
    
            } else {
    
                this.mount();
                this.bindEvents();
        
            }
    
                this.bindResponsiveWatcher?.();
    
        };
    
    
        if (document.readyState === "loading") {
    
            console.log(
                "CCPopup: Waiting for DOMContentLoaded"
            );
    
            document.addEventListener(
                "DOMContentLoaded",
                boot
            );
    
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


            switch (this.config.type) {

                case "sticky":
                    this.modal = this.renderSticky();
                    break;

                case "modal":
                default:
                    this.modal = this.isMobile()
                        ? this.renderMobile()
                        : this.renderDesktop();
                    break;
            }

            document.body.appendChild(this.modal);

            this.loadForm();

        }

        unmount() {

            this.unbindFormSubmitListener();

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

        if (this.hasFormBeenSubmitted()) {

            console.log(
                "CCPopup: Form already submitted - sticky popup will not appear."
            );

            return;
        }

        this.session.activeInstance = this;
        this.session.shown = true;

        const content = this.getContentEl();
        if (!content) return;

        this.modal.style.display = "block";
        this.onShow?.();

        // Reset animation state
        this.formReady = false;
        this.animationStarted = false;

        const enterTransform =
            this.getAnimationTransform?.(
                this.config.animation?.enter
            );

        // -------------------------------------------------
        // Prepare initial animation state
        // -------------------------------------------------

        content.style.transition = "none";

        if (enterTransform) {
            content.style.transform = enterTransform;
        }

        content.style.opacity = "0";

        // -------------------------------------------------
        // Fallback if form never reports its height
        // -------------------------------------------------

        this.animationFallback = setTimeout(() => {

            if (!this.animationStarted) {

                console.warn(
                    "CCPopup: Form resize not received. Starting animation fallback."
                );

                this.startPopupAnimation();

            }

        }, 2000);

        }

        async loadForm(options = {}) {

            const force = options.force || false;

            const isMobile = this.isMobile();

            if (
                !force &&
                this.formLoaded &&
                this.loadedFormMode ===
                    (isMobile ? "mobile" : "desktop")
            ) {
                return;
            }

            this.loadedFormMode =
                isMobile ? "mobile" : "desktop";

            this.formLoaded = true;

            const cfg = this.config;

            const container =
                document.getElementById(
                    `cc-form-${cfg.id}`
                );

            if (!container) {
                return;
            }

            container.innerHTML = "";

            const form =
                cfg.form || cfg.formConfig;

            if (!form) {
                return;
            }

            window.ss_form = {

                account: form.account,

                formID:
                    isMobile && form.mobileFormID
                        ? form.mobileFormID
                        : form.formID,

                target_id:
                    `cc-form-${cfg.id}`,

                width:
                    form.width || "100%",

                domain:
                    form.domain,

                hidden:
                    form.hidden || undefined
            };

            const script =
                document.createElement("script");

            script.src =
                form.formScriptUrl +
                "&t=" +
                Date.now();

            script.async = true;

            container.appendChild(script);

            // Wait for iframe to appear
            await new Promise(resolve => {

                const checkIframe = () => {

                    const iframe =
                        container.querySelector("iframe");

                    if (iframe) {

                        console.log(
                            "CCPopup: Sticky form iframe ready"
                        );

                        resolve();

                    } else {

                        requestAnimationFrame(
                            checkIframe
                        );

                    }

                };

                checkIframe();

            });
            }
    /*
    ==========================
    ANIMATION
    ==========================
    */

    startPopupAnimation() {

        if (this.animationStarted) {
            return;
        }

        this.animationStarted = true;

        if (this.animationFallback) {

            clearTimeout(this.animationFallback);

            this.animationFallback = null;

        }

        const content = this.getContentEl();

        if (!content) {
            return;
        }

        const duration =
            this.config.animation?.duration || 400;

        const easing =
            this.config.animation?.easing || "ease";

        requestAnimationFrame(() => {

            requestAnimationFrame(() => {

                content.style.transition =
                    `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;

                content.style.transform =
                    "translate(0,0) scale(1)";

                content.style.opacity = "1";

            });

        });

        }

    /*
    =========================================================
    CLOSE
    =========================================================
    */

    hideSubmittedSticky() {

        if (this.modal) {
            this.modal.style.display = "none";
        }

        console.log(
            "CCPopup: Submitted sticky form - hiding sticky footer."
        );

    }
    
    close() {

        if (
            this.config.type === "sticky" &&
            this.hasFormBeenSubmitted()
            ) {

                this.hideSubmittedSticky();
                return;
        }

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

            console.log("CCPopup: bindEvents() called");

            this.bindFormSubmitListener();

            console.log("CCPopup: form listener bound");

            const trigger = this.config.trigger;


            // -------------------------------------------------
            // DELAY TRIGGER
            // -------------------------------------------------

            if (trigger.type === "delay") {

                setTimeout(() => {

                    if (
                        !this.config.consent?.required ||
                        this.hasRequiredConsent()
                    ) {

                        this.show();

                    } else {

                        console.log(
                            "CCPopup: Delay trigger blocked - waiting for consent."
                        );

                        this.waitForConsent(
                            () => this.show()
                        );

                    }

                }, trigger.delay);

            }


            // -------------------------------------------------
            // COOKIE CONSENT TRIGGER
            // -------------------------------------------------

            if (trigger.type === "cookieConsent") {

                this.waitForConsent(() => {

                    console.log(
                        "CCPopup: Consent granted. Starting 5 second delay."
                    );
                

                    if (this.hasFormBeenSubmitted()) {

                        console.log(
                            "CCPopup: Form already submitted. Sticky footer will not show."
                        );

                        return;
                    }

                    console.log(
                        "CCPopup: Consent delay complete. Showing sticky footer."
                    );

                    this.show();

                });

            }


            // -------------------------------------------------
            // CLICK / ELEMENT TRIGGER
            // -------------------------------------------------

            if (
                trigger.type === "click" ||
                trigger.type === "element"
            ) {

                document.addEventListener(
                    "click",
                    (e) => {

                        const target =
                            e.target.closest(
                                trigger.selector
                            );

                        if (!target) {
                            return;
                        }


                        console.log(
                            "CCPopup: Element trigger clicked:",
                            trigger.selector
                        );


                        // -----------------------------------------
                        // No consent required
                        // -----------------------------------------

                        if (!this.config.consent?.required) {

                            this.show();

                            return;
                        }


                        // -----------------------------------------
                        // Consent already exists
                        // -----------------------------------------

                        if (this.hasRequiredConsent()) {

                            console.log(
                                "CCPopup: Existing consent detected."
                            );

                            this.show();

                            return;
                        }


                        // -----------------------------------------
                        // Wait for consent
                        // -----------------------------------------

                        console.log(
                            "CCPopup: Click blocked - waiting for consent."
                        );

                        this.waitForConsent(
                            () => this.show()
                        );

                    }
                );

            }


            // -------------------------------------------------
            // EXIT INTENT TRIGGER
            // -------------------------------------------------

            if (trigger.type === "exit") {

                let engaged = false;
                let enabled = false;

                document.addEventListener(
                    "mousemove",
                    () => engaged = true,
                    { once: true }
                );

                setTimeout(
                    () => enabled = true,
                    trigger.exitIntentDelay
                );

                document.addEventListener(
                    "mouseout",
                    (e) => {

                        if (this.session.shown) return;
                        if (!engaged || !enabled) return;
                        if (e.clientY > 10) return;


                        // -----------------------------------------
                        // No consent required
                        // -----------------------------------------

                        if (!this.config.consent?.required) {

                            this.show();

                            return;
                        }


                        // -----------------------------------------
                        // Existing consent
                        // -----------------------------------------

                        if (this.hasRequiredConsent()) {

                            this.show();

                            return;
                        }


                        console.log(
                            "CCPopup: Exit trigger blocked - consent not granted."
                        );

                    }
                );

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
    ==========================================================
    STICKY EXPAND/COLLAPSE
    ==========================================================
    */

        expand() {

            if (this.displayState === "expanded") return;

            this.displayState = "expanded";

            const collapsed = this.modal.querySelector(".cc-sticky-collapsed");
            const expanded = this.modal.querySelector(".cc-sticky-expanded");

            collapsed.classList.add("cc-hidden");
            expanded.classList.remove("cc-hidden");
            expanded.classList.add("cc-visible");

        }

        collapse() {

            if (
                this.config.type === "sticky" &&
                this.hasFormBeenSubmitted()
                ) {

                    this.hideSubmittedSticky();
                    return;
            }

            if (this.displayState === "collapsed") return;

            this.displayState = "collapsed";

            const collapsed = this.modal.querySelector(".cc-sticky-collapsed");
            const expanded = this.modal.querySelector(".cc-sticky-expanded");

            expanded.classList.remove("cc-visible");
            expanded.classList.add("cc-hidden");

            collapsed.classList.remove("cc-hidden");
            collapsed.classList.add("cc-visible");

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


            /* -------------------------------------------------
            // POPUP POSITIONING
            ------------------------------------------------- */

            let position = `
                position:absolute;
                top:50%;
                left:50%;
                transform:translate(-50%, -50%);
            `;


            if (this.config.layout.position === "center") {

                position = `
                    position:absolute;
                    top:50%;
                    left:50%;
                    transform:translate(-50%, -50%);
                `;

            }


            if (this.config.layout.position === "right") {

                position = `
                    position:absolute;
                    top:50%;
                    right:0;
                    transform:translateY(-50%);
                `;

            }


            if (this.config.layout.position === "left") {

                position = `
                    position:absolute;
                    top:50%;
                    left:0;
                    transform:translateY(-50%);
                `;

            }


            /* -------------------------------------------------
            // BOTTOM LEFT
             ------------------------------------------------- */

            

            if (this.config.layout.position === "bottom-left") {

                position = `
                    position:fixed;
                    left:0px;
                    bottom:0px;
                    top:auto;
                    right:auto;
                    transform:none;
                `;

            }


            /* -------------------------------------------------
            // BOTTOM RIGHT
             ------------------------------------------------- */

            if (this.config.layout.position === "bottom-right") {

                position = `
                position:fixed;
                    right:0px;
                    bottom:0px;
                    top:auto;
                    left:auto;
                    transform:none;
                `;

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

                    transform:translateX(100%);
                    opacity:0;

                }


                .cc-slide-right-enter-active {

                    transform:translateX(0);
                    opacity:1;
                    transition:all 400ms ease;

                }


                .cc-slide-right-exit {

                    transform:translateX(0);
                    opacity:1;

                }


                .cc-slide-right-exit-active {

                    transform:translateX(100%);
                    opacity:0;
                    transition:all 400ms ease;

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

                    opacity:1;
                    transform:translate(0,0) scale(1);

                }


                /* -------------------------------------------------
                // MODAL
                 ------------------------------------------------- */

                .cc-modal {

                    display:none;
                    position:fixed;
                    inset:0;
                    z-index:99999;

                }


                /* -------------------------------------------------
                // MODAL CONTENT
                 ------------------------------------------------- */

                .cc-modal-content {

                    position:relative;
                    will-change:transform, opacity;
                }


                /* -------------------------------------------------
                // POPUP POSITION
                 ------------------------------------------------- */

                .cc-popup-position {
                    ${position}
                }


                /* -------------------------------------------------
                // CLOSE BUTTON
                 ------------------------------------------------- */

                .cc-close {

                    position:absolute;
                    right:15px;
                    font-size:30px;
                    cursor:pointer;
                    z-index:10;

                }


                /* -------------------------------------------------
                // IMAGES
                 ------------------------------------------------- */

                .cc-left img {

                    width:100%;
                    height:100%;
                    object-fit:cover;
                    display:block;

                }


                /* -------------------------------------------------
                // FOOTER CLOSE BUTTON
                 ------------------------------------------------- */

                .footerClosePopupBtn {

                    width:100%;
                    height:30px;
                    background:transparent;
                    border:none;
                    margin-top:-25px;
                    margin-bottom:10px;
                    font-size:16px;
                    color:${this.config.styles.footerClosePopupButtonTextColor};

                }


                .footerClosePopupBtn:hover {

                    width:100%;
                    color:${this.config.styles.footerClosePopupButtonTextColorHover};

                }


                /* -------------------------------------------------
                // STICKY
                 ------------------------------------------------- */

                .cc-sticky {

                    position:fixed;
                    bottom:0;
                    left:0;
                    right:0;

                    display:flex;
                    justify-content:center;

                    z-index:9999;

                }


                .cc-sticky-expanded {

                    position:relative;

                }


                .cc-sticky-form {

                    width:${this.config.sticky.formWidth};

                }


                .cc-sticky-form-wrapper {

                    width:100%;
                    display:flex;
                    justify-content:center;

                }


                .cc-sticky-expanded-show {

                    display:block;
                    height:${this.config.sticky.expandedHeight};

                }


                .cc-hidden {

                    display:none !important;

                }


                .cc-visible {

                    display:block;

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
        class="cc-popup-position"
        >
            <div
            class="cc-modal-content"
            style="
                display:flex;
                flex-direction:${flexDirection};
                width:${cfg.layout.popupWidth || "600px"};
                height:${cfg.layout.popupHeight || "500px"};
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
                <img src="${cfg.topImage}" class="cc-popup-logo" style="width:${cfg.layout.topImageWidth || "200px"}; margin: 0 auto;"/>
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
                    font-size: ${cfg.styles.closeHeight || "20px"};
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

                <div
                        class="cc-popup-success"
                        style="
                            display: none;
                            width: 100%;
                            min-height:100px;
                            justify-content: center;
                            align-items: center;
                            flex-direction: column;
                            box-sizing: border-box;
                        "
                    >
                        <button
                            type="button"
                            class="cc-popup-success-close"
                        >
                            Close
                        </button>
                </div>
            </div>

            

            </div>
            </div>
        `;

        modal.querySelector(".cc-close").onclick =
            () => this.close();
        
            if (cfg.footerClosePopupButton) {

            const footerButton =
                modal.querySelector(".footerClosePopupBtn");

            if (footerButton) {

                footerButton.addEventListener(
                    "click",
                    () => this.close()
                );

            }

            }


        modal.onclick = (e) => {

            if (e.target === modal) {
            this.close();
            }
        };
        
        return modal;
        }

    /*
    =========================================================
    RENDER STICKY
    =========================================================
    */

    renderSticky() {

        const cfg = this.config;
        const sticky = cfg.sticky || {};

        const modal = document.createElement("div");
        const modalCollapsed = document.querySelector(".cc-sticky-content");

        modal.className = "cc-sticky";

        modal.innerHTML = `
            <div
                class="cc-sticky-content cc-sticky-collapsed cc-visible"
                style="
                    width:${sticky.width || "800px"};
                    height:${sticky.collapsedHeight || "70px"};
                    overflow:hidden;
                    background:${sticky.background || "#fff"};
                    border:${sticky.borderWidth || "1px"} ${sticky.borderStyle || "solid"} ${sticky.borderColor || "#ccc"};
                    border-radius:${sticky.borderRadius || "10px"};
                    display: flex;
                    align-items: center;
                "
            >
                <div 
                    class="cc-sticky-content-inner"
                    style="display: flex; flex-direction: row; width: ${sticky.footerInnerWidth}; margin: 0 auto;justify-content: space-between;"
                >
                    <div
                        class="cc-sticky-heading"
                        style="
                            font-size:${sticky.headlineFontSize};
                            font-family:${sticky.fontFamily};
                            color:${sticky.headlineColor};
                            display:flex;
                            align-items:center;
                        
                        "
                    >
                    ${sticky.headline}
                    </div>
                    <div class="cc-sticky-btn-wrapper"
                        style="
                        display: block;
                        width: 250px;
                        height: 40px;
                        "
                    >
                        <button class="cc-sticky-btn"
                            style="
                            color:${sticky.buttonColor};
                            border:${sticky.buttonBorder};
                            background-color:${sticky.buttonBackground};
                            width:100%;
                            border-radius:${sticky.buttonBorderRadius};
                            height:100%;
                            font-size:${sticky.buttonFontSize};
                            "
                        >
                        ${sticky.buttonText}
                        </button>
                    </div>
                </div>
            </div>

            <div class="cc-sticky-expanded cc-hidden"
                style="
                    height:${sticky.expandedHeight};
                    background-color:${sticky.background};
                    border-radius:${sticky.borderRadius};
                    width:${sticky.width || "800px"};
                "
            
            >
            <span
                class="cc-close"
                style="
                    color:${cfg.styles.closeColor || "#fff"};
                    font-size: ${cfg.styles.closeHeight || "20px"};
                    z-index:999;
                "
                >
                &times;
                </span>

                <div class="cc-sticky-form-wrapper">
                     <div id="cc-form-${cfg.id}" class="cc-sticky-form" style="display:flex;justify-content: center;"></div>
                </div>
            </div>
        `;

        modal.querySelector(".cc-sticky-btn").onclick =
        () => this.expand();

        modal.querySelector(".cc-close").onclick =
        () => this.collapse();

        if (this.footerClosePopupButton) {
            modal.querySelector(".footerClosePopupBtn").onclick=
        () => this.close();
        }

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
            class="cc-popup-position"
            >
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
                    font-size: ${cfg.styles.closeHeight || "20px"};
                    z-index:999;
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

            if (cfg.footerClosePopupButton) {

            const footerButton =
                modal.querySelector(".footerClosePopupBtn");

            if (footerButton) {

                footerButton.addEventListener(
                    "click",
                    () => this.close()
                );

            }

            }
        
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