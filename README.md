<div align="center">

# 📱 Smart Home - Mobile App

**Android Client for Zigbee Device Management & Home Automation**

A CapacitorJS + Vite mobile application for real-time monitoring and control of your smart home system with Zigbee sensors.

[![Capacitor](https://img.shields.io/badge/Capacitor-8.0-blue.svg)](https://capacitorjs.com/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Android](https://img.shields.io/badge/Platform-Android-brightgreen.svg)](https://www.android.com/)

[Features](#-features) • [Getting Started](#-getting-started) • [Build Instructions](#-build-instructions)

</div>

---

## ✨ Features

### 🚪 Garage Door Control

- **Real-time Status Monitoring**
  - Live door state (Opening, Closing, Idle Open, Idle Closed)
  - Progress bar during door operation
  - Visual indicators for door position
- **Remote Control**
  - Open/Close commands
  - Emergency stop capability
  - State reset functionality

### 📊 Smart Plug Monitoring

- Real-time power consumption (W)
- Voltage and current readings
- Energy usage tracking (kWh)
- Device temperature monitoring
- Remote on/off control

### 📡 Sensor Integration

- **Tilt Sensor**
  - Open/closed detection
  - Battery level monitoring
  - Signal strength (link quality)
  - Low battery warnings
- **Vibration Sensor**
  - Movement detection
  - Angle tracking
  - Temperature readings
  - Battery and voltage monitoring

### 🔄 Real-time Updates

- WebSocket connection for instant updates
- Connection status indicators
- MQTT broker status monitoring
- Pull-to-refresh functionality

### 🎨 User Interface

- Clean, modern Material Design-inspired UI
- Lucide icons throughout
- Responsive layout optimized for mobile
- Visual feedback for all actions
- Color-coded status indicators

## 🛠️ Tech Stack

- **Framework**: CapacitorJS 8.0 (for native Android)
- **Build Tool**: Vite 5.4
- **Icons**: Lucide
- **WebSocket**: Native WebSocket API
- **HTTP Client**: Fetch API

## 📋 Prerequisites

- Node.js 18+ and npm
- Android Studio (for APK compilation)
- Java Development Kit (JDK) 17+
- Access to the Smart Home Server

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/B077AS/smart-home-mobile.git
cd smart-home-mobile
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file in the project root:

```env
VITE_WS_URL=wss://your-server-url/ws
VITE_API_BASE_URL=https://your-server-url/api
```

**Configuration Details:**

- `VITE_WS_URL`: WebSocket endpoint for real-time updates
- `VITE_API_BASE_URL`: REST API base URL for the backend server

### 4. Development Mode

```bash
npm run dev
```

This will start the development server, typically at `http://localhost:5173`

## 📦 Build Instructions

### Building for Android

1. **Build the web assets:**

```bash
npm run build
```

2. **Sync with Capacitor:**

```bash
npx cap sync
```

3. **Open in Android Studio:**

```bash
npx cap open android
```

4. **Compile APK:**
   - In Android Studio, go to `Build > Build Bundle(s) / APK(s) > Build APK(s)`
   - Or use the toolbar icon to run on a connected device/emulator

### Release Build

For a production release APK:

1. Follow steps 1-3 above
2. In Android Studio: `Build > Generate Signed Bundle / APK`
3. Follow the wizard to create/use a keystore
4. Select release build variant
5. Build the signed APK

## 🎨 Customizing App Icons

To update the app icons and splash screens:

1. Place your icon files in `src/assets/` directory
2. Run the asset generator:

```bash
npx @capacitor/assets generate --assetPath src/assets
```

**Icon Requirements:**

- PNG format
- Minimum 1024x1024px recommended
- Transparent background for adaptive icons

## 📱 Supported Features

### WebSocket Connection

- Automatic reconnection on connection loss
- Token-based authentication
- Real-time sensor data streaming
- Garage state updates
- Plug status monitoring

### API Integration

- RESTful endpoints for device control
- Token refresh handling
- Error handling with user feedback
- Offline mode detection

## 🔗 Related Projects

- [Smart Home Server](https://github.com/B077AS/smart-home-server) - Backend Spring Boot application

---
