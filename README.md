# CreativeInstagram 🎮📱

A Pokemon-style 3D visualizer for Instagram built with Electron and Three.js.

![CreativeInstagram](https://img.shields.io/badge/Version-1.0.0-ff6b9d?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-28.x-61dafb?style=for-the-badge)
![Three.js](https://img.shields.io/badge/Three.js-r128-c678dd?style=for-the-badge)

## ✨ Features

- **3D Pokemon-Style World**: Explore a vibrant 3D environment inspired by classic Pokemon games
- **Window Capture**: Scrape Instagram data from your browser window
- **Instagram Hub Buildings**: 
  - 📖 Stories Tower - View Instagram stories
  - 💬 Message Center - Check your DMs
  - 🖼️ Post Gallery - Browse posts
  - 🔍 Explore Zone - Discover content
- **Interactive NPCs**: Talk to characters for tips and insights
- **Beautiful Retro UI**: Pixel-perfect interface with neon aesthetics

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn

### Installation

```bash
# Clone or navigate to the project
cd instagram-3D

# Install dependencies
npm install

# Start the application
npm start

# Start in development mode (with DevTools)
npm run dev
```

### macOS Permissions

On macOS, you'll need to grant **Screen Recording** permissions for the window capture feature:

1. Open **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Screen Recording** from the sidebar
3. Add and enable your terminal or Cursor IDE

## 🎮 Controls

| Key | Action |
|-----|--------|
| **WASD** / Arrow Keys | Move around |
| **E** | Interact with buildings/NPCs |
| **SPACE** | Advance dialog |
| **TAB** | Open menu |
| **ESC** | Pause game |

## 🏗️ Architecture

```
instagram-3D/
├── main.js          # Electron main process
├── index.html       # Application UI
├── styles.css       # Retro-gaming styles
├── renderer.js      # Three.js 3D world renderer
├── game.js          # Game logic and state
├── app.js           # UI controller and IPC
└── package.json     # Dependencies
```

## 🎨 Customization

### Adding New Buildings

Edit `renderer.js` and add new buildings in the `createInstagramWorld()` method:

```javascript
this.createBuilding({
  position: new THREE.Vector3(x, 0, z),
  size: { width: 8, height: 10, depth: 6 },
  color: 0xff6b9d,
  accentColor: 0xffffff,
  name: 'My Building',
  type: 'custom',
  icon: '🏠'
});
```

### Custom Themes

Modify CSS variables in `styles.css`:

```css
:root {
  --primary: #ff6b9d;    /* Main accent color */
  --secondary: #c678dd;  /* Secondary accent */
  --accent: #61dafb;     /* Highlights */
  --bg-dark: #0a0a0f;    /* Background */
}
```

## 📝 How Window Capture Works

1. Click **CAPTURE WINDOW** from the title screen
2. Select your browser window with Instagram open
3. The app captures a screenshot of the window
4. In a full implementation, OCR would extract:
   - Story avatars and usernames
   - Post images and captions
   - Message previews
   - Profile information

> **Note**: Currently uses simulated data. Full OCR integration with Tesseract.js can be implemented for production use.

## 🔮 Future Enhancements

- [ ] Real OCR processing with Tesseract.js
- [ ] Real-time window monitoring
- [ ] Profile viewer building
- [ ] Reels theater
- [ ] Multiplayer support
- [ ] Custom character creation
- [ ] Day/night cycle
- [ ] Weather effects

## 📄 License

MIT License - Feel free to modify and use this project!

---

Made with ❤️ and ☕ by the CreativeInstagram team


