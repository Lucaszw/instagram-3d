const { app, BrowserWindow, BrowserView, ipcMain, desktopCapturer, screen, systemPreferences, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let instagramView = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
    show: false
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// Request screen capture permission on macOS
async function requestPermissions() {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen');
    console.log('Screen capture permission status:', status);
    return status === 'granted';
  }
  return true;
}

// Open system preferences to grant screen recording permission
ipcMain.handle('open-screen-preferences', async () => {
  const { shell } = require('electron');
  // Open Privacy & Security > Screen Recording pane
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  return true;
});

// Check current permission status
ipcMain.handle('check-screen-permission', async () => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('screen');
  }
  return 'granted';
});

// Restart the app
ipcMain.handle('restart-app', async () => {
  app.relaunch();
  app.exit(0);
});

// ========================================
// Built-in Instagram Browser
// ========================================

// Open Instagram browser
ipcMain.handle('open-instagram-browser', async () => {
  // Reuse existing BrowserView if it exists (preserves login session)
  if (instagramView) {
    // Just re-add it to the window
    mainWindow.addBrowserView(instagramView);
    const bounds = mainWindow.getBounds();
    instagramView.setBounds({ 
      x: 50, 
      y: 100, 
      width: bounds.width - 100, 
      height: bounds.height - 200 
    });
    console.log('Instagram browser restored (session preserved)');
    return true;
  }

  // Create new BrowserView only if one doesn't exist
  instagramView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:instagram'
    }
  });

  mainWindow.addBrowserView(instagramView);
  
  const bounds = mainWindow.getBounds();
  instagramView.setBounds({ 
    x: 50, 
    y: 100, 
    width: bounds.width - 100, 
    height: bounds.height - 200 
  });
  
  console.log('Instagram browser created (new session)');
  instagramView.setAutoResize({ width: true, height: true });

  await instagramView.webContents.loadURL('https://www.instagram.com/');
  
  return true;
});

// Close Instagram browser
ipcMain.handle('close-instagram-browser', async () => {
  if (instagramView) {
    // Don't destroy - just hide it so session persists
    mainWindow.removeBrowserView(instagramView);
    // Keep instagramView reference so we can reuse it and its session
    console.log('Instagram browser hidden (session preserved)');
  }
  return true;
});

// Store browser view bounds for restoration
let savedBrowserBounds = null;

// Hide browser view temporarily (for showing panels on top)
ipcMain.handle('hide-browser-view', async () => {
  if (instagramView && mainWindow) {
    // Save current bounds
    savedBrowserBounds = instagramView.getBounds();
    // Remove from window temporarily
    mainWindow.removeBrowserView(instagramView);
  }
  return true;
});

// Show browser view again
ipcMain.handle('show-browser-view', async () => {
  if (instagramView && mainWindow) {
    // Add back to window
    mainWindow.addBrowserView(instagramView);
    // Restore bounds
    if (savedBrowserBounds) {
      instagramView.setBounds(savedBrowserBounds);
    } else {
      const bounds = mainWindow.getBounds();
      instagramView.setBounds({ 
        x: 50, 
        y: 100, 
        width: bounds.width - 100, 
        height: bounds.height - 200 
      });
    }
  }
  return true;
});

// Open Instagram DM with a specific user
ipcMain.handle('open-instagram-dm', async (event, username) => {
  if (instagramView) {
    // Navigate to the DM with that user
    await instagramView.webContents.loadURL(`https://www.instagram.com/direct/t/${username}/`);
  }
  return true;
});

