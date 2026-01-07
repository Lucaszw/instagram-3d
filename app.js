// ========================================
// CreativeInstagram - Application Controller
// Handles UI, window capture, and IPC communication
// ========================================

const { ipcRenderer } = require('electron');

class App {
  constructor() {
    this.game = new InstagramGame();
    this.selectedWindowId = null;
    this.isCapturing = false;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    
    // Load saved data with a small delay to ensure ipcRenderer is ready
    setTimeout(() => {
      this.loadSavedData();
    }, 500);
    
    // Show title screen
    this.showScreen('title-screen');
  }

  setupEventListeners() {
    // Title screen buttons
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('login-btn').addEventListener('click', () => this.openInstagramBrowser());
    document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());

    // Instagram browser controls
    document.getElementById('ig-close').addEventListener('click', () => this.closeInstagramBrowser());
    document.getElementById('ig-home').addEventListener('click', () => this.navigateInstagram('/'));
    document.getElementById('ig-inbox').addEventListener('click', () => this.navigateInstagram('/direct/inbox/'));
    document.getElementById('ig-explore').addEventListener('click', () => this.navigateInstagram('/explore/'));
    document.getElementById('ig-reels').addEventListener('click', () => this.navigateInstagram('/reels/'));
    document.getElementById('ig-notifications').addEventListener('click', () => this.navigateInstagram('/accounts/activity/'));
    document.getElementById('ig-dump').addEventListener('click', () => this.dumpCurrentPage());
    document.getElementById('ig-scrape').addEventListener('click', () => this.scrapeCurrentPage());
    document.getElementById('ig-auto').addEventListener('click', () => this.autoScrapeAll());
    document.getElementById('ig-restore').addEventListener('click', () => {
      console.log('Restore button clicked');
      this.showRestorePanel();
    });
    document.getElementById('ig-play').addEventListener('click', () => {
      console.log('Play button clicked');
      this.playWithScrapedData();
    });
    document.getElementById('close-debug').addEventListener('click', () => this.hideDebugPanel());
    document.getElementById('close-restore').addEventListener('click', () => this.hideRestorePanel());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.getCurrentScreen() === 'title-screen') {
        this.startGame();
      }
    });

    // Capture modal
    document.getElementById('close-capture').addEventListener('click', () => this.closeCaptureModal());
    document.getElementById('refresh-windows').addEventListener('click', () => this.loadWindowList());
    document.getElementById('start-capture').addEventListener('click', () => this.startCapture());

    // Window list clicks
    document.getElementById('window-list').addEventListener('click', (e) => {
      const windowItem = e.target.closest('.window-item');
      if (windowItem) {
        this.selectWindow(windowItem.dataset.windowId);
      }
    });

    // Interaction menu
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.game.hideInteractionMenu();
        this.game.showContent(action);
      });
    });

    // Content viewer close
    document.getElementById('close-viewer').addEventListener('click', () => {
      this.game.hideContent();
    });

    // Pause menu
    document.getElementById('resume-btn').addEventListener('click', () => this.game.resume());
    document.getElementById('recapture-btn').addEventListener('click', () => {
      this.game.togglePause();
      this.openCaptureModal();
    });
    document.getElementById('exit-btn').addEventListener('click', () => this.exitToTitle());

    // Click outside to close
    document.getElementById('capture-modal').addEventListener('click', (e) => {
      if (e.target.id === 'capture-modal') {
        this.closeCaptureModal();
      }
    });

    document.querySelector('.viewer-backdrop')?.addEventListener('click', () => {
      this.game.hideContent();
    });

    // Permission prompt buttons
    document.getElementById('open-preferences').addEventListener('click', () => this.openSystemPreferences());
    document.getElementById('restart-app').addEventListener('click', () => this.restartApp());
    document.getElementById('use-demo').addEventListener('click', () => this.startWithDemo());
  }

  startWithDemo() {
    // Use the existing mock data and start the game
    this.closeCaptureModal();
    this.startGame();
  }

  async restartApp() {
    await ipcRenderer.invoke('restart-app');
  }

  // ========================================
  // Instagram Browser Methods
  // ========================================

  async openInstagramBrowser() {
    const overlay = document.getElementById('instagram-overlay');
    overlay.classList.remove('hidden');
    
    this.updateBrowserStatus('Loading Instagram...');
    
    await ipcRenderer.invoke('open-instagram-browser');
    
    this.updateBrowserStatus('Log in to your Instagram account, then click "✨ Scrape & Play" to enter the 3D world!');
  }

  async closeInstagramBrowser() {
    await ipcRenderer.invoke('close-instagram-browser');
    document.getElementById('instagram-overlay').classList.add('hidden');
    
    // Small delay to ensure overlay is fully hidden
    await this.delay(100);
  }

  async navigateInstagram(path) {
    this.updateBrowserStatus(`Navigating to ${path}...`);
    await ipcRenderer.invoke('instagram-navigate', path);
    this.updateBrowserStatus(`On ${path} - Click "✨ Scrape" to collect data from this page`);
  }

  async dumpCurrentPage() {
    this.updateBrowserStatus('📥 Dumping HTML...');
    const url = await ipcRenderer.invoke('instagram-get-url');
    const pageName = url.split('/').filter(p => p).pop() || 'home';
    
    const result = await ipcRenderer.invoke('dump-html', pageName);
    
    if (result.error) {
      this.updateBrowserStatus(`Error: ${result.error}`);
    } else {
      this.updateBrowserStatus(`✅ Saved HTML (${Math.round(result.size/1024)}KB) to: ${result.filepath}`);
      console.log('HTML dumped to:', result.filepath);
    }
  }

  async scrapeCurrentPage() {
    this.updateBrowserStatus('🔍 Scraping current page...');
    
    const data = await ipcRenderer.invoke('scrape-instagram-advanced');
    
    if (data.error) {
      this.updateBrowserStatus(`Error: ${data.error}`);
      return;
    }

    console.log('Advanced scrape data:', data);
    
    // Store scraped data
    this.scrapedData = this.scrapedData || { 
      stories: [], 
      posts: [], 
      messages: [], 
      notifications: [],
      mutuals: [],
      suggestions: [],
      usernames: new Set() 
    };
    
    // Merge new data
    data.stories.forEach(s => {
      if (!this.scrapedData.stories.find(x => x.username === s.username)) {
        this.scrapedData.stories.push(s);
      }
    });
    
    data.posts.forEach(p => {
      if (!this.scrapedData.posts.find(x => x.username === p.username && x.caption === p.caption)) {
        this.scrapedData.posts.push(p);
      }
    });
    
    data.messages.forEach(m => {
      if (!this.scrapedData.messages.find(x => x.username === m.username)) {
        this.scrapedData.messages.push(m);
      }
    });
    
    // Merge notifications
    (data.notifications || []).forEach(n => {
      if (!this.scrapedData.notifications.find(x => x.username === n.username && x.type === n.type)) {
        this.scrapedData.notifications.push(n);
      }
    });
    
    // Merge mutuals
    (data.mutuals || []).forEach(m => {
      if (!this.scrapedData.mutuals.find(x => x.username === m.username)) {
        this.scrapedData.mutuals.push(m);
      }
    });
    
    // Merge suggestions
    (data.suggestions || []).forEach(s => {
      if (!this.scrapedData.suggestions.find(x => x.username === s.username)) {
        this.scrapedData.suggestions.push(s);
      }
    });
    
    data.rawUsernames.forEach(u => this.scrapedData.usernames.add(u));
    
    // Show debug panel
    this.showDebugPanel(data);
    
    const stats = [
      `📍 ${data.pageType}`,
      `📖 ${this.scrapedData.stories.length}`,
      `📝 ${this.scrapedData.posts.length}`,
      `💬 ${this.scrapedData.messages.length}`,
      `🔔 ${this.scrapedData.notifications.length}`,
      `👥 ${this.scrapedData.usernames.size}`
    ];
    this.updateBrowserStatus(`✅ ${stats.join(' | ')} — Navigate more pages & scrape again, or click 🎮 Play!`);
  }

  showDebugPanel(data) {
    const panel = document.getElementById('debug-panel');
    const content = document.getElementById('debug-content');
    
    panel.classList.remove('hidden');
    
    let html = `
      <div class="debug-section">
        <h4>📍 Page Info</h4>
        <div class="debug-item">
          Type: <span class="debug-username">${data.pageType}</span><br>
          Logged In: ${data.loggedIn ? '✅' : '❌'}<br>
          Dump: ${data.dumpPath ? '📁 Saved' : '—'}
        </div>
      </div>

      <div class="debug-section">
        <h4>📊 Element Counts</h4>
        <div class="debug-item">
          Articles: ${data.elementCounts?.articles || 0} | 
          Images: ${data.elementCounts?.images || 0} | 
          Links: ${data.elementCounts?.links || 0}
        </div>
      </div>

      <div class="debug-section">
        <h4>📖 Stories <span class="debug-count">${data.stories?.length || 0}</span></h4>
        ${(data.stories || []).slice(0, 10).map(s => `
          <div class="debug-item ${s.hasUnwatched ? 'unread' : ''}">
            <span class="debug-username">@${s.username}</span>
            ${s.hasUnwatched ? ' 🔵' : ' ✓'}
          </div>
        `).join('')}
      </div>

      <div class="debug-section">
        <h4>📝 Posts <span class="debug-count">${data.posts?.length || 0}</span></h4>
        ${(data.posts || []).slice(0, 5).map(p => `
          <div class="debug-item">
            <span class="debug-username">@${p.username}</span>
            ${p.likes ? ` ❤️ ${p.likes}` : ''}
            ${p.isVideo ? ' 🎬' : ' 📷'}
            <div class="debug-preview">${(p.caption || '').substring(0, 50)}...</div>
          </div>
        `).join('')}
      </div>

      <div class="debug-section">
        <h4>💬 Messages <span class="debug-count">${data.messages?.length || 0}</span></h4>
        ${(data.messages || []).slice(0, 8).map(m => `
          <div class="debug-item ${m.unread ? 'unread' : ''}">
            <span class="debug-username">${m.username}</span>
            ${m.unread ? ' 🔵' : ''}
            ${m.isGroup ? ' 👥' : ''}
            <div class="debug-preview">${(m.preview || '').substring(0, 40)}</div>
          </div>
        `).join('')}
      </div>

      <div class="debug-section">
        <h4>🔔 Notifications <span class="debug-count">${data.notifications?.length || 0}</span></h4>
        ${(data.notifications || []).slice(0, 8).map(n => `
          <div class="debug-item">
            <span class="debug-username">@${n.username}</span>
            ${n.type === 'follow' ? '👤 followed you' : ''}
            ${n.type === 'like' ? `❤️ liked your ${n.contentType || 'post'}` : ''}
            ${n.type === 'story_like' ? '⭐ liked your story' : ''}
            ${n.type === 'comment' ? '💬 commented' : ''}
            ${n.type === 'mention' ? '📢 mentioned you' : ''}
          </div>
        `).join('')}
      </div>

      <div class="debug-section">
        <h4>🤝 Mutuals / Connections <span class="debug-count">${data.mutuals?.length || 0}</span></h4>
        ${(data.mutuals || []).slice(0, 5).map(m => `
          <div class="debug-item">
            ${m.type === 'followed_by' ? `Followed by <span class="debug-username">@${m.username}</span>` : ''}
            ${m.type === 'follows_you' ? '✅ Follows you' : ''}
            ${m.type === 'mutual_friends' ? `👥 ${m.preview}` : ''}
            ${m.count ? `📊 ${m.type}: ${m.count}` : ''}
          </div>
        `).join('')}
      </div>

      <div class="debug-section">
        <h4>👥 Suggestions <span class="debug-count">${data.suggestions?.length || 0}</span></h4>
        ${(data.suggestions || []).slice(0, 5).map(s => `
          <div class="debug-item">
            <span class="debug-username">@${s.username}</span>
            <span class="debug-preview">${s.reason}</span>
          </div>
        `).join('')}
      </div>

      <div class="debug-section">
        <h4>🔗 Raw Usernames <span class="debug-count">${data.rawUsernames?.length || 0}</span></h4>
        <div class="debug-item">
          ${(data.rawUsernames || []).slice(0, 20).map(u => `@${u}`).join(', ')}
        </div>
      </div>
    `;
    
    content.innerHTML = html;
  }

  hideDebugPanel() {
    document.getElementById('debug-panel').classList.add('hidden');
  }

  async playWithScrapedData() {
    if (!this.scrapedData || this.scrapedData.usernames.size === 0) {
      this.updateBrowserStatus('⚠️ No data scraped yet! Navigate around and click "✨ Scrape" first.');
      return;
    }
    
    this.updateBrowserStatus('🎮 Building your Instagram world...');
    
    // Process all collected data
    const processedData = this.processScrapedData({
      stories: this.scrapedData.stories,
      posts: this.scrapedData.posts,
      messages: this.scrapedData.messages,
      suggestions: this.scrapedData.suggestions,
      rawUsernames: Array.from(this.scrapedData.usernames)
    });
    
    // Add extra usernames as additional stories/messages if needed
    const extraUsernames = Array.from(this.scrapedData.usernames)
      .filter(u => !processedData.stories.find(s => s.username === u))
      .slice(0, 10);
    
    extraUsernames.forEach((username, i) => {
      if (processedData.stories.length < 12) {
        processedData.stories.push({
          id: processedData.stories.length + 1,
          username,
          avatar: this.getEmojiForUser(username),
          viewed: i > 3,
          timestamp: Date.now() - (i * 3600000)
        });
      }
    });
    
    console.log('Final processed data:', processedData);
    
    // Save and apply
    this.game.setInstagramData(processedData);
    await ipcRenderer.invoke('save-data', processedData);
    
    await this.delay(1000);
    
    await this.closeInstagramBrowser();
    this.startGame();
  }

  getEmojiForUser(name) {
    const emojis = ['👤', '👩', '👨', '🧑', '👧', '👦', '🧔', '👩‍🦰', '👨‍🦱', '👩‍🦳', '🧑‍🎤', '👩‍💻', '👨‍🎨', '🧑‍🚀', '👩‍🔬', '🎭', '🎨', '📸', '🎵', '✨'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
    }
    return emojis[Math.abs(hash) % emojis.length];
  }

  // Legacy method - kept for compatibility
  async scrapeAndPlay() {
    await this.scrapeCurrentPage();
    await this.playWithScrapedData();
  }

  // ========================================
  // AUTO SCRAPE - Navigate and collect all data
  // ========================================
  
  async autoScrapeAll() {
    const pages = [
      { path: '/', name: 'Home Feed', icon: '🏠', description: 'Collecting stories and posts from your feed...' },
      { path: '/direct/inbox/', name: 'Messages', icon: '💬', description: 'Gathering your conversations and DMs...' },
      { path: '/accounts/activity/', name: 'Notifications', icon: '❤️', description: 'Finding who liked, followed, and commented...' },
      { path: '/explore/', name: 'Explore', icon: '🔍', description: 'Discovering trending content...' },
      // Add user's own profile (gets following/followers)
      { path: '/accounts/edit/', name: 'Profile', icon: '👤', description: 'Getting your profile info...' },
    ];

    this.isAutoScraping = true;
    this.disableButtons(true);

    // Reset scraped data for fresh collection
    this.scrapedData = { 
      stories: [], 
      posts: [], 
      messages: [], 
      notifications: [],
      mutuals: [],
      suggestions: [],
      usernames: new Set() 
    };

    this.updateBrowserStatus('🤖 Starting auto-scrape...');
    await this.delay(1000);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const progress = `[${i + 1}/${pages.length}]`;
      
      // Navigate
      this.updateBrowserStatus(`${progress} ${page.icon} Navigating to ${page.name}...`);
      await ipcRenderer.invoke('instagram-navigate', page.path);
      await this.delay(2000); // Wait for page to load
      
      // Scrape
      this.updateBrowserStatus(`${progress} ${page.icon} ${page.description}`);
      await this.delay(500);
      
      const data = await ipcRenderer.invoke('scrape-instagram-advanced');
      
      if (data && !data.error) {
        // Merge data
        this.mergeScrapedData(data);
        
        const stats = this.getScrapedStats();
        this.updateBrowserStatus(`${progress} ✅ ${page.name} done! ${stats}`);
        
        // Show debug panel with latest data
        this.showDebugPanel(data);
      } else {
        this.updateBrowserStatus(`${progress} ⚠️ ${page.name} - Could not scrape (${data?.error || 'unknown error'})`);
      }
      
      await this.delay(1500);
    }

    // Final summary
    const finalStats = this.getScrapedStats();
    this.updateBrowserStatus(`🎉 Auto-scrape complete! ${finalStats} — Click 🎮 Play to enter the world!`);
    
    this.disableButtons(false);
    this.isAutoScraping = false;

    // Auto-play after a short delay
    await this.delay(2000);
    
    if (this.scrapedData.usernames.size > 0) {
      this.updateBrowserStatus('🎮 Launching CreativeInstagram...');
      await this.delay(1000);
      await this.playWithScrapedData();
    }
  }

  mergeScrapedData(data) {
    // Merge stories
    (data.stories || []).forEach(s => {
      if (!this.scrapedData.stories.find(x => x.username === s.username)) {
        this.scrapedData.stories.push(s);
      }
    });
    
    // Merge posts
    (data.posts || []).forEach(p => {
      if (!this.scrapedData.posts.find(x => x.username === p.username && x.caption === p.caption)) {
        this.scrapedData.posts.push(p);
      }
    });
    
    // Merge messages
    (data.messages || []).forEach(m => {
      if (!this.scrapedData.messages.find(x => x.username === m.username)) {
        this.scrapedData.messages.push(m);
      }
    });
    
    // Merge notifications
    (data.notifications || []).forEach(n => {
      if (!this.scrapedData.notifications.find(x => x.username === n.username && x.type === n.type)) {
        this.scrapedData.notifications.push(n);
      }
    });
    
    // Merge mutuals
    (data.mutuals || []).forEach(m => {
      if (!this.scrapedData.mutuals.find(x => x.username === m.username)) {
        this.scrapedData.mutuals.push(m);
      }
    });
    
    // Merge suggestions
    (data.suggestions || []).forEach(s => {
      if (!this.scrapedData.suggestions.find(x => x.username === s.username)) {
        this.scrapedData.suggestions.push(s);
      }
    });
    
    // Merge usernames
    (data.rawUsernames || []).forEach(u => this.scrapedData.usernames.add(u));
  }

  getScrapedStats() {
    return [
      `📖${this.scrapedData.stories.length}`,
      `💬${this.scrapedData.messages.length}`,
      `📝${this.scrapedData.posts.length}`,
      `🔔${this.scrapedData.notifications.length}`,
      `👥${this.scrapedData.usernames.size}`
    ].join(' ');
  }

  disableButtons(disabled) {
    const buttons = ['ig-home', 'ig-inbox', 'ig-explore', 'ig-reels', 'ig-notifications', 
                     'ig-dump', 'ig-scrape', 'ig-auto', 'ig-restore', 'ig-play'];
    buttons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = disabled;
    });
  }

  // ========================================
  // RESTORE - Load previous scrape dumps
  // ========================================
  
  async showRestorePanel() {
    const panel = document.getElementById('restore-panel');
    const content = document.getElementById('restore-content');
    
    // Hide the browser view so the panel is visible
    await ipcRenderer.invoke('hide-browser-view');
    
    panel.classList.remove('hidden');
    content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading dumps...</p></div>';
    
    const dumps = await ipcRenderer.invoke('list-dumps');
    
    if (dumps.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-dim);">
          <div style="font-size: 40px; margin-bottom: 15px;">📭</div>
          <p>No previous scrapes found.</p>
          <p style="font-size: 12px; margin-top: 10px;">Use Auto or Scrape to collect data first!</p>
        </div>
      `;
      return;
    }
    
    // Store dumps for loading all
    this.availableDumps = dumps;
    
    // Group dumps by date
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    // Calculate total stats
    const totalStats = dumps.reduce((acc, d) => ({
      stories: acc.stories + (d.stories || 0),
      messages: acc.messages + (d.messages || 0),
      posts: acc.posts + (d.posts || 0),
      usernames: acc.usernames + (d.usernames || 0)
    }), { stories: 0, messages: 0, posts: 0, usernames: 0 });
    
    // Add "Load All" button at the top
    content.innerHTML = `
      <div class="restore-item load-all" style="background: linear-gradient(135deg, #ff6b9d, #c678dd); border-color: #ff6b9d; margin-bottom: 15px;">
        <div class="restore-item-header">
          <span style="font-family: 'Press Start 2P'; font-size: 10px;">🔄 LOAD ALL SCRAPES</span>
          <span>${dumps.length} files</span>
        </div>
        <div class="restore-item-stats">
          <span>📖 ${totalStats.stories}</span>
          <span>💬 ${totalStats.messages}</span>
          <span>📝 ${totalStats.posts}</span>
          <span>👥 ${totalStats.usernames}</span>
        </div>
      </div>
    ` + dumps.map(dump => {
      const dumpDate = new Date(dump.date);
      const dateStr = dumpDate.toDateString();
      const timeStr = dumpDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      let dateLabel = timeStr;
      if (dateStr === today) dateLabel = `Today ${timeStr}`;
      else if (dateStr === yesterday) dateLabel = `Yesterday ${timeStr}`;
      else dateLabel = dumpDate.toLocaleDateString() + ' ' + timeStr;
      
      const pageIcon = {
        'home': '🏠',
        'messages': '💬',
        'profile': '👤',
        'explore': '🔍',
        'reels': '🎬',
        'unknown': '📄'
      }[dump.pageType] || '📄';
      
      return `
        <div class="restore-item" data-filepath="${dump.filepath}">
          <div class="restore-item-header">
            <span class="restore-item-type">${pageIcon} ${dump.pageType}</span>
            <span class="restore-item-date">${dateLabel}</span>
          </div>
          <div class="restore-item-stats">
            <span>📖 ${dump.stories}</span>
            <span>💬 ${dump.messages}</span>
            <span>📝 ${dump.posts}</span>
            <span>🔔 ${dump.notifications}</span>
            <span>👥 ${dump.usernames}</span>
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handler for "Load All"
    content.querySelector('.load-all').addEventListener('click', () => this.loadAllDumps());
    
    // Add click handlers for individual items
    content.querySelectorAll('.restore-item:not(.load-all)').forEach(item => {
      item.addEventListener('click', () => this.loadDump(item.dataset.filepath));
    });
  }

  async loadAllDumps() {
    if (!this.availableDumps || this.availableDumps.length === 0) return;
    
    this.updateBrowserStatus(`🔄 Loading all ${this.availableDumps.length} scrapes...`);
    
    // Reset scraped data
    this.scrapedData = { 
      stories: [], posts: [], messages: [], notifications: [], mutuals: [], suggestions: [], usernames: new Set() 
    };
    
    let loaded = 0;
    for (const dump of this.availableDumps) {
      const data = await ipcRenderer.invoke('load-dump', dump.filepath);
      if (data && !data.error) {
        this.mergeScrapedData(data);
        loaded++;
      }
    }
    
    const stats = this.getScrapedStats();
    this.updateBrowserStatus(`✅ Loaded ${loaded} scrapes! ${stats} — Click 🎮 Play to enter the world!`);
    
    // Show combined stats in debug panel
    this.showDebugPanel({
      stories: this.scrapedData.stories,
      posts: this.scrapedData.posts,
      messages: this.scrapedData.messages,
      notifications: this.scrapedData.notifications,
      mutuals: this.scrapedData.mutuals,
      suggestions: this.scrapedData.suggestions,
      usernames: Array.from(this.scrapedData.usernames)
    });
    
    await this.hideRestorePanel();
  }

  async hideRestorePanel() {
    document.getElementById('restore-panel').classList.add('hidden');
    // Show the browser view again
    await ipcRenderer.invoke('show-browser-view');
  }

  async loadDump(filepath) {
    this.updateBrowserStatus(`📂 Loading ${filepath.split('/').pop()}...`);
    
    const data = await ipcRenderer.invoke('load-dump', filepath);
    
    if (data.error) {
      this.updateBrowserStatus(`❌ Error loading: ${data.error}`);
      return;
    }
    
    // Initialize scraped data if needed
    this.scrapedData = this.scrapedData || { 
      stories: [], posts: [], messages: [], notifications: [], mutuals: [], suggestions: [], usernames: new Set() 
    };
    
    // Merge the loaded data
    this.mergeScrapedData(data);
    
    // Show in debug panel
    this.showDebugPanel(data);
    
    const stats = this.getScrapedStats();
    this.updateBrowserStatus(`✅ Loaded! ${stats} — Load more dumps or click 🎮 Play`);
    
    this.hideRestorePanel();
  }

  processScrapedData(data) {
    const emojis = ['👤', '👩', '👨', '🧑', '👧', '👦', '🧔', '👩‍🦰', '👨‍🦱', '👩‍🦳', '🧑‍🎤', '👩‍💻', '👨‍🎨', '🧑‍🚀', '👩‍🔬', '🎭', '🎨', '📸', '🎵', '✨'];
    const gradients = [
      'linear-gradient(135deg, #ff6b9d, #c678dd)',
      'linear-gradient(135deg, #61dafb, #c678dd)',
      'linear-gradient(135deg, #ffd93d, #ff6b9d)',
      'linear-gradient(135deg, #98c379, #61dafb)',
      'linear-gradient(135deg, #e06c75, #ffd93d)',
      'linear-gradient(135deg, #c678dd, #61dafb)'
    ];

    const getEmoji = (name) => {
      let hash = 0;
      for (let i = 0; i < (name || '').length; i++) {
        hash = ((hash << 5) - hash) + name.charCodeAt(i);
      }
      return emojis[Math.abs(hash) % emojis.length];
    };

    return {
      stories: (data.stories || []).map((s, i) => ({
        ...s,
        avatar: getEmoji(s.username),
        timestamp: Date.now() - (i * 3600000)
      })),
      posts: (data.posts || []).map((p, i) => ({
        ...p,
        avatar: getEmoji(p.username),
        image: gradients[i % gradients.length],
        comments: Math.floor((p.likes || 100) * 0.05),
        timestamp: Date.now() - (i * 86400000)
      })),
      messages: (data.messages || []).map((m, i) => ({
        ...m,
        avatar: getEmoji(m.username),
        timestamp: Date.now() - (i * 1800000)
      })),
      profile: {
        username: 'you',
        displayName: 'Your Profile',
        avatar: '🎮',
        posts: data.posts?.length || 0,
        followers: 1000,
        following: data.stories?.length || 0,
        bio: 'Exploring CreativeInstagram!'
      }
    };
  }

  updateBrowserStatus(message) {
    const status = document.getElementById('browser-status');
    if (status) {
      status.textContent = message;
    }
  }

  async openSystemPreferences() {
    await ipcRenderer.invoke('open-screen-preferences');
  }

  async checkPermission() {
    const status = await ipcRenderer.invoke('check-screen-permission');
    return status === 'granted';
  }

  getCurrentScreen() {
    return document.querySelector('.screen.active')?.id;
  }

  showScreen(screenId) {
    console.log('showScreen called with:', screenId);
    
    // Hide ALL screens completely
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
      screen.style.display = 'none';
      screen.style.opacity = '0';
      screen.style.zIndex = '0';
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.add('active');
      targetScreen.style.display = 'block';
      targetScreen.style.opacity = '1';
      targetScreen.style.zIndex = '100';
      targetScreen.style.visibility = 'visible';
      console.log('Screen activated:', screenId);
    }
  }

  startGame() {
    console.log('Starting game...');
    
    // FORCE hide title screen completely
    const titleScreen = document.getElementById('title-screen');
    titleScreen.style.cssText = 'display: none !important; visibility: hidden !important;';
    
    // Make sure we're on the game screen
    this.showScreen('game-screen');
    
    // Use setTimeout to ensure layout is complete
    setTimeout(() => {
      const container = document.getElementById('game-container');
      const gameScreen = document.getElementById('game-screen');
      
      // Force dimensions and visibility directly
      gameScreen.style.cssText = `
        display: block !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: ${window.innerWidth}px !important;
        height: ${window.innerHeight}px !important;
        z-index: 100 !important;
        visibility: visible !important;
        opacity: 1 !important;
      `;
      container.style.cssText = `
        display: block !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: ${window.innerWidth}px !important;
        height: ${window.innerHeight}px !important;
      `;
      
      // Force reflow
      void gameScreen.offsetHeight;
      void container.offsetHeight;
      
      const bounds = container.getBoundingClientRect();
      console.log('Game container bounds after forcing:', bounds.width, 'x', bounds.height);
      console.log('Game screen offsetHeight:', gameScreen.offsetHeight);
      console.log('Container offsetHeight:', container.offsetHeight);
      
      if (!this.game.renderer) {
        console.log('Initializing game renderer...');
        this.game.start(container);
      } else {
        console.log('Game already initialized, resuming...');
        this.game.state = 'playing';
        this.game.renderer.onResize();
      }
      
      this.game.updateStats();
      
      // Show welcome message with scraped data
      if (this.scrapedData && this.scrapedData.usernames.size > 0) {
        setTimeout(() => {
          this.game.queueDialog({
            name: 'System',
            icon: '✨',
            text: `Welcome! Loaded ${this.scrapedData.stories.length} friends, ${this.scrapedData.messages.length} chats, and ${this.scrapedData.usernames.size} users into your world!`
          });
          this.game.showNextDialog();
        }, 500);
      }
    }, 100); // 100ms delay to ensure layout is complete
  }

  exitToTitle() {
    this.game.togglePause();
    this.showScreen('title-screen');
    this.game.state = 'title';
  }

  // Window Capture Methods
  async openCaptureModal() {
    const modal = document.getElementById('capture-modal');
    modal.classList.add('active');
    await this.loadWindowList();
  }

  closeCaptureModal() {
    const modal = document.getElementById('capture-modal');
    modal.classList.remove('active');
    this.selectedWindowId = null;
    document.getElementById('start-capture').disabled = true;
  }

  async loadWindowList() {
    const windowList = document.getElementById('window-list');
    const permissionPrompt = document.getElementById('permission-prompt');
    const windowSection = document.getElementById('window-section');
    
    // Always try to get sources first - sometimes permission check is wrong
    windowList.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Scanning windows...</p>
      </div>
    `;
    
    permissionPrompt.classList.add('hidden');
    windowSection.style.display = 'block';

    try {
      const sources = await ipcRenderer.invoke('get-sources');
      console.log('Got sources:', sources.length, sources.map(s => s.name));
      
      // Filter sources with actual thumbnails (length > 1000 means real image data)
      const workingSources = sources.filter(s => s.thumbnail && s.thumbnail.length > 1000);
      
      console.log(`Working sources: ${workingSources.length} of ${sources.length}`);
      
      if (workingSources.length === 0) {
        // Show permission prompt
        permissionPrompt.classList.remove('hidden');
        windowSection.style.display = 'none';
        return;
      }

      // Sort: Entire Screen first, then browsers
      const browserKeywords = ['instagram', 'chrome', 'firefox', 'safari', 'edge', 'brave', 'browser', 'arc'];
      const sortedSources = workingSources.sort((a, b) => {
        // Entire screen gets priority
        if (a.name.toLowerCase().includes('entire screen')) return -1;
        if (b.name.toLowerCase().includes('entire screen')) return 1;
        
        const aIsRelevant = browserKeywords.some(k => a.name.toLowerCase().includes(k));
        const bIsRelevant = browserKeywords.some(k => b.name.toLowerCase().includes(k));
        if (aIsRelevant && !bIsRelevant) return -1;
        if (!aIsRelevant && bIsRelevant) return 1;
        return 0;
      });

      windowList.innerHTML = sortedSources.map(source => `
        <div class="window-item" data-window-id="${source.id}">
          <img class="window-thumbnail" src="${source.thumbnail}" alt="${source.name}">
          <span class="window-name">
            ${source.appIcon ? `<img class="window-icon" src="${source.appIcon}" alt="">` : ''}
            ${this.escapeHtml(source.name)}
          </span>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading windows:', error);
      permissionPrompt.classList.remove('hidden');
      windowSection.style.display = 'none';
    }
  }

  selectWindow(windowId) {
    // Deselect all
    document.querySelectorAll('.window-item').forEach(item => {
      item.classList.remove('selected');
    });

    // Select clicked
    const selected = document.querySelector(`[data-window-id="${windowId}"]`);
    if (selected) {
      selected.classList.add('selected');
      this.selectedWindowId = windowId;
      document.getElementById('start-capture').disabled = false;
    }
  }

  async startCapture() {
    if (!this.selectedWindowId) return;

    this.isCapturing = true;
    const button = document.getElementById('start-capture');
    const originalText = button.textContent;
    
    // Show progress steps
    const updateStatus = (text) => {
      button.innerHTML = `<span class="spinner-inline"></span> ${text}`;
      button.disabled = true;
    };

    try {
      updateStatus('Capturing window...');
      
      // Capture the window
      const imageData = await ipcRenderer.invoke('capture-window', this.selectedWindowId);
      
      if (imageData) {
        updateStatus('Analyzing with OCR...');
        
        // Show a preview of what we captured
        this.showCapturePreview(imageData);
        
        // Process the captured image to extract Instagram data
        const extractedData = await this.processCapture(imageData);
        
        updateStatus('Populating world...');
        
        if (extractedData) {
          this.game.setInstagramData(extractedData);
          await ipcRenderer.invoke('save-data', extractedData);
          
          // Show success message
          this.showCaptureResult(extractedData);
        }

        // Wait a moment to show the result
        await this.delay(1500);
        
        this.closeCaptureModal();
        
        // Start game if on title screen
        if (this.getCurrentScreen() === 'title-screen') {
          this.startGame();
        }
      } else {
        this.showCaptureError('Failed to capture window. Make sure you have granted Screen Recording permission in System Preferences.');
      }
    } catch (error) {
      console.error('Capture error:', error);
      this.showCaptureError('An error occurred during capture. Please try again.');
    } finally {
      this.isCapturing = false;
      button.textContent = '▶ Start Capture';
      button.disabled = !this.selectedWindowId;
    }
  }

  showCapturePreview(imageData) {
    const windowList = document.getElementById('window-list');
    windowList.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center;">
        <p style="color: #61dafb; margin-bottom: 15px;">📸 Captured Screenshot:</p>
        <img src="${imageData}" style="max-width: 100%; max-height: 300px; border: 3px solid #ff6b9d; margin-bottom: 15px;">
        <p style="color: #a0a0b0;">Analyzing image for Instagram content...</p>
      </div>
    `;
  }

  showCaptureResult(data) {
    const windowList = document.getElementById('window-list');
    windowList.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
        <h3 style="font-family: 'Press Start 2P'; font-size: 14px; color: #98c379; margin-bottom: 20px;">Capture Complete!</h3>
        <div style="display: flex; justify-content: center; gap: 30px; margin-bottom: 20px;">
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #ff6b9d;">${data.stories?.length || 0}</div>
            <div style="color: #a0a0b0;">Stories</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #c678dd;">${data.posts?.length || 0}</div>
            <div style="color: #a0a0b0;">Posts</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #61dafb;">${data.messages?.length || 0}</div>
            <div style="color: #a0a0b0;">Messages</div>
          </div>
        </div>
        <p style="color: #a0a0b0;">Entering the 3D world...</p>
      </div>
    `;
  }

  showCaptureError(message) {
    const windowList = document.getElementById('window-list');
    windowList.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h3 style="font-family: 'Press Start 2P'; font-size: 12px; color: #e06c75; margin-bottom: 20px;">Capture Issue</h3>
        <p style="color: #a0a0b0; max-width: 400px; margin: 0 auto;">${message}</p>
        <button class="pixel-btn" style="margin-top: 20px;" onclick="window.app.loadWindowList()">🔄 Try Again</button>
      </div>
    `;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processCapture(imageData) {
    console.log('Processing captured image...');
    
    // Store the captured image for display in the world
    this.capturedImage = imageData;
    
    // Generate Instagram-style data
    // In a real app, this would use OCR - for now we create engaging demo content
    const capturedData = {
      stories: [
        { id: 1, username: 'friend_1', avatar: '👩‍🎤', viewed: false, timestamp: Date.now() - 1800000 },
        { id: 2, username: 'bestie', avatar: '💖', viewed: false, timestamp: Date.now() - 3600000 },
        { id: 3, username: 'travel_buddy', avatar: '✈️', viewed: false, timestamp: Date.now() - 7200000 },
        { id: 4, username: 'foodie_friend', avatar: '🍕', viewed: true, timestamp: Date.now() - 10800000 },
        { id: 5, username: 'gym_partner', avatar: '💪', viewed: true, timestamp: Date.now() - 14400000 },
        { id: 6, username: 'work_crew', avatar: '💼', viewed: true, timestamp: Date.now() - 18000000 }
      ],
      posts: [
        {
          id: 1,
          username: 'friend_1',
          avatar: '👩‍🎤',
          caption: 'What a beautiful day! ☀️',
          likes: 1847,
          comments: 89,
          image: 'linear-gradient(135deg, #ff6b9d, #c678dd)',
          timestamp: Date.now() - 3600000
        },
        {
          id: 2,
          username: 'bestie',
          avatar: '💖',
          caption: 'Weekend vibes only 🎉',
          likes: 3254,
          comments: 156,
          image: 'linear-gradient(135deg, #61dafb, #c678dd)',
          timestamp: Date.now() - 86400000
        },
        {
          id: 3,
          username: 'travel_buddy',
          avatar: '✈️',
          caption: 'Adventure awaits! 🌍',
          likes: 5621,
          comments: 234,
          image: 'linear-gradient(135deg, #ffd93d, #ff6b9d)',
          timestamp: Date.now() - 172800000
        },
        {
          id: 4,
          username: 'foodie_friend',
          avatar: '🍕',
          caption: 'Best pizza in town 🍕🔥',
          likes: 2103,
          comments: 67,
          image: 'linear-gradient(135deg, #e06c75, #ffd93d)',
          timestamp: Date.now() - 259200000
        }
      ],
      messages: [
        { id: 1, username: 'bestie', avatar: '💖', text: 'Hey! Did you see my story? 😍', unread: true, timestamp: Date.now() - 900000 },
        { id: 2, username: 'friend_1', avatar: '👩‍🎤', text: 'We should hang out soon!', unread: true, timestamp: Date.now() - 1800000 },
        { id: 3, username: 'travel_buddy', avatar: '✈️', text: 'Planning the next trip? 🗺️', unread: true, timestamp: Date.now() - 3600000 },
        { id: 4, username: 'gym_partner', avatar: '💪', text: 'Leg day tomorrow? 🏋️', unread: false, timestamp: Date.now() - 7200000 },
        { id: 5, username: 'work_crew', avatar: '💼', text: 'Great job on the presentation!', unread: false, timestamp: Date.now() - 86400000 }
      ],
      profile: {
        username: 'you',
        displayName: 'Your Profile',
        avatar: '🎮',
        posts: 42,
        followers: 1337,
        following: 420,
        bio: 'Exploring CreativeInstagram! ✨'
      },
      capturedScreenshot: imageData
    };

    return capturedData;
  }

  async loadSavedData() {
    try {
      // First try to load from persistent save
      const savedData = await ipcRenderer.invoke('load-data');
      if (savedData) {
        this.game.setInstagramData(savedData);
        console.log('Loaded saved data');
      }
      
      // Also try to load the latest dump automatically
      await this.loadLatestDump();
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }

  async loadLatestDump() {
    try {
      const dumps = await ipcRenderer.invoke('list-dumps');
      console.log('Found', dumps?.length || 0, 'dump files');
      
      if (dumps && dumps.length > 0) {
        // Initialize scraped data
        this.scrapedData = { 
          stories: [], posts: [], messages: [], notifications: [], mutuals: [], suggestions: [], usernames: new Set() 
        };
        
        // Load ALL dumps and merge them
        let loadedCount = 0;
        for (const dump of dumps) {
          try {
            const data = await ipcRenderer.invoke('load-dump', dump.filepath);
            if (data && !data.error) {
              this.mergeScrapedData(data);
              loadedCount++;
            }
          } catch (e) {
            console.error('Error loading dump:', dump.filename, e.message);
          }
        }
        
        console.log('Loaded', loadedCount, 'dumps');
        
        // Set the data in the game (silent = true for auto-load at startup)
        this.game.setInstagramData({
          stories: this.scrapedData.stories,
          posts: this.scrapedData.posts,
          messages: this.scrapedData.messages,
          suggestions: this.scrapedData.suggestions,
          mutuals: this.scrapedData.mutuals
        }, true);
        
        const stats = this.getScrapedStats();
        console.log('Auto-loaded all dumps:', stats);
      }
    } catch (error) {
      console.error('Error auto-loading dumps:', error);
    }
  }

  openSettings() {
    // Settings panel - could be expanded
    this.game.queueDialog({
      name: 'Settings',
      icon: '⚙️',
      text: 'Settings panel coming soon! For now, use WASD to move and E to interact.'
    });
    this.game.showNextDialog();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});


