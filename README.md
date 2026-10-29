# Rocket Soccer 3D — Starter Project

A small 3D car-soccer prototype built with Three.js and Vite. It is an original starter project inspired by arcade car soccer, not a copy of Rocket League assets or branding.

## Requirements
- Node.js 22 recommended
- A code editor such as VS Code
- A browser with WebGL support

## Run locally
1. Extract the ZIP.
2. Open a terminal in the `rocket-soccer-starter` folder.
3. Run `npm install`
4. Run `npm run dev`
5. Open the local URL Vite prints (usually `http://localhost:5173`).

## Controls
- W / Up Arrow: accelerate
- S / Down Arrow: reverse
- A / Left Arrow and D / Right Arrow: steer
- Space: jump
- Shift: boost
- R: reset car and ball
- C: switch camera
- Click Play Match to start

## Publish to GitHub and GitHub Pages
1. Create a new empty repository on GitHub, for example `rocket-soccer-3d`.
2. Extract this ZIP and open the folder in VS Code.
3. In a terminal in the project folder, run the commands below, replacing `YOUR-USERNAME` with your GitHub username and `rocket-soccer-3d` if you chose another repository name:
   ```bash
   git init
   git add .
   git commit -m "Add Rocket Soccer 3D starter"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/rocket-soccer-3d.git
   git push -u origin main
   ```
4. In your GitHub repository, open **Settings → Pages**. Under **Build and deployment**, choose **GitHub Actions** as the source.
5. Open the **Actions** tab and wait for **Deploy to GitHub Pages** to finish successfully.
6. Your site URL will usually be `https://YOUR-USERNAME.github.io/rocket-soccer-3d/`.

## Important limitations
- This is a local single-player prototype. It does not include real online multiplayer, matchmaking, server authority, or AI opponents.
- Physics are arcade-style starter physics, not a full rigid-body simulation.
- The field, car, and ball are generated from basic 3D shapes. Upgrade them with original models, textures, audio, animations, and better physics as the project grows.
- Do not use Rocket League logos, proprietary assets, or branding in a public release.