// Scrape user's chat messages - show browser for debugging
ipcMain.handle('scrape-user-chat', async (event, username, options = {}) => {
  // Create browser if it doesn't exist
  if (!instagramView) {
    console.log('Chat scrape: Creating hidden browser...');
    const { BrowserView } = require('electron');
    instagramView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:instagram' // Use same session
      }
    });
    // Load Instagram but don't show
    await instagramView.webContents.loadURL('https://www.instagram.com/');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Chat scrape: Hidden browser created');
  }

  try {
    // Show browser for debugging if requested
    if (options.showBrowser && mainWindow) {
      console.log('Chat scrape: Showing browser for debugging...');
      mainWindow.addBrowserView(instagramView);
      const bounds = mainWindow.getContentBounds();
      instagramView.setBounds({ 
        x: Math.floor(bounds.width * 0.4), 
        y: 50, 
        width: Math.floor(bounds.width * 0.58), 
        height: bounds.height - 100 
      });
    }
    
    // Save current URL
    const currentUrl = instagramView.webContents.getURL();
    console.log('Chat scrape: Current URL:', currentUrl);
    console.log('Chat scrape: Navigating to DM with:', username);
    
    // Step 1: Go directly to user's profile
    console.log('Chat scrape: Step 1 - Going to profile:', username);
    await instagramView.webContents.loadURL(`https://www.instagram.com/${username}/`);
    
    // Wait for profile to load (reduced for speed)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Step 2: Click on Message button to open DM
    console.log('Chat scrape: Step 2 - Looking for Message button...');
    const messageClicked = await instagramView.webContents.executeJavaScript(`
      (function() {
        console.log('Looking for Message button...');
        
        // Look for Message button - various selectors
        const buttons = document.querySelectorAll('div[role="button"], button');
        console.log('Found buttons:', buttons.length);
        
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase().trim();
          console.log('Button text:', text?.substring(0, 30));
          
          if (text === 'message' || text?.includes('message')) {
            console.log('Found Message button!');
            btn.click();
            return { found: true, text: text };
          }
        }
        
        // Also check for direct link to DM
        const dmLink = document.querySelector('a[href*="/direct/t/"]');
        if (dmLink) {
          console.log('Found DM link:', dmLink.href);
          dmLink.click();
          return { found: true, isDmLink: true };
        }
        
        // List all button texts for debugging
        const allButtonTexts = Array.from(buttons).map(b => b.textContent?.substring(0, 20)).slice(0, 10);
        console.log('All button texts:', allButtonTexts);
        
        return { found: false, buttons: allButtonTexts };
      })();
    `);
    
    console.log('Message clicked:', messageClicked);
    
    if (!messageClicked.found) {
      console.log('Chat scrape: Could not find Message button');
      // Keep browser visible longer if debugging
      if (options.showBrowser) {
        await new Promise(resolve => setTimeout(resolve, 4000));
        mainWindow.removeBrowserView(instagramView);
      }
      return { messages: [], error: 'Message button not found', debug: { username, buttons: messageClicked.buttons } };
    }
    
    // Wait for conversation to load - need more time for messages
    console.log('Chat scrape: Step 3 - Waiting for messages to load...');
    await new Promise(resolve => setTimeout(resolve, 3500));
    
    // Step 2: Scrape the conversation messages
    const chatData = await instagramView.webContents.executeJavaScript(`
      (function() {
        const result = {
          username: '${username}',
          messages: [],
          debug: { url: window.location.href, foundTexts: [], html: '' }
        };
        
        console.log('Scraping chat for:', '${username}');
        
        // Method 1: Find message rows with role="row"
        const messageRows = document.querySelectorAll('[role="row"]');
        const candidates = [];
        const seenTexts = new Set();
        
        console.log('Found rows:', messageRows.length);
        
        messageRows.forEach((row, idx) => {
          const rowText = row.textContent || '';
          
          // Skip very short rows or date-only rows
          if (rowText.length < 15) return;
          
          // Check if from me
          const isMe = rowText.includes('You sent') || rowText.includes('You reacted');
          
          // Find all spans within this row that have substantial text
          const spans = row.querySelectorAll('span');
          let bestText = '';
          
          spans.forEach(span => {
            const text = span.textContent?.trim();
            if (!text) return;
            
            // Skip if it's a child of another span we already processed
            const spanClasses = span.className || '';
            
            // Look for spans with line-clamp (message content) or x1lliihq class
            const hasLineClamp = span.closest('[style*="line-clamp"]') || spanClasses.includes('x1lliihq');
            
            // Skip UI elements
            if (/^(You sent|You reacted|Seen|Active|Online|Message|Enter|Today|Yesterday|Verified|Double tap)$/i.test(text)) return;
            if (/^\\d{1,2}:\\d{2}\\s*(AM|PM)?$/i.test(text)) return;
            if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|January|February|March|April|May|June|July|August|September|October|November|December)/i.test(text)) return;
            if (/^Seen\\s+\\d+/i.test(text)) return;
            if (/^\\d+[hmdw]\\s*(ago)?$/i.test(text)) return;
            
            // Skip pure usernames
            if (/^@?[a-zA-Z0-9_.]+$/.test(text) && text.length < 25) return;
            
            // Prefer longer text that looks like actual content
            if (text.length > bestText.length && text.length > 8) {
              // Make sure it has some actual words/content
              const wordCount = text.split(/\\s+/).length;
              if (wordCount >= 2 || text.length > 20) {
                bestText = text;
              }
            }
          });
          
          if (bestText && !seenTexts.has(bestText)) {
            seenTexts.add(bestText);
            const rect = row.getBoundingClientRect();
            candidates.push({
              text: bestText.substring(0, 200),
              isMe: isMe,
              top: rect.top
            });
            result.debug.foundTexts.push(bestText.substring(0, 50));
          }
        });
        
        // Sort by position and take last 5
        candidates.sort((a, b) => a.top - b.top);
        result.messages = candidates.slice(-5);
        
        // Debug: capture some HTML if no messages found
        if (result.messages.length === 0) {
          const chatArea = document.querySelector('[role="grid"]') || document.body;
          result.debug.html = chatArea.innerHTML.substring(0, 2000);
        }
        
        console.log('Found messages:', result.messages.length);
        console.log('Debug texts:', result.debug.foundTexts);
        
        return result;
      })();
    `);
    
    console.log('Chat scrape result:', JSON.stringify(chatData, null, 2));
    
    // Keep browser visible briefly if debugging
    if (options.showBrowser) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Navigate back to original URL
    if (currentUrl && !currentUrl.includes('about:blank')) {
      await instagramView.webContents.loadURL(currentUrl);
    }
    
    // Hide browser after scraping is complete
    if (options.showBrowser && mainWindow) {
      console.log('Chat scrape: Hiding browser...');
      mainWindow.removeBrowserView(instagramView);
    }
    
    return chatData;
  } catch (error) {
    console.error('Error scraping chat:', error);
    // Hide browser on error too
    if (options.showBrowser && mainWindow) {
      mainWindow.removeBrowserView(instagramView);
    }
    return { messages: [], error: error.message };
  }
});

