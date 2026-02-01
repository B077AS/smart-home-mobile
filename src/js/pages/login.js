import { createElement, Home, Eye, EyeOff, LogIn, Loader2, AlertCircle } from "lucide";
import loginTemplate from "../../pages/login.html?raw";

export class LoginPage {
  constructor(container, authService, onLoginSuccess) {
    this.container = container;
    this.authService = authService;
    this.onLoginSuccess = onLoginSuccess;
  }

  createIcon(iconComponent, size = 24) {
    return createElement(iconComponent, {
      width: size,
      height: size,
      "stroke-width": 2,
    });
  }

  render() {
    this.container.innerHTML = loginTemplate;

    const logoIcon = this.container.querySelector("#logo-icon");
    if (logoIcon) {
      logoIcon.appendChild(this.createIcon(Home, 48));
    }

    const togglePassword = this.container.querySelector("#toggle-password");
    if (togglePassword) {
      togglePassword.appendChild(this.createIcon(Eye, 20));
    }

    const submitBtn = this.container.querySelector("#submit-btn");
    if (submitBtn) {
      submitBtn.insertBefore(this.createIcon(LogIn, 20), submitBtn.firstChild);
    }

    this.setupHandlers();
  }

  setupHandlers() {
    const form = this.container.querySelector("#login-form");
    const errorContainer = this.container.querySelector("#error-container");
    const passwordInput = this.container.querySelector("#password");
    const togglePassword = this.container.querySelector("#toggle-password");
    let isPasswordVisible = false;

    togglePassword.addEventListener("click", () => {
      isPasswordVisible = !isPasswordVisible;
      passwordInput.type = isPasswordVisible ? "text" : "password";
      togglePassword.innerHTML = "";
      togglePassword.appendChild(this.createIcon(isPasswordVisible ? EyeOff : Eye, 20));
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = this.container.querySelector("#username").value;
      const password = this.container.querySelector("#password").value;
      const submitBtn = this.container.querySelector("#submit-btn");

      errorContainer.innerHTML = "";
      submitBtn.disabled = true;
      submitBtn.innerHTML = "";
      const spinner = this.createIcon(Loader2, 20);
      spinner.classList.add("spin");
      submitBtn.appendChild(spinner);
      submitBtn.appendChild(document.createTextNode(" Signing in..."));

      try {
        await this.authService.login(username, password);
        this.onLoginSuccess();
      } catch (error) {
        const errorMsg = document.createElement("div");
        errorMsg.className = "error-message";
        errorMsg.appendChild(this.createIcon(AlertCircle, 20));
        const span = document.createElement("span");
        span.textContent = error.message;
        errorMsg.appendChild(span);
        errorContainer.appendChild(errorMsg);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "";
        submitBtn.appendChild(this.createIcon(LogIn, 20));
        submitBtn.appendChild(document.createTextNode(" Sign In"));
      }
    });
  }
}
