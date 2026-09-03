# Mijn Levenspad — mobile wrapper

Native Capacitor shell in this folder. It opens the existing web app (`https://mijnlevenspad.com`) in an Android/iOS WebView. The React SPA stays in the parent project.

## Prerequisites (Android)

- Node.js 18+
- [Android Studio](https://developer.android.com/studio) with an emulator or a USB device
- JDK 21 (Android Studio usually installs one)

## First-time setup

```powershell
cd mobile
npm install
npx cap add android
npx cap sync
npx cap open android
```

In Android Studio: wait for Gradle sync, then Run on an emulator or phone.

`npx cap add android` only needs to be run once (it creates `mobile/android/`). Later updates:

```powershell
npx cap sync
npx cap open android
```

## What the wrapper loads

By default the WebView opens **https://mijnlevenspad.com** (live SPA + production API).

### Local Vite instead of production

1. Start the parent app: `npm run dev` (port `8081`).
2. Sync with a LAN URL, then reopen Android Studio.

Emulator:

```powershell
$env:CAP_SERVER_URL = "http://10.0.2.2:8081"
npx cap sync
```

Physical device (same Wi-Fi as your PC):

```powershell
$env:CAP_SERVER_URL = "http://192.168.x.x:8081"
npx cap sync
```

Use your machine’s IPv4 address, not `localhost`.

## iOS

On a Mac:

```powershell
npx cap add ios
npx cap sync
npx cap open ios
```

## Store notes

Replace the default launcher icon in Android Studio (`android/app/src/main/res/mipmap-*`) before a Play Store upload. App id: `com.mijnlevenspad.app`.