// Check if logged in and scrape data
ipcMain.handle('scrape-instagram', async () => {
  if (!instagramView) {
    return { error: 'Browser not open' };
  }

  try {
    // Inject scraping script
    const data = await instagramView.webContents.executeJavaScript(`
      (function() {
        const data = {
          stories: [],
          messages: [],
          posts: [],
          profile: null,
          loggedIn: false
        };

        // Check if logged in (look for profile link or login button)
        const profileLink = document.querySelector('a[href*="/accounts/activity/"]') || 
                           document.querySelector('svg[aria-label="Home"]') ||
                           document.querySelector('a[href="/direct/inbox/"]');
        data.loggedIn = !!profileLink;

        if (!data.loggedIn) {
          return data;
        }

        // Get stories from the story tray
        const storyItems = document.querySelectorAll('div[role="menuitem"]') ||
                          document.querySelectorAll('button[aria-label*="Story"]');
        
        // Try to find story usernames in various ways
        const storyContainers = document.querySelectorAll('div[role="button"]');
        storyContainers.forEach((container, i) => {
          const img = container.querySelector('img[alt]');
          if (img && img.alt && !img.alt.includes("'s profile picture")) {
            // Skip non-story items
          }
          const text = container.textContent;
          if (text && text.length < 30 && text.length > 0) {
            const username = text.trim().split('\\n')[0];
            if (username && !data.stories.find(s => s.username === username)) {
              data.stories.push({
                id: data.stories.length + 1,
                username: username,
                viewed: container.querySelector('[style*="border"]') ? true : false
              });
            }
          }
        });

        // Get usernames from any visible elements
        const allLinks = document.querySelectorAll('a[href^="/"]');
        const usernames = new Set();
        allLinks.forEach(link => {
          const href = link.getAttribute('href');
          // Match /@username/ or /username/ patterns (excluding reserved paths)
          const match = href.match(/^\\/([a-zA-Z0-9._]+)\\/?$/);
          if (match) {
            const username = match[1];
            const reserved = ['explore', 'direct', 'accounts', 'p', 'reels', 'stories', 'reel', 'tv', 'about', 'legal'];
            if (!reserved.includes(username.toLowerCase()) && username.length > 1) {
              usernames.add(username);
            }
          }
        });

        // Convert to stories if we don't have enough
        if (data.stories.length < 3) {
          Array.from(usernames).slice(0, 10).forEach((username, i) => {
            if (!data.stories.find(s => s.username === username)) {
              data.stories.push({
                id: data.stories.length + 1,
                username: username,
                viewed: i > 3
              });
            }
          });
        }

        // Get posts from feed
        const articles = document.querySelectorAll('article');
        articles.forEach((article, i) => {
          const usernameEl = article.querySelector('a[href^="/"][role="link"] span') ||
                            article.querySelector('header a[href^="/"]');
          const username = usernameEl ? usernameEl.textContent.trim() : 'unknown';
          
          const captionEl = article.querySelector('h1') || 
                           article.querySelector('span[dir="auto"]');
          const caption = captionEl ? captionEl.textContent.substring(0, 100) : '';
          
          const likeEl = article.querySelector('button span') ||
                        article.querySelector('section span');
          let likes = 0;
          if (likeEl && likeEl.textContent) {
            const likeText = likeEl.textContent;
            if (likeText.includes(',')) {
              likes = parseInt(likeText.replace(/,/g, '')) || 0;
            } else {
              likes = parseInt(likeText) || 0;
            }
          }

          if (username !== 'unknown') {
            data.posts.push({
              id: i + 1,
              username: username,
              caption: caption,
              likes: likes || Math.floor(Math.random() * 5000)
            });
          }
        });

        // Try to get DM preview if on inbox
        const dmItems = document.querySelectorAll('div[role="listitem"]') ||
                       document.querySelectorAll('a[href^="/direct/t/"]');
        dmItems.forEach((item, i) => {
          const text = item.textContent;
          const parts = text.split('\\n').filter(p => p.trim());
          if (parts.length >= 1) {
            data.messages.push({
              id: i + 1,
              username: parts[0].substring(0, 25),
              text: parts[1] ? parts[1].substring(0, 50) : 'Tap to view message',
              unread: item.querySelector('[aria-label*="unread"]') ? true : i < 2
            });
          }
        });

        // If we're on the home page, use extracted usernames for messages too
        if (data.messages.length === 0) {
          Array.from(usernames).slice(0, 5).forEach((username, i) => {
            data.messages.push({
              id: i + 1,
              username: username,
              text: ['Hey! How are you?', 'Check this out!', 'Miss you!', 'Let\\'s hang soon!', 'OMG 😍'][i],
              unread: i < 2
            });
          });
        }

        return data;
      })();
    `);

    return data;
  } catch (error) {
    console.error('Scrape error:', error);
    return { error: error.message };
  }
});

