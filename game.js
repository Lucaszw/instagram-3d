// ========================================
// InstaPokéWorld - Game Logic
// Handles game state, Instagram data, and interactions
// ========================================

class InstagramGame {
  constructor() {
    this.renderer = null;
    this.state = 'title'; // title, playing, paused
    this.instagramData = {
      stories: [],
      posts: [],
      messages: [],
      profile: null
    };
    this.capturedWindowId = null;
    this.dialogQueue = [];
    this.currentDialog = null;
    this.isTyping = false;
    this.chatCache = {}; // Cache scraped chats
    this.activeChatBubble = null; // Current 3D chat bubble
    
    // Mock data for demo
    this.generateMockData();
  }

  generateMockData() {
    // Generate sample Instagram data for demonstration
    const usernames = [
      'adventure_alex', 'photo_princess', 'tech_titan', 
      'foodie_frank', 'travel_tina', 'artist_anna',
      'music_mike', 'fitness_fiona', 'gamer_gary'
    ];

    const avatarEmojis = ['👩‍🎤', '🧑‍💻', '👨‍🍳', '🧑‍🎨', '👩‍🚀', '🧑‍🏫', '👨‍🎸', '🏃‍♀️', '🎮'];

    // Stories
    this.instagramData.stories = usernames.slice(0, 6).map((name, i) => ({
      id: i + 1,
      username: name,
      avatar: avatarEmojis[i],
      viewed: i > 2,
      timestamp: Date.now() - Math.random() * 86400000
    }));

    // Posts
    const postCaptions = [
      'Beautiful sunset vibes 🌅',
      'New project dropping soon! 🚀',
      'Weekend adventures ⛰️',
      'Coffee first, questions later ☕',
      'Living my best life ✨',
      'Art is everywhere 🎨'
    ];

    this.instagramData.posts = postCaptions.map((caption, i) => ({
      id: i + 1,
      username: usernames[i % usernames.length],
      avatar: avatarEmojis[i % avatarEmojis.length],
      caption,
      likes: Math.floor(Math.random() * 10000),
      comments: Math.floor(Math.random() * 500),
      image: this.generateGradientImage(i),
      timestamp: Date.now() - Math.random() * 604800000
    }));

    // Messages
    const messageTexts = [
      'Hey! How are you doing? 😊',
      'Did you see that new post?',
      'Let\'s catch up soon!',
      'Amazing photo! Where was this?',
      'Thanks for the follow! 🙏',
      'Can\'t wait for the weekend!'
    ];

    this.instagramData.messages = messageTexts.map((text, i) => ({
      id: i + 1,
      username: usernames[i % usernames.length],
      avatar: avatarEmojis[i % avatarEmojis.length],
      text,
      unread: i < 3,
      timestamp: Date.now() - Math.random() * 86400000
    }));

    // Profile
    this.instagramData.profile = {
      username: 'instapoke_trainer',
      displayName: 'InstaPoke Trainer',
      avatar: '🎮',
      posts: 42,
      followers: 1337,
      following: 420,
      bio: 'Exploring the 3D Instagram world!'
    };
  }

  generateGradientImage(index) {
    const gradients = [
      'linear-gradient(135deg, #ff6b9d, #c678dd)',
      'linear-gradient(135deg, #61dafb, #c678dd)',
      'linear-gradient(135deg, #ffd93d, #ff6b9d)',
      'linear-gradient(135deg, #98c379, #61dafb)',
      'linear-gradient(135deg, #e06c75, #ffd93d)',
      'linear-gradient(135deg, #c678dd, #61dafb)'
    ];
    return gradients[index % gradients.length];
  }

  start(container) {
    this.renderer = new GameRenderer(container);
    this.state = 'playing';
    this.setupControls();
    this.updateMinimap();
    this.showWelcomeDialog();
  }

