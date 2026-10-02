import { SplashScreen } from "@capacitor/splash-screen";
import { AuthService } from "./auth.js";
import { ApiService } from "./api.js";
import { LoginPage } from "./pages/login.js";
import { HomePage } from "./pages/home.js";
import { BulbsPage } from "./pages/bulbs.js";
import { themeManager } from "./theme.js";

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';

import "../css/global.css";
import "../css/login.css";
import "../css/home.css";
import "../css/bulbs.css";
import "../css/icons.css";

class SmartHomeApp {
  constructor() {
    this.authService = new AuthService();
    this.apiService = new ApiService();
    this.appContainer = document.getElementById("app");
    this.currentPage = null;

    this.loginPage = new LoginPage(this.appContainer, this.authService, () => this.showHomePage());
    this.homePage = new HomePage(this.appContainer, this.authService, this.apiService, () => this.showLoginPage(), () => this.showBulbsPage());
    this.bulbsPage = new BulbsPage(this.appContainer, this.authService, this.apiService, () => history.back(), () => this.showLoginPage());

    // This is a hand-rolled SPA router that otherwise never touches browser
    // history, so Android's hardware back button / edge-swipe gesture has no
    // WebView history to pop and just exits the app. showBulbsPage() pushes a
    // real history entry so that gesture goes back to Home instead — and the
    // in-app Back arrow is wired to history.back() (above) so there's exactly
    // one path (this listener) that ever renders Home again from Bulbs.
    window.addEventListener("popstate", () => {
      if (this.currentPage === "bulbs") {
        this.renderHomePage();
      }
    });
  }

  async init() {
    await themeManager.load();
    await SplashScreen.hide();

    const isAuth = await this.authService.checkAuth();

    if (isAuth) {
      this.showHomePage();
    } else {
      this.showLoginPage();
    }
  }

  showLoginPage() {
    document.body.classList.remove("home-page");
    document.body.classList.add("login-page");
    this.loginPage.render();
    this.currentPage = "login";
    history.replaceState({ page: "login" }, "", "");
  }

  showHomePage() {
    document.body.classList.remove("login-page");
    document.body.classList.add("home-page");
    this.homePage.render();
    this.currentPage = "home";
    history.replaceState({ page: "home" }, "", "");
  }

  // Only reached via popstate (hardware back / swipe / the in-app Back arrow's
  // history.back() call) unwinding the entry showBulbsPage() pushed — must not
  // touch history itself, or it'd fight the navigation that's already happened.
  renderHomePage() {
    document.body.classList.remove("login-page");
    document.body.classList.add("home-page");
    this.homePage.render();
    this.currentPage = "home";
  }

  showBulbsPage() {
    document.body.classList.remove("login-page");
    document.body.classList.add("home-page");
    this.bulbsPage.render();
    this.currentPage = "bulbs";
    history.pushState({ page: "bulbs" }, "", "");
  }
}

const app = new SmartHomeApp();
app.init();
