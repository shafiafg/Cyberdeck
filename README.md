<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ed2f49c0-f791-48bb-be6d-10e3835cc841

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## for windows 

pip install -r requirements.txt

pip install opencv-python mediapipe websockets

python core_vibe_engine.py

Step-by-Step Recipe to Run Locally on Windows/Linux
To make the real-time interaction work on your local machine, open two terminal windows:
1️⃣ Terminal 1: Run your Frontend Dashboard
Make sure you are in your cyberdeck project directory:
code
Cmd
cd path/to/your/cyberdeck-folder
npm install
npm run dev
This boots up the web server and outputs a URL (usually http://localhost:3000).
Open http://localhost:3000 in any web browser. You will see the beautiful holographic wireframe sphere spinning.
2️⃣ Terminal 2: Run the python core engine
In your second terminal window, run your python code:
code
Cmd
cd path/to/your/cyberdeck-folder
python core_vibe_engine.py
The console will light up with the giant ASCII branding header and show continuous log streams (like SIM_PINCH_MOVE or SIM_SWIPE).
