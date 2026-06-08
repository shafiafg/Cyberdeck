# 🌌 Cyberdeck Gesture Controller: Grandma-Friendly Guide!

Hello! Welcome to **Cyberdeck**. 

This is a magical computer program that lets you controlled beautiful 3D neon shapes (we call it a **hologram**) on your screen **just by waving your hand in front of your camera!** No mouse, no touch screens—just pure movement!

If you can double-click a mouse, you can run this program. Follow this simple guide, and we will have you waving your hands like a sci-fi wizard in 2 minutes! Let's get started! 👵🔮✨

---

## 🎒 Before You Start: The 3 Golden Rules
To make sure the magic works perfectly:
1. 📷 **You Need a Camera:** Make sure your computer has a webcam built-in (or one plugged into it).
2. 💡 **Sit in a Bright Room:** Turn on a lamp or sit near a window! If the room is dark, the computer cannot see your hand outline clearly.
3. 🤚 **Hold Hand 2 Feet Away:** Hold your hand up about 2 feet away from the camera. Don't put it too close or too far!

---

## 🚀 Speedrun Option: The Magic One-Click Way!
We made special "auto-installers" that do all the hard work of setting up Python and installing packages automatically.

### 🪟 If You are on Windows (Windows 10 or 11):
1. Locate the file named **`run.bat`** in this folder.
2. **Double-click on it!**
3. A safe black box will open up, automatically set up a small virtual room, install all dependencies, and launch the floating hologram app for you!
4. *To close it:* Click the `X` button on the top-right corner of the window, or press the **`Q`** key on your keyboard.

### 🍎/🐧 If You are on Mac or Linux:
1. Open your terminal app.
2. Drag and drop the **`run.sh`** file from your folder into the terminal, or type:
   ```bash
   ./run.sh
   ```
3. Press **Enter**! It will install everything and open the program automatically.

---

## 🛠️ The Manual Step-by-Step Way (With Zero Jargon)

If the one-click files don't work, don't worry! We can do it step-by-step together:

### Step 1: Install Python (The Engine)
Python is the language our hologram speaks. We need to install it first:
1. Go to this friendly website: **[python.org/downloads](https://www.python.org/downloads/)**
2. Click the big yellow button that says **"Download Python"**.
3. Once the file downloads, double-click to install it.
4. ⚠️ **EXTREMELY IMPORTANT WARNING:** Before clicking "Install Now", look at the bottom of the installer window. You will see a tiny square checkbox that says **"Add python.exe to PATH"**. **MAKE SURE YOU CLICK THIS BOX AND TURN IT ON!** If you skip this, your computer won't know where python is.
5. Click **"Install Now"** and wait for it to finish.

### Step 2: Open "Command Prompt" (The Command Desk)
We need to tell the computer to look inside our program folder:
1. Press the **Windows Key** on your keyboard (the one with the flag on it).
2. Type the letters **`cmd`** and press **Enter**. A black window with text (the Command Desk) will open up.
3. Type **`cd `** followed by a single space.
4. **The Magic Drag-and-Drop Trick:** Go to your regular file folder window, left-click on the `Cyberdeck` folder, **hold down your mouse button, drag the folder directly over into that black box, and let go of the mouse button!**
   * *How does this work?* Modern computers have a secret trick: dragging any file or folder into a black command box instantly types out its exact address for you! No typing or copy-pasting required!
5. Press **Enter** on your keyboard. Now the Command Desk is looking inside your folder!

### Step 3: Install the Virtual Libraries
Copy and paste this exact sentence into the black box, then press **Enter**:
```bash
pip install -r requirements.txt
```
*Wait 20 to 30 seconds.* You will see lots of text fly by as it fetches the camera sensors and drawing board.

### Step 4: Launch the Hologram!
Copy and paste this word into the black box and press **Enter**:
```bash
python cyberdeck.py
```
**Tada! The Cyberdeck Screen is active!** 🎉

---

## 🎮 How to Play with Your Hologram (Hand Gestures)

Get your hand ready, hold it up in front of your webcam, and try these 4 gestures:

| What your hand does | What happens on the screen | What it looks like 📷 |
| :--- | :--- | :--- |
| **Wave Left and Right / Up and Down** | The rotating 3D wireframe shape **follows your hand precisely**, tilting and sliding along with you! | 🖐️ (Open Palm) |
| **Squeeze into a Fist** | The hologram **shrinks and compacts**! The controls will say `FIST COMPRESS`. | ✊ (Closed Fist) |
| **Pinch index finger & thumb together** | The hologram **glows bright neon blue and locks**! The controls will say `PINCH LOCK`. | 👌 (Pinch) |
| **Swipe your hand fast to the Left/Right** | Watch a **beautiful green rings flash** as the shape spins at hypersonic speed! | 💨🖐️ (Fast Swipe) |

---

## ⌨️ Useful Keyboard Rules
While playing, you can press these single letters on your keyboard:
*   **`[S]`**: Switches the hologram between a **Sphere** 🌐 and a **Cylinder** 🌀.
*   **`[C]`**: Temporarily turns your camera feed on and off.
*   **`[ [ ]`** and **`[ ] ]`**: Left/Right square brackets adjust "Damping"—this makes your hand movements on screen smoother or faster!
*   **`[Q]`** or **`[ESC]`**: Closes the program immediately.

---

## 🙋‍♀️ "Grandma, Help! Something is Wrong!" (Troubleshooting)

*   **"My hand isn't moving anything on the screen!"**
    *   Make sure you are not sitting in the dark! Turn on more lights.
    *   Ensure your camera is plugged in and working in other apps (like Skype or FaceTime).
    *   If you are on Windows, make sure you went to **Settings ➔ Privacy ➔ Camera** and turned ON **"Allow desktop apps to read camera"**.
*   **"The black window closed instantly when I clicked `run.bat`!"**
    *   This usually means Python was not installed with the **"Add python.exe to PATH"** checkbox turned on. Re-run the Python installer, select "Modify", and make sure that box is checked!
*   **"It's moving very slowly and looks like a slideshow!"**
    *   Your computer is working hard to find your fingers. If you have other heavy programs open web browsers, close them down to let Cyberdeck have all the power it needs.
