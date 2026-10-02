// Fixed-position overlay notifications, shared by every page, so action feedback
// ("Garage door triggered", "Light reset to default", ...) never shifts page
// content the way an inline message div does. Appended to #toast-root, a sibling
// of #app in index.html that survives the hand-rolled router wiping #app on
// every page swap.

const AUTO_DISMISS_MS = {
  success: 2800,
  info: 2800,
  error: 4200,
};

const ICONS = {
  success: "mdi-check-circle",
  error: "mdi-alert-circle",
  info: "mdi-information",
};

class ToastManager {
  show(type, message) {
    const root = document.getElementById("toast-root");
    if (!root) return;

    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="mdi ${ICONS[type] || ICONS.info}"></i><span></span>`;
    el.querySelector("span").textContent = message;
    root.appendChild(el);

    // Next frame, so the enter transition animates from its initial state
    // instead of the "visible" class landing before the browser's first paint.
    requestAnimationFrame(() => el.classList.add("visible"));

    const dismiss = () => {
      el.classList.remove("visible");
      el.addEventListener("transitionend", () => el.remove(), { once: true });
    };
    setTimeout(dismiss, AUTO_DISMISS_MS[type] || AUTO_DISMISS_MS.info);
  }
}

export const toast = new ToastManager();
