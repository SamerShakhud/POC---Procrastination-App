# 🧠 ProcPro

ProcPro is a Chrome extension built to reduce procrastination during work sessions.

## ✨ What this project is

ProcPro gives you a focus timer, blocks distracting websites while Work Mode is active, and tracks simple focus stats so you can stay consistent.

## ⚙️ How it works

1. You start Work Mode from the popup.
2. The background service worker starts a Pomodoro phase timer.
3. While the phase is `Focus`, blocked domains are intercepted and redirected to a local blocked page.
4. When a phase ends, the extension moves to the next phase (short break or long break) based on your settings.
5. Popup and popout panel stay in sync through extension messages and storage updates.

## 🧩 Main parts

`chrome/manifest.json` defines permissions, popup, background worker, and extension icons.

`chrome/background/background.js` manages timer phases, notifications, blocking logic, and message handling.

`chrome/popup/` contains the main extension UI for focus control, blocked sites, and settings.

`chrome/panel/` contains a popout live timer view.

`chrome/blocked/` contains the page shown when a blocked site is opened during focus mode.

`chrome/config.js` contains default timer values and default blocked domains.

## 🚀 How to run it

1. Open Chrome and go to `chrome://extensions`.
2. Turn on Developer mode.
3. Click **Load unpacked**.
4. Select the `chrome` folder from this repository.
5. Pin ProcPro from the extensions menu and open it.

## 🧪 Quick usage

1. Open ProcPro popup.
2. Click the Work Mode toggle to start focus.
3. Try visiting a blocked domain to confirm redirect behavior.
4. Open the Settings tab to tune timer values and notification behavior.
5. Open Popout if you want a floating live timer window.

## 📌 Notes

Current version is set in `chrome/manifest.json` as `0.0.1`.

This repository root includes this README for GitHub project clarity, while extension source code lives in `chrome/`.
