import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.linebookpro.finance",
  appName: "LineBook Pro",
  webDir: "dist",
  server: {
    androidScheme: "https",
    allowNavigation: ["wa.me", "*.whatsapp.com", "api.whatsapp.com"],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