// Navigate within Instagram
ipcMain.handle('instagram-navigate', async (event, path) => {
  if (!instagramView) return false;
  await instagramView.webContents.loadURL(`https://www.instagram.com${path}`);
  return true;
});

// Get current URL
ipcMain.handle('instagram-get-url', async () => {
  if (!instagramView) return null;
  return instagramView.webContents.getURL();
});

// List all previous scrape dumps
ipcMain.handle('list-dumps', async () => {
  const dumpDir = path.join(app.getPath('userData'), 'scrape-dumps');
  
  // Also check old app location for backwards compatibility
  const oldDumpDir = path.join(app.getPath('userData').replace('creative-instagram', 'instagram-3d-visualizer'), 'scrape-dumps');
  
  console.log('Checking dump directories:', dumpDir, oldDumpDir);
  
  try {
    // Create new dump dir if needed
    if (!fs.existsSync(dumpDir)) {
      fs.mkdirSync(dumpDir, { recursive: true });
    }
    
    // Collect files from both directories
    const collectFiles = (dir) => {
      if (!fs.existsSync(dir)) return [];
      
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          try {
            const filepath = path.join(dir, f);
            const stats = fs.statSync(filepath);
            const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            
            return {
              filename: f,
              filepath,
              date: stats.mtime,
              size: stats.size,
              pageType: content.pageType || 'unknown',
              stories: content.stories?.length || 0,
              posts: content.posts?.length || 0,
              messages: content.messages?.length || 0,
              notifications: content.notifications?.length || 0,
              usernames: content.rawUsernames?.length || 0
            };
          } catch (e) {
            console.error('Error reading dump file:', f, e.message);
            return null;
          }
        })
        .filter(f => f !== null);
    };
    
    // Collect from both new and old locations
    const newFiles = collectFiles(dumpDir);
    const oldFiles = collectFiles(oldDumpDir);
    
    const allFiles = [...newFiles, ...oldFiles]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log('Found dumps:', allFiles.length, 'files');
    
    return allFiles;
  } catch (error) {
    console.error('Error listing dumps:', error);
    return [];
  }
});

