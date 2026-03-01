import loginTemplate from "../../pages/login.html?raw";
import { themeManager } from "../theme.js";

export class LoginPage {
  constructor(container, authService, onLoginSuccess) {
    this.container = container;
    this.authService = authService;
    this.onLoginSuccess = onLoginSuccess;
  }

  render() {
    this.container.innerHTML = loginTemplate;
    this.setupHandlers();
    this.syncThemePicker();
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
      togglePassword.querySelector("i").className = `mdi ${isPasswordVisible ? "mdi-eye-off" : "mdi-eye"}`;
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = this.container.querySelector("#username").value;
      const password = this.container.querySelector("#password").value;
      const submitBtn = this.container.querySelector("#submit-btn");

      errorContainer.innerHTML = "";
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="mdi mdi-loading spin"></i><span>Signing in...</span>`;

      try {
        await this.authService.login(username, password);
        this.onLoginSuccess();
      } catch (error) {
        errorContainer.innerHTML = `
          <div class="error-message">
            <i class="mdi mdi-alert-circle"></i>
            <span>${error.message}</span>
          </div>
        `;
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="mdi mdi-login"></i><span>Sign In</span>`;
      }
    });
  }

  syncThemePicker() {}
}
