/*
 * Borderless check-in for a clinic's own website.
 *
 *   <script src="https://[host]/embed.js"></script>
 *   <borderless-checkin clinic="[clinic-id]" name="[Clinic name]"></borderless-checkin>
 *
 * Shows a "Start a check-in" button. It opens the check-in in a side panel
 * (full screen on phones). The help buttons and Quick exit stay built in:
 * Quick exit inside the panel leaves the whole clinic page. No dependencies.
 */
(function () {
  "use strict";
  if (window.customElements && customElements.get("borderless-checkin")) return;

  var script = document.currentScript;
  var HOST = script ? new URL(script.src).origin : location.origin;
  var NEUTRAL_SITE = "https://www.google.com/search?q=weather";

  // Quick exit pressed inside the panel: leave this page too, so Back can't return to it.
  window.addEventListener("message", function (e) {
    if (e.origin !== HOST || !e.data || e.data.type !== "borderless:quick-exit") return;
    location.replace(NEUTRAL_SITE);
  });

  var css =
    ":host{all:initial}" +
    ".launch{font:600 16px/1.2 Inter,system-ui,sans-serif;min-height:48px;padding:0 22px;border-radius:999px;border:0;background:#556B2F;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:10px}" +
    ".launch:hover{background:#3F5222}.launch:focus-visible,.close:focus-visible{outline:3px solid #3F5222;outline-offset:2px}" +
    ".backdrop{position:fixed;inset:0;background:rgba(31,42,28,.25);z-index:2147483646}" +
    ".panel{position:fixed;top:16px;right:16px;bottom:16px;width:min(400px,calc(100vw - 32px));background:#F7F5F0;border-radius:20px;box-shadow:0 18px 50px rgba(31,42,28,.22);z-index:2147483647;display:flex;flex-direction:column;overflow:hidden}" +
    "@media (max-width:640px){.panel{top:0;right:0;bottom:0;width:100vw;border-radius:0}}" +
    ".bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 8px 8px 16px;border-bottom:1px solid #DAD6CC;background:#fff;font:600 14px/1.3 Inter,system-ui,sans-serif;color:#1F2A1C}" +
    ".bar small{display:block;font-weight:400;font-size:12px;color:#4E5A48}" +
    ".close{min-width:44px;min-height:44px;border:0;border-radius:999px;background:transparent;cursor:pointer;font:400 26px/1 system-ui,sans-serif;color:#1F2A1C}" +
    ".close:hover{background:#E9EDDE}" +
    "iframe{flex:1;width:100%;border:0;background:#F7F5F0}";

  function BorderlessCheckin() {
    return Reflect.construct(HTMLElement, [], BorderlessCheckin);
  }
  BorderlessCheckin.prototype = Object.create(HTMLElement.prototype);
  BorderlessCheckin.prototype.constructor = BorderlessCheckin;
  Object.setPrototypeOf(BorderlessCheckin, HTMLElement);

  BorderlessCheckin.prototype.connectedCallback = function () {
    if (this.shadowRoot) return;
    var root = this.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = css;
    root.appendChild(style);

    var button = document.createElement("button");
    button.type = "button";
    button.className = "launch";
    button.setAttribute("aria-haspopup", "dialog");
    button.textContent = this.getAttribute("label") || "Start a check-in";
    root.appendChild(button);

    var self = this;
    button.addEventListener("click", function () {
      self.open(button);
    });
  };

  BorderlessCheckin.prototype.open = function (opener) {
    var root = this.shadowRoot;
    if (root.querySelector(".panel")) return;
    var clinic = this.getAttribute("clinic") || "";
    var name = this.getAttribute("name") || "your clinic";

    var backdrop = document.createElement("div");
    backdrop.className = "backdrop";

    var panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Check-in with " + name);

    var bar = document.createElement("div");
    bar.className = "bar";
    var title = document.createElement("span");
    title.textContent = "Check-in with " + name;
    var sub = document.createElement("small");
    sub.textContent = "Borderless · a clinician reads everything";
    title.appendChild(sub);
    var close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", "Close the check-in");
    close.textContent = "×";
    bar.appendChild(title);
    bar.appendChild(close);

    var frame = document.createElement("iframe");
    frame.title = "Borderless check-in";
    frame.src = HOST + "/embed/" + encodeURIComponent(clinic);
    frame.setAttribute("allow", "clipboard-write");

    panel.appendChild(bar);
    panel.appendChild(frame);
    root.appendChild(backdrop);
    root.appendChild(panel);
    close.focus();

    function shut() {
      panel.remove();
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      if (opener) opener.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") shut();
    }
    close.addEventListener("click", shut);
    backdrop.addEventListener("click", shut);
    document.addEventListener("keydown", onKey);
  };

  customElements.define("borderless-checkin", BorderlessCheckin);
})();