// Load a specific dump
ipcMain.handle('load-dump', async (event, filepath) => {
  try {
    const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    return content;
  } catch (error) {
    console.error('Error loading dump:', error);
    return { error: error.message };
  }
});

// Dump HTML to file for debugging
ipcMain.handle('dump-html', async (event, pageName) => {
  if (!instagramView) return { error: 'Browser not open' };
  
  try {
    const html = await instagramView.webContents.executeJavaScript('document.documentElement.outerHTML');
    const url = instagramView.webContents.getURL();
    
    const dumpDir = path.join(app.getPath('userData'), 'html-dumps');
    if (!fs.existsSync(dumpDir)) {
      fs.mkdirSync(dumpDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${pageName || 'page'}-${timestamp}.html`;
    const filepath = path.join(dumpDir, filename);
    
    fs.writeFileSync(filepath, html);
    console.log(`Dumped HTML to: ${filepath}`);
    
    return { 
      success: true, 
      filepath,
      url,
      size: html.length 
    };
  } catch (error) {
    console.error('Dump error:', error);
    return { error: error.message };
  }
});

// Advanced scraper with more data points
ipcMain.handle('scrape-instagram-advanced', async () => {
  if (!instagramView) return { error: 'Browser not open' };

  try {
    const url = instagramView.webContents.getURL();
    console.log('Scraping URL:', url);
    
    const data = await instagramView.webContents.executeJavaScript(`
      (function() {
        const result = {
          url: window.location.href,
          pageType: 'unknown',
          loggedIn: false,
          currentUser: null,
          
          // Core data
          stories: [],
          posts: [],
          messages: [],
          reels: [],
          
          // Social data
          following: [],
          followers: [],
          mutuals: [],
          suggestions: [],
          
          // Activity
          notifications: [],
          likes: [],
          comments: [],
          
          // Debug
          rawUsernames: [],
          rawTexts: [],
          elementCounts: {}
        };

        // Detect page type
        const path = window.location.pathname;
        if (path === '/' || path === '') result.pageType = 'home';
        else if (path.includes('/direct')) result.pageType = 'messages';
        else if (path.includes('/explore')) result.pageType = 'explore';
        else if (path.includes('/reels')) result.pageType = 'reels';
        else if (path.includes('/stories')) result.pageType = 'stories';
        else if (path.match(/^\\/[a-zA-Z0-9._]+\\/?$/)) result.pageType = 'profile';
        else if (path.includes('/p/')) result.pageType = 'post';
        
        // Check login status
        const loginBtn = document.querySelector('button[type="submit"]');
        const navIcons = document.querySelectorAll('svg[aria-label]');
        result.loggedIn = navIcons.length > 3;
        
        // Get current user from page
        const profileLinks = document.querySelectorAll('a[href^="/"][role="link"]');
        
        // Element counts for debugging
        result.elementCounts = {
          articles: document.querySelectorAll('article').length,
          images: document.querySelectorAll('img').length,
          links: document.querySelectorAll('a').length,
          buttons: document.querySelectorAll('button').length,
          divRoles: document.querySelectorAll('div[role]').length,
          spans: document.querySelectorAll('span').length
        };

        // ========================================
        // STORY EXTRACTION
        // ========================================
        
        // Stories are usually in a horizontal scroll container at top
        const storyContainers = document.querySelectorAll('div[role="button"], button');
        const seenStoryUsers = new Set();
        
        storyContainers.forEach(container => {
          // Look for profile pictures with story rings
          const img = container.querySelector('img');
          const canvas = container.querySelector('canvas');
          const hasRing = container.querySelector('[style*="linear-gradient"]') || 
                         container.querySelector('[style*="border"]');
          
          if (img && img.alt) {
            const altText = img.alt;
            // "username's profile picture" or similar
            const match = altText.match(/^(.+?)(?:'s profile|'s story| profile)/i);
            if (match && !seenStoryUsers.has(match[1])) {
              seenStoryUsers.add(match[1]);
              result.stories.push({
                username: match[1].trim(),
                hasUnwatched: !!hasRing,
                imgSrc: img.src
              });
            }
          }
        });

        // ========================================
        // POST/FEED EXTRACTION  
        // ========================================
        
        const articles = document.querySelectorAll('article');
        articles.forEach((article, idx) => {
          const post = {
            index: idx,
            username: null,
            caption: null,
            likes: null,
            comments: null,
            timestamp: null,
            isVideo: false,
            isCarousel: false,
            imgSrc: null
          };
          
          // Get username from header
          const header = article.querySelector('header');
          if (header) {
            const userLink = header.querySelector('a[href^="/"]');
            if (userLink) {
              post.username = userLink.textContent.trim() || 
                             userLink.getAttribute('href').replace(/\\//g, '');
            }
          }
          
          // Get image
          const img = article.querySelector('img[src*="instagram"]');
          if (img) {
            post.imgSrc = img.src;
          }
          
          // Check if video
          post.isVideo = !!article.querySelector('video');
          
          // Get caption
          const spans = article.querySelectorAll('span');
          spans.forEach(span => {
            const text = span.textContent;
            if (text && text.length > 20 && text.length < 500 && !post.caption) {
              post.caption = text.substring(0, 200);
            }
          });
          
          // Get likes
          const likeSection = article.querySelector('section');
          if (likeSection) {
            const likeText = likeSection.textContent;
            const likeMatch = likeText.match(/(\\d[\\d,.]*)\\s*(likes?|views?)/i);
            if (likeMatch) {
              post.likes = likeMatch[1].replace(/,/g, '');
            }
          }
          
          // Get timestamp
          const time = article.querySelector('time');
          if (time) {
            post.timestamp = time.getAttribute('datetime') || time.textContent;
          }
          
          if (post.username) {
            result.posts.push(post);
          }
        });

        // ========================================
        // DM/MESSAGES EXTRACTION (Improved)
        // ========================================
        
        if (result.pageType === 'messages') {
          // The stories array on messages page = DM contacts (bubbles)
          // We need to pair them with message previews from rawTexts
          
          // Get all conversation items by looking for clickable elements with profile pics
          const allDivs = document.querySelectorAll('div[role="button"], div[tabindex="0"]');
          allDivs.forEach((div, idx) => {
            const img = div.querySelector('img');
            const text = div.textContent;
            
            if (img && img.alt && text.length > 5 && text.length < 300) {
              const altMatch = img.alt.match(/^(.+?)(?:'s profile|'s photo)/i);
              if (altMatch) {
                const username = altMatch[1];
                // Split text to find message preview
                const lines = text.split('\\n').filter(l => l.trim() && l.trim() !== username);
                const preview = lines.find(l => l.length > 5 && l.length < 100) || '';
                
                if (!result.messages.find(m => m.username === username)) {
                  result.messages.push({
                    index: result.messages.length,
                    username,
                    preview: preview.substring(0, 80),
                    imgSrc: img.src,
                    unread: !!div.querySelector('[style*="rgb(0, 149, 246)"]') || 
                           div.textContent.includes('Active'),
                    isGroup: div.querySelectorAll('img').length > 1
                  });
                }
              }
            }
          });
        }
        
        // Also extract from stories array on messages page (they're the DM bubbles)
        if (result.pageType === 'messages' && result.stories.length > 0) {
          // Convert stories to messages if messages is empty
          if (result.messages.length < result.stories.length) {
            result.stories.forEach((story, idx) => {
              if (!result.messages.find(m => m.username === story.username)) {
                // Find matching text from rawTexts
                const matchingText = result.rawTexts.find(t => 
                  !t.includes('\\n') && t.length > 5 && t.length < 80
                ) || '';
                
                result.messages.push({
                  index: result.messages.length,
                  username: story.username,
                  preview: result.rawTexts[idx] || matchingText,
                  imgSrc: story.imgSrc,
                  unread: idx < 3,
                  isGroup: false
                });
              }
            });
          }
        }

        // ========================================
        // PROFILE EXTRACTION (when on profile page)
        // ========================================
        
        if (result.pageType === 'profile') {
          const headerSection = document.querySelector('header');
          if (headerSection) {
            // Get stats (posts, followers, following)
            const stats = headerSection.querySelectorAll('li, span[title]');
            stats.forEach(stat => {
              const text = stat.textContent;
              const postMatch = text.match(/(\\d+)\\s*posts?/i);
              const followerMatch = text.match(/(\\d+[KMkm]?)\\s*followers?/i);
              const followingMatch = text.match(/(\\d+[KMkm]?)\\s*following/i);
              
              if (postMatch) result.profileStats = result.profileStats || {};
              if (followerMatch) result.mutuals.push({ type: 'followers', count: followerMatch[1] });
              if (followingMatch) result.mutuals.push({ type: 'following', count: followingMatch[1] });
            });
            
            // Check for "Follows you" badge
            const followsYou = headerSection.textContent.includes('Follows you');
            if (followsYou) {
              result.mutuals.push({ type: 'follows_you', value: true });
            }
            
            // Check for mutual friends
            const mutualText = headerSection.textContent;
            const mutualMatch = mutualText.match(/Followed by (.+?) and/i);
            if (mutualMatch) {
              result.mutuals.push({ type: 'mutual_friends', preview: mutualMatch[1] });
            }
          }
        }

        // ========================================
        // SUGGESTIONS / EXPLORE
        // ========================================
        
        const suggestionContainers = document.querySelectorAll('div[role="presentation"]');
        suggestionContainers.forEach(container => {
          const link = container.querySelector('a[href^="/"]');
          const followBtn = container.querySelector('button');
          if (link && followBtn) {
            const username = link.getAttribute('href').replace(/\\//g, '');
            if (username && !result.suggestions.find(s => s.username === username)) {
              result.suggestions.push({
                username,
                reason: container.textContent.includes('Followed by') ? 'mutual' : 'suggested'
              });
            }
          }
        });

        // ========================================
        // NOTIFICATIONS EXTRACTION
        // ========================================
        
        // Parse notification texts for activity data
        result.rawTexts.forEach(text => {
          // New followers
          const followMatch = text.match(/^([a-zA-Z0-9._]+) started following you/i);
          if (followMatch) {
            result.notifications.push({
              type: 'follow',
              username: followMatch[1],
              text: text
            });
          }
          
          // Likes on posts
          const likeMatch = text.match(/^([a-zA-Z0-9._]+).* liked your (post|reel|photo|video)/i);
          if (likeMatch) {
            result.notifications.push({
              type: 'like',
              username: likeMatch[1],
              contentType: likeMatch[2],
              text: text
            });
          }
          
          // Story likes
          const storyLikeMatch = text.match(/^([a-zA-Z0-9._]+).* liked your story/i);
          if (storyLikeMatch) {
            result.notifications.push({
              type: 'story_like',
              username: storyLikeMatch[1],
              text: text
            });
          }
          
          // Comments
          const commentMatch = text.match(/^([a-zA-Z0-9._]+).* commented:/i);
          if (commentMatch) {
            result.notifications.push({
              type: 'comment',
              username: commentMatch[1],
              text: text
            });
          }
          
          // Mentions
          const mentionMatch = text.match(/^([a-zA-Z0-9._]+).* mentioned you/i);
          if (mentionMatch) {
            result.notifications.push({
              type: 'mention',
              username: mentionMatch[1],
              text: text
            });
          }
          
          // Mutual/suggestion indicators
          const mutualMatch = text.match(/Followed by ([a-zA-Z0-9._]+)/i);
          if (mutualMatch) {
            result.mutuals.push({
              type: 'followed_by',
              username: mutualMatch[1],
              text: text
            });
          }
        });

        // ========================================
        // RAW USERNAME COLLECTION
        // ========================================
        
        const allLinks = document.querySelectorAll('a[href^="/"]');
        const usernameSet = new Set();
        allLinks.forEach(link => {
          const href = link.getAttribute('href') || '';
          const match = href.match(/^\\/([a-zA-Z0-9._]{1,30})\\/?$/);
          if (match) {
            const reserved = ['explore', 'direct', 'accounts', 'p', 'reels', 'stories', 
                            'reel', 'tv', 'about', 'legal', 'api', 'developer', 
                            'privacy', 'terms', 'session', 'login', 'challenge'];
            if (!reserved.includes(match[1].toLowerCase())) {
              usernameSet.add(match[1]);
            }
          }
        });
        result.rawUsernames = Array.from(usernameSet).slice(0, 50);

        // ========================================
        // RAW TEXT COLLECTION (for debugging)
        // ========================================
        
        const textNodes = [];
        document.querySelectorAll('span, h1, h2, p').forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length > 5 && text.length < 100) {
            textNodes.push(text);
          }
        });
        result.rawTexts = [...new Set(textNodes)].slice(0, 30);

        return result;
      })();
    `);

    // Dump data to file
    const dumpDir = path.join(app.getPath('userData'), 'scrape-dumps');
    if (!fs.existsSync(dumpDir)) {
      fs.mkdirSync(dumpDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `scrape-${data.pageType}-${timestamp}.json`;
    const filepath = path.join(dumpDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`Dumped scrape data to: ${filepath}`);
    data.dumpPath = filepath;

    return data;
  } catch (error) {
    console.error('Advanced scrape error:', error);
    return { error: error.message };
  }
});

// Get all windows for capture
ipcMain.handle('get-sources', async () => {
  try {
    console.log('Requesting desktop sources...');
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 400, height: 300 },
      fetchWindowIcons: true
    });
    
    console.log(`Found ${sources.length} sources:`);
    sources.forEach(s => {
      const thumbSize = s.thumbnail.getSize();
      console.log(`  - ${s.name}: ${thumbSize.width}x${thumbSize.height}`);
    });
    
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
  } catch (error) {
    console.error('Error getting sources:', error);
    return [];
  }
});

// Capture specific window at high resolution for OCR
ipcMain.handle('capture-window', async (event, sourceId) => {
  try {
    // Use higher resolution for better OCR results
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 2560, height: 1600 }
    });
    
    const source = sources.find(s => s.id === sourceId);
    if (source) {
      console.log(`Captured window: ${source.name} at ${source.thumbnail.getSize().width}x${source.thumbnail.getSize().height}`);
      return source.thumbnail.toDataURL('image/png');
    }
    return null;
  } catch (error) {
    console.error('Error capturing window:', error);
    return null;
  }
});

// Save scraped data
ipcMain.handle('save-data', async (event, data) => {
  const dataPath = path.join(app.getPath('userData'), 'instagram-data.json');
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    return false;
  }
});

// Load scraped data
ipcMain.handle('load-data', async () => {
  const dataPath = path.join(app.getPath('userData'), 'instagram-data.json');
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
    return null;
  } catch (error) {
    console.error('Error loading data:', error);
    return null;
  }
});

// Process image with OCR
ipcMain.handle('process-ocr', async (event, imageDataUrl) => {
  try {
    console.log('Processing OCR in main process...');
    const data = await scraper.extractFromImage(imageDataUrl);
    return data;
  } catch (error) {
    console.error('OCR processing error:', error);
    return null;
  }
});

app.whenReady().then(async () => {
  await requestPermissions();
  createWindow();

  // Create hidden Instagram browser at startup so it's ready for chat scraping
  setTimeout(() => {
    if (!instagramView) {
      console.log('Creating hidden Instagram browser at startup...');
      instagramView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: 'persist:instagram'
        }
      });
      instagramView.webContents.loadURL('https://www.instagram.com/');
      console.log('Hidden Instagram browser created (session preserved)');
    }
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

