import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell around the existing SPA.
 *
 * Production (default): WebView loads https://mijnlevenspad.com
 *
 * Local Vite on an Android emulator:
 *   CAP_SERVER_URL=http://10.0.2.2:8081 npx cap sync
 * Physical device on the same Wi-Fi:
 *   CAP_SERVER_URL=http://YOUR_LAN_IP:8081 npx cap sync
 */
const remoteUrl = process.env.CAP_SERVER_URL || "https://mijnlevenspad.com";
const isLocalHttp = remoteUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "com.mijnlevenspad.app",
  appName: "Mijn Levenspad",
  webDir: "www",
  backgroundColor: "#c9cdb8",
  android: {
    allowMixedContent: true,
    backgroundColor: "#c9cdb8",
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#c9cdb8",
    },
  },
  server: {
    url: remoteUrl,
    androidScheme: isLocalHttp ? "http" : "https",
    cleartext: isLocalHttp,
    allowNavigation: [
      "mijnlevenspad.com",
      "www.mijnlevenspad.com",
      "inner.krintix.in",
      "*.mollie.com",
      "www.mollie.com",
      "accounts.google.com",
      "*.google.com",
      "*.googleapis.com",
      "*.gstatic.com",
    ],
  },
};

export default config;
