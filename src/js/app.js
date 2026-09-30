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

    this.loginPage = new LoginPage(this.appContainer, this.authService, () => this.showHomePage());
    this.homePage = new HomePage(this.appContainer, this.authService, this.apiService, () => this.showLoginPage(), () => this.showBulbsPage());
    this.bulbsPage = new BulbsPage(this.appContainer, this.authService, this.apiService, () => this.showHomePage(), () => this.showLoginPage());
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
  }

  showHomePage() {
    document.body.classList.remove("login-page");
    document.body.classList.add("home-page");
    this.homePage.render();
  }

  showBulbsPage() {
    document.body.classList.remove("login-page");
    document.body.classList.add("home-page");
    this.bulbsPage.render();
  }
}

const app = new SmartHomeApp();
app.init();
