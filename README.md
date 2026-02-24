# Braille Vibe & Local Print Bridge

Braille Vibe is a client-side web application that converts text into any liblouis braille table entirely in your browser. 
However, web browsers cannot communicate directly with physical Braille embossers for security reasons. To solve this, the **Braille Vibe Bridge** is a small, lightweight companion app that runs in your system tray and securely routes braille files from the web app to your local embosser.

This guide is primarily for **School IT Administrators** who are setting up the Braille Vibe Bridge on student or staff devices.

## Installation Instructions

The Bridge app is pre-compiled for Windows, macOS, and Linux. You do **not** need to install Go, Node.js, or any developer tools to run it.

### 📥 1. Download the Bridge
Go to the **[Releases](https://github.com/grahamthetvi/GrahamBrailleWriter/releases)** tab on GitHub and download the appropriate `.zip` file for your operating system:
- `braillevibe-bridge-windows.zip` (for Windows)
- `braillevibe-bridge-macos.zip` (for macOS Intel & Apple Silicon)
- `braillevibe-bridge-linux.zip` (for Linux)

---

### 🪟 Windows Setup (Easiest)

1. Extract the downloaded `braillevibe-bridge-windows.zip` file.
2. Move the extracted `braillevibe-bridge-windows.exe` file to a safe location (e.g., `C:\Program Files\BrailleVibe\`).
3. Double-click the `.exe` file to run it. A Braille Vibe icon will appear in your System Tray (near the clock).
4. **Run on Boot (Recommended):** 
   - Press `Win + R`, type `shell:startup`, and press Enter.
   - Right-click and drag the `braillevibe-bridge-windows.exe` into the Startup folder, and select "Create shortcuts here". The bridge will now silently start in the background when the user logs in.

---

### 🍎 macOS Setup (Intel & Apple Silicon)

1. Extract the downloaded `braillevibe-bridge-macos.zip` file.
2. You will see an application bundle named `Braille Vibe Bridge.app`.
3. Drag `Braille Vibe Bridge.app` into your `/Applications` folder.
4. **First Time Launch:** Because this app is an open-source tool, you must right-click `Braille Vibe Bridge.app` and select **Open**. You may be prompted to confirm opening an app from an "unidentified developer".
5. **Run on Boot (Recommended):**
   - Go to **System Settings > General > Login Items**.
   - Click the `+` button and select the `Braille Vibe Bridge.app` from your Applications folder.

---

### 🐧 Linux Setup (Ubuntu/Debian/ChromeOS)

1. Extract the downloaded `braillevibe-bridge-linux.zip` file.
2. The zip contains the executable binary `braillevibe-bridge-linux` and a desktop shortcut `braillevibe-bridge.desktop`.
3. Move the binary to a global location, for example:
   ```bash
   sudo mv braillevibe-bridge-linux /usr/local/bin/
   ```
4. Edit the `Exec=` line in the `braillevibe-bridge.desktop` file to point to `/usr/local/bin/braillevibe-bridge-linux`.
5. Install the desktop shortcut so it appears in the app launcher:
   ```bash
   mkdir -p ~/.local/share/applications
   mv braillevibe-bridge.desktop ~/.local/share/applications/
   ```
6. You can now launch "Braille Vibe Bridge" from your application menu!

---

## ⚙️ How It Works

Once running, the bridge operates silently in the background and places an icon in your system tray. 
- Right-clicking the tray icon allows you to check its status, easily open the Braille Vibe Editor in your browser, or cleanly quit the background process.
- The app listens on `localhost:8080`. It only accepts specific local CORS requests originating from the Braille Vibe web application, effectively blocking external or malicious sites from printing directly to your embosser without your permission.
- Make sure your Braille embosser is physically connected (USB/Network) and recognized by your operating system's printer settings!