  setupControls() {
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (this.state !== 'playing') return;
      
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup':
          this.renderer.setMovement('forward', true);
          this.clearChatBubble(); // Clear bubble when moving
          break;
        case 's': case 'arrowdown':
          this.renderer.setMovement('backward', true);
          this.clearChatBubble();
          break;
        case 'a': case 'arrowleft':
          this.renderer.setMovement('left', true);
          this.clearChatBubble();
          break;
        case 'd': case 'arrowright':
          this.renderer.setMovement('right', true);
          this.clearChatBubble();
          break;
        case 'e':
          this.interact();
          break;
        case ' ':
          this.advanceDialog();
          break;
        case 'tab':
          e.preventDefault();
          this.toggleMenu();
          break;
        case 'escape':
          this.togglePause();
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup':
          this.renderer.setMovement('forward', false);
          break;
        case 's': case 'arrowdown':
          this.renderer.setMovement('backward', false);
          break;
        case 'a': case 'arrowleft':
          this.renderer.setMovement('left', false);
          break;
        case 'd': case 'arrowright':
          this.renderer.setMovement('right', false);
          break;
      }
    });

    // Minimap update loop
    setInterval(() => this.updateMinimap(), 100);
  }

  interact() {
    const nearest = this.renderer.getNearestInteractable();
    if (!nearest) return;

    const { name, type, data } = nearest.userData;
    
    switch (type) {
      case 'hub':
        this.showInteractionMenu();
        break;
      case 'stories':
        this.showContent('stories');
        break;
      case 'messages':
        this.showContent('messages');
        break;
      case 'posts':
        this.showContent('posts');
        break;
      case 'explore':
        this.showContent('explore');
        break;
      case 'npc':
        this.showNPCDialog(name);
        break;
      case 'story':
      case 'message':
      case 'following':
      case 'follower':
      case 'mutual':
      case 'suggestion':
        // Show chat bubble above their head
        this.showChatBubble(nearest, name, type, data);
        break;
    }
  }

  async showChatBubble(npc, name, type, data) {
    const { ipcRenderer } = require('electron');
    
    // Clear any existing bubble
    this.clearChatBubble();
    
    // Create loading bubble first
    this.createBubble(npc, name, [{ text: '⏳ Loading...', isMe: false }]);
    
    // Check cache first
    if (this.chatCache[name]) {
      console.log('Using cached chat for:', name);
      this.createBubble(npc, name, this.chatCache[name]);
      return;
    }
    
    try {
      // Scrape chat in background
      const chatData = await ipcRenderer.invoke('scrape-user-chat', name, { showBrowser: false });
      
      if (chatData && chatData.messages && chatData.messages.length > 0) {
        // Cache the result
        this.chatCache[name] = chatData.messages.slice(-3);
        this.createBubble(npc, name, this.chatCache[name]);
      } else {
        // Show default based on type
        const defaultMsg = {
          'story': '📸 Posted a story',
          'message': '💬 No recent messages',
          'suggestion': '✨ Suggested friend',
          'mutual': '🤝 Mutual friend',
          'following': '👤 You follow them',
          'follower': '👥 Follows you'
        };
        this.createBubble(npc, name, [{ text: defaultMsg[type] || 'Instagram friend', isMe: false }]);
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
      this.createBubble(npc, name, [{ text: '❌ Could not load chat', isMe: false }]);
    }
  }

  createBubble(npc, name, messages) {
    this.clearChatBubble();
    
    // Create canvas for the bubble
    const canvas = document.createElement('canvas');
    const lineHeight = 45;
    const padding = 15;
    canvas.width = 400;
    canvas.height = padding * 2 + Math.max(messages.length, 1) * lineHeight + 35;
    const ctx = canvas.getContext('2d');
    
    // Draw bubble background with rounded corners
    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
    ctx.beginPath();
    ctx.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 12);
    ctx.fill();
    
    // Draw border
    ctx.strokeStyle = '#ff6b9d';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw header
    ctx.fillStyle = '#ff6b9d';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('💬 ' + name, 15, 28);
    
    // Draw messages
    let y = 50;
    messages.forEach((msg) => {
      const isMe = msg.isMe || msg.sender === 'You';
      
      // Message bubble background
      ctx.fillStyle = isMe ? 'rgba(198, 120, 221, 0.4)' : 'rgba(97, 218, 251, 0.25)';
      ctx.beginPath();
      ctx.roundRect(10, y - 12, canvas.width - 20, lineHeight - 8, 6);
      ctx.fill();
      
      // Message text
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      const text = msg.text ? msg.text.substring(0, 45) + (msg.text.length > 45 ? '...' : '') : '';
      ctx.fillText((isMe ? 'You: ' : '') + text, 18, y + 8);
      
      y += lineHeight;
    });
    
    // Create Three.js sprite
    const THREE = window.THREE;
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    
    // Scale and position
    const aspectRatio = canvas.width / canvas.height;
    sprite.scale.set(4 * aspectRatio, 4, 1);
    sprite.position.copy(npc.position);
    sprite.position.y = 4;
    sprite.renderOrder = 999;
    
    this.activeChatBubble = sprite;
    this.activeChatBubbleNPC = npc;
    this.renderer.scene.add(sprite);
  }

  clearChatBubble() {
    if (this.activeChatBubble) {
      this.renderer.scene.remove(this.activeChatBubble);
      if (this.activeChatBubble.material) {
        this.activeChatBubble.material.map?.dispose();
        this.activeChatBubble.material.dispose();
      }
      this.activeChatBubble = null;
      this.activeChatBubbleNPC = null;
    }
  }

  updateChatBubble() {
    if (this.activeChatBubble && this.activeChatBubbleNPC) {
      // Keep bubble above NPC
      this.activeChatBubble.position.copy(this.activeChatBubbleNPC.position);
      this.activeChatBubble.position.y = 4;
    }
  }

  showFriendProfile(name, type, data) {
    const viewer = document.getElementById('content-viewer');
    const inner = document.getElementById('viewer-inner');
    
    viewer.classList.remove('hidden');
    this.state = 'viewing';
    
    // Build profile card
    const initial = (name || '?').charAt(0).toUpperCase();
    const imgHtml = data?.imgSrc 
      ? `<img src="${data.imgSrc}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #ff6b9d;">`
      : `<div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #ff6b9d, #c678dd); display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: bold; color: white;">${initial}</div>`;
    
    // Determine relationship type badge
    const badges = {
      'story': { icon: '📖', label: 'Story', color: '#c678dd' },
      'message': { icon: '💬', label: 'DM Contact', color: '#61dafb' },
      'following': { icon: '👤', label: 'Following', color: '#98c379' },
      'follower': { icon: '👥', label: 'Follower', color: '#e5c07b' },
      'mutual': { icon: '🤝', label: 'Mutual Friend', color: '#ff6b9d' },
      'suggestion': { icon: '✨', label: 'Suggested', color: '#56b6c2' }
    };
    const badge = badges[type] || badges['story'];
    
    // Determine additional relationship indicators
    const isFollowing = type === 'following' || type === 'mutual' || type === 'story';
    const isFollower = type === 'follower' || type === 'mutual';
    const isFriend = type === 'mutual';
    
    let content = `
      <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #3d3d5c;">
        ${imgHtml}
        <div>
          <h2 style="color: #ffffff; margin: 0 0 8px; font-family: 'VT323'; font-size: 24px;">@${name}</h2>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            <span style="background: ${badge.color}; padding: 4px 10px; border-radius: 12px; font-size: 11px;">
              ${badge.icon} ${badge.label}
            </span>
            ${isFollowing ? '<span style="background: #98c379; padding: 4px 10px; border-radius: 12px; font-size: 11px;">👤 Following</span>' : ''}
            ${isFollower ? '<span style="background: #e5c07b; padding: 4px 10px; border-radius: 12px; font-size: 11px;">👥 Follows You</span>' : ''}
            ${isFriend ? '<span style="background: #ff6b9d; padding: 4px 10px; border-radius: 12px; font-size: 11px;">🤝 Friends</span>' : ''}
            ${data?.unread ? '<span style="background: #e06c75; padding: 4px 10px; border-radius: 12px; font-size: 11px;">🔴 UNREAD</span>' : ''}
          </div>
        </div>
      </div>
    `;
    
    // Show message preview if available (chat bubble style)
    if (data?.preview) {
      content += `
        <div style="margin-bottom: 15px;">
          <div style="color: #a0a0b0; font-size: 11px; margin-bottom: 8px; text-transform: uppercase;">💬 Last Message</div>
          <div style="background: linear-gradient(135deg, #3d3d5c, #2d2d44); border-radius: 16px; padding: 12px 16px; color: #ffffff; font-size: 15px; border-left: 3px solid #61dafb;">
            "${data.preview}"
          </div>
        </div>
      `;
    }
    
    // Show story info if available
    if (type === 'story' && data?.hasUnwatched) {
      content += `
        <div style="background: linear-gradient(135deg, #c678dd, #ff6b9d); border-radius: 12px; padding: 12px; margin-bottom: 15px; text-align: center;">
          <span style="font-size: 14px;">🔥 Has unwatched story!</span>
        </div>
      `;
    }
    
    // Action buttons - larger and more prominent
    content += `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
        <button class="pixel-btn" onclick="require('electron').ipcRenderer.invoke('open-instagram-dm', '${name}')" style="padding: 12px; font-size: 12px;">
          💬 Open Chat
        </button>
        <button class="pixel-btn secondary" onclick="require('electron').shell.openExternal('https://instagram.com/${name}')" style="padding: 12px; font-size: 12px;">
          📱 View Profile
        </button>
      </div>
      <p style="text-align: center; color: #6272a4; font-size: 11px; margin-top: 15px;">Press ESC or click X to close</p>
      <div id="chat-messages"></div>
    `;
    
    inner.innerHTML = content;
  }

  async scrapeUserChat(username) {
    const { ipcRenderer } = require('electron');
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;
    
    // Add loading indicator for messages
    messagesDiv.innerHTML = `
      <div style="margin-top: 15px; padding: 15px; background: #2d2d44; border-radius: 12px;">
        <div style="color: #a0a0b0; font-size: 11px; margin-bottom: 10px; text-transform: uppercase;">💬 Recent Messages</div>
        <div style="color: #6272a4; font-size: 14px; text-align: center;">
          <span>⏳ Opening chat for ${username}...</span>
          <div style="font-size: 11px; margin-top: 5px; color: #ff6b9d;">Watch the browser on the right →</div>
        </div>
      </div>
    `;
    
    try {
      // Scrape chat in background (set showBrowser: true for debugging)
      const chatData = await ipcRenderer.invoke('scrape-user-chat', username, { showBrowser: false });
      
      console.log('Chat data received:', chatData);
      
      if (chatData && chatData.messages && chatData.messages.length > 0) {
        const messages = chatData.messages.slice(0, 3); // Last 3 messages
        messagesDiv.innerHTML = `
          <div style="margin-top: 15px; padding: 15px; background: #2d2d44; border-radius: 12px;">
            <div style="color: #a0a0b0; font-size: 11px; margin-bottom: 10px; text-transform: uppercase;">💬 Recent Messages (${messages.length})</div>
            ${messages.map((msg, i) => `
              <div style="padding: 10px; margin: 5px 0; background: ${msg.isMe ? 'linear-gradient(135deg, #c678dd, #ff6b9d)' : '#3d3d5c'}; border-radius: 12px; ${msg.isMe ? 'margin-left: 20px;' : 'margin-right: 20px;'}">
                <div style="font-size: 10px; color: ${msg.isMe ? 'rgba(255,255,255,0.7)' : '#6272a4'}; margin-bottom: 4px;">${msg.isMe ? 'You' : username}</div>
                <div style="color: #ffffff; font-size: 14px;">${msg.text}</div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        // Show debug info
        const debugInfo = chatData?.debug ? `<div style="font-size: 10px; color: #6272a4; margin-top: 10px;">Debug: Found ${chatData.debug.foundElements || 0} elements</div>` : '';
        messagesDiv.innerHTML = `
          <div style="margin-top: 15px; padding: 15px; background: #2d2d44; border-radius: 12px;">
            <div style="color: #a0a0b0; font-size: 11px; margin-bottom: 10px; text-transform: uppercase;">💬 Messages</div>
            <div style="color: #6272a4; font-size: 14px; text-align: center;">
              Click "Open Chat" to start a conversation
            </div>
            ${debugInfo}
          </div>
        `;
      }
    } catch (error) {
      console.error('Failed to scrape chat:', error);
      messagesDiv.innerHTML = `
        <div style="margin-top: 15px; padding: 15px; background: #2d2d44; border-radius: 12px;">
          <div style="color: #6272a4; font-size: 14px; text-align: center;">
            💬 Open Chat to see messages
          </div>
        </div>
      `;
    }
  }

  showWelcomeDialog() {
    this.queueDialog({
      name: 'System',
      icon: '🎮',
      text: 'Welcome to InstaPokéWorld! A 3D Instagram experience awaits you.'
    });
    this.queueDialog({
      name: 'System',
      icon: '🎮',
      text: 'Use WASD to move around. Press E near buildings to interact!'
    });
    this.queueDialog({
      name: 'System',
      icon: '🎮',
      text: 'Capture your Instagram window to populate this world with real data!'
    });
    this.showNextDialog();
  }

  showNPCDialog(npcName) {
    const dialogues = {
      'Story Keeper': [
        { name: 'Story Keeper', icon: '📖', text: 'Stories are fleeting moments captured in time...' },
        { name: 'Story Keeper', icon: '📖', text: 'They disappear after 24 hours, like cherry blossoms in spring!' }
      ],
      'Message Carrier': [
        { name: 'Message Carrier', icon: '💬', text: 'I deliver messages across the digital realm!' },
        { name: 'Message Carrier', icon: '💬', text: 'DMs are where real connections happen.' }
      ],
      'Post Master': [
        { name: 'Post Master', icon: '🖼️', text: 'Every post tells a story...' },
        { name: 'Post Master', icon: '🖼️', text: 'The grid is your gallery. Make it beautiful!' }
      ]
    };

    const npcDialogs = dialogues[npcName] || [
      { name: npcName, icon: '👤', text: 'Hello, trainer! Keep exploring!' }
    ];

    npcDialogs.forEach(d => this.queueDialog(d));
    this.showNextDialog();
  }

  queueDialog(dialog) {
    this.dialogQueue.push(dialog);
  }

  showNextDialog() {
    if (this.dialogQueue.length === 0) {
      this.hideDialog();
      return;
    }

    this.currentDialog = this.dialogQueue.shift();
    this.displayDialog(this.currentDialog);
  }

  displayDialog(dialog) {
    const dialogBox = document.getElementById('dialog-box');
    const portrait = document.getElementById('npc-portrait');
    const nameEl = document.getElementById('dialog-name');
    const textEl = document.getElementById('dialog-text');

    dialogBox.classList.remove('hidden');
    portrait.textContent = dialog.icon;
    nameEl.textContent = dialog.name;
    
    // Typewriter effect
    this.typeText(textEl, dialog.text);
  }

  typeText(element, text) {
    this.isTyping = true;
    element.textContent = '';
    let i = 0;
    
    const type = () => {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        setTimeout(type, 30);
      } else {
        this.isTyping = false;
      }
    };
    
    type();
  }

  advanceDialog() {
    if (this.isTyping) {
      // Skip to end of text
      const textEl = document.getElementById('dialog-text');
      if (this.currentDialog) {
        textEl.textContent = this.currentDialog.text;
        this.isTyping = false;
      }
    } else if (this.dialogQueue.length > 0) {
      this.showNextDialog();
    } else {
      this.hideDialog();
    }
  }

  hideDialog() {
    const dialogBox = document.getElementById('dialog-box');
    dialogBox.classList.add('hidden');
    this.currentDialog = null;
  }

  showInteractionMenu() {
    const menu = document.getElementById('interaction-menu');
    menu.classList.remove('hidden');
    this.state = 'menu';
  }

  hideInteractionMenu() {
    const menu = document.getElementById('interaction-menu');
    menu.classList.add('hidden');
    this.state = 'playing';
  }

  toggleMenu() {
    const menu = document.getElementById('interaction-menu');
    if (menu.classList.contains('hidden')) {
      this.showInteractionMenu();
    } else {
      this.hideInteractionMenu();
    }
  }

  showContent(type) {
    const viewer = document.getElementById('content-viewer');
    const inner = document.getElementById('viewer-inner');
    
    viewer.classList.remove('hidden');
    this.state = 'viewing';
    
    let content = '';
    
    switch (type) {
      case 'stories':
        content = this.renderStories();
        break;
      case 'posts':
        content = this.renderPosts();
        break;
      case 'messages':
        content = this.renderMessages();
        break;
      case 'explore':
        content = this.renderExplore();
        break;
    }
    
    inner.innerHTML = content;
  }

  renderStories() {
    const stories = this.instagramData.stories;
    
    return `
      <h2 style="font-family: 'Press Start 2P'; font-size: 16px; color: #ff6b9d; margin-bottom: 20px;">📖 Stories</h2>
      <div class="story-list">
        ${stories.map(story => `
          <div class="story-card" data-story-id="${story.id}">
            <div class="story-ring" style="${story.viewed ? 'background: #333;' : ''}">
              <div class="story-avatar">${story.avatar}</div>
            </div>
            <span class="story-name">${story.username}</span>
          </div>
        `).join('')}
      </div>
      <div style="margin-top: 30px; text-align: center; color: #6272a4;">
        <p>Capture your Instagram window to see real stories!</p>
      </div>
    `;
  }

  renderPosts() {
    const posts = this.instagramData.posts;
    
    return `
      <h2 style="font-family: 'Press Start 2P'; font-size: 16px; color: #c678dd; margin-bottom: 20px;">🖼️ Posts</h2>
      <div class="content-grid">
        ${posts.map(post => `
          <div class="content-card">
            <div style="width: 100%; aspect-ratio: 1; background: ${post.image}; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; font-size: 48px;">
              ${post.avatar}
            </div>
            <p style="font-weight: bold; margin-bottom: 5px;">${post.username}</p>
            <p>${post.caption}</p>
            <p style="color: #6272a4; margin-top: 10px;">❤️ ${post.likes.toLocaleString()} · 💬 ${post.comments}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderMessages() {
    const messages = this.instagramData.messages;
    
    return `
      <h2 style="font-family: 'Press Start 2P'; font-size: 16px; color: #61dafb; margin-bottom: 20px;">💬 Messages</h2>
      <div class="message-list">
        ${messages.map(msg => `
          <div class="message-card" style="${msg.unread ? 'border-color: #61dafb;' : ''}">
            <div class="message-avatar">${msg.avatar}</div>
            <div class="message-content">
              <span class="message-name">${msg.username}${msg.unread ? ' <span style="color: #61dafb;">●</span>' : ''}</span>
              <p class="message-text">${msg.text}</p>
              <span class="message-time">${this.formatTime(msg.timestamp)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderExplore() {
    return `
      <h2 style="font-family: 'Press Start 2P'; font-size: 16px; color: #ffd93d; margin-bottom: 20px;">🔍 Explore</h2>
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 80px; margin-bottom: 20px;">🌎</div>
        <h3 style="font-family: 'Press Start 2P'; font-size: 14px; margin-bottom: 15px;">Discover Content</h3>
        <p style="color: #a0a0b0; max-width: 400px; margin: 0 auto;">
          The Explore Zone shows trending content from across Instagram. 
          Capture your browser window to see personalized recommendations!
        </p>
        <div style="display: flex; gap: 20px; justify-content: center; margin-top: 30px;">
          <div style="background: linear-gradient(135deg, #ff6b9d, #c678dd); width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; font-size: 36px;">📸</div>
          <div style="background: linear-gradient(135deg, #61dafb, #c678dd); width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; font-size: 36px;">🎬</div>
          <div style="background: linear-gradient(135deg, #ffd93d, #ff6b9d); width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; font-size: 36px;">🎵</div>
        </div>
      </div>
    `;
  }

  formatTime(timestamp) {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  hideContent() {
    const viewer = document.getElementById('content-viewer');
    viewer.classList.add('hidden');
    this.state = 'playing';
  }

  togglePause() {
    const pauseMenu = document.getElementById('pause-menu');
    
    if (this.state === 'paused') {
      pauseMenu.classList.add('hidden');
      this.state = 'playing';
    } else if (this.state === 'playing') {
      pauseMenu.classList.remove('hidden');
      this.state = 'paused';
    }
  }

  resume() {
    this.togglePause();
  }

  updateMinimap() {
    if (!this.renderer) return;
    const canvas = document.getElementById('minimap-canvas');
    if (canvas) {
      this.renderer.renderMinimap(canvas);
    }
  }

  updateStats() {
    const postsCount = this.instagramData.posts.length;
    const maxPosts = 10;
    
    document.getElementById('posts-count').textContent = postsCount;
    document.getElementById('posts-bar').style.width = `${(postsCount / maxPosts) * 100}%`;
  }

  setInstagramData(data) {
    console.log('Setting Instagram data:', data);
    if (data.stories) this.instagramData.stories = data.stories;
    if (data.posts) this.instagramData.posts = data.posts;
    if (data.messages) this.instagramData.messages = data.messages;
    if (data.profile) this.instagramData.profile = data.profile;
    
    this.updateStats();
    
    // Populate the 3D world with friends if renderer exists
    if (this.renderer) {
      this.renderer.populateWithFriends(data);
    }
    
    // Show notification
    this.queueDialog({
      name: 'System',
      icon: '✨',
      text: 'Instagram data has been captured and loaded into the world!'
    });
    this.showNextDialog();
  }
}

window.InstagramGame = InstagramGame;


