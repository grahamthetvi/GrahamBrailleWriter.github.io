# Graham Braille Editor & Local Print Bridge

Graham Braille Editor is a client-side web application that converts text into any liblouis braille table entirely in your browser. 
It features **Native TypeScript Embosser Drivers** directly inside the browser, allowing it to generate precise physical hardware commands for various Braille Embossers (including Generic Text, Enabling Technologies Romeo/Juliet, Index Braille, and Braillo).

#### 🔌 Connecting to your Embosser
- **ChromeOS / WebUSB:** Because the editor has native driver support, you can print *directly* from your browser to your embosser using WebUSB. Just connect your embosser, select your model, and hit Print. No bridge required!
- **Windows / macOS / Linux:** Desktop web browsers do not always have full hardware USB access. To solve this, the **Graham Braille Editor Bridge** is a small, lightweight companion app that runs in your system tray and securely routes the pre-formatted braille commands from the web app straight to your local print spooler.

This guide is primarily for **School IT Administrators** who are setting up the Graham Braille Editor Bridge on student or staff devices.

## Installation Instructions

The Bridge app is pre-compiled for Windows, macOS, and Linux. You do **not** need to install Go, Node.js, or any developer tools to run it.

### 📥 1. Download the Bridge
Go to the **[Releases](https://github.com/grahamthetvi/GrahamBrailleWriter/releases)** tab on GitHub and download the appropriate `.zip` file for your operating system:
- `graham-bridge-windows.zip` (for Windows)
- `graham-bridge-macos.zip` (for macOS Intel & Apple Silicon)
- `graham-bridge-linux.zip` (for Linux)

---

### 🪟 Windows Setup (Easiest)

1. Extract the downloaded `graham-bridge-windows.zip` file.
2. Move the extracted `graham-bridge-windows.exe` file to a safe location (e.g., `C:\Program Files\graham\`).
3. Double-click the `.exe` file to run it. A Graham Braille Editor icon will appear in your System Tray (near the clock).
4. **Run on Boot (Recommended):** 
   - Press `Win + R`, type `shell:startup`, and press Enter.
   - Right-click and drag the `graham-bridge-windows.exe` into the Startup folder, and select "Create shortcuts here". The bridge will now silently start in the background when the user logs in.

---

### 🍎 macOS Setup (Intel & Apple Silicon)

1. Extract the downloaded `graham-bridge-macos.zip` file.
2. You will see an application bundle named `Graham Braille Editor Bridge.app`.
3. Drag `Graham Braille Editor Bridge.app` into your `/Applications` folder.
4. **First Time Launch:** Because this app is an open-source tool, you must right-click `Graham Braille Editor Bridge.app` and select **Open**. You may be prompted to confirm opening an app from an "unidentified developer".
5. **Run on Boot (Recommended):**
   - Go to **System Settings > General > Login Items**.
   - Click the `+` button and select the `Graham Braille Editor Bridge.app` from your Applications folder.

---

### 🐧 Linux Setup (Ubuntu/Debian/ChromeOS)

1. Extract the downloaded `graham-bridge-linux.zip` file.
2. The zip contains the executable binary `graham-bridge-linux` and a desktop shortcut `graham-bridge.desktop`.
3. Move the binary to a global location, for example:
   ```bash
   sudo mv graham-bridge-linux /usr/local/bin/
   ```
4. Edit the `Exec=` line in the `graham-bridge.desktop` file to point to `/usr/local/bin/graham-bridge-linux`.
5. Install the desktop shortcut so it appears in the app launcher:
   ```bash
   mkdir -p ~/.local/share/applications
   mv graham-bridge.desktop ~/.local/share/applications/
   ```
6. You can now launch "Graham Braille Editor Bridge" from your application menu!

---

## ⚙️ How It Works

Once running, the bridge operates silently in the background and places an icon in your system tray. 
- Right-clicking the tray icon allows you to check its status, easily open the Graham Braille Editor Editor in your browser, or cleanly quit the background process.
- The app listens on `localhost:8080`. It only accepts specific local CORS requests originating from the Graham Braille Editor web application, effectively blocking external or malicious sites from printing directly to your embosser without your permission.
- Make sure your Braille embosser is physically connected (USB/Network) and recognized by your operating system's printer settings!

## 🖨️ Supported Embossers

The Graham Braille Editor natively supports generating hardware-specific commands for the following embosser families:

1. **Generic Text Embossers** (Standard CR/LF and Form Feed support)
2. **Enabling Technologies** (Romeo, Juliet, Basic models)
3. **Index Braille** (Basic-D, Everest)
4. **Braillo** (200, 270)

*(Note: ViewPlus embossers currently rely on their own desktop graphical driver, so they should be selected as "Generic Text" when printing via the Bridge).*
