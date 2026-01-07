// ========================================
// CreativeInstagram - Instagram Scraper
// OCR-based extraction from captured windows
// ========================================

const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

class InstagramScraper {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('Initializing OCR engine...');
    try {
      this.worker = await Tesseract.createWorker('eng', 1, {
        logger: m => console.log('Tesseract:', m.status, m.progress ? Math.round(m.progress * 100) + '%' : '')
      });
      this.isInitialized = true;
      console.log('OCR engine ready!');
    } catch (error) {
      console.error('Failed to initialize OCR:', error);
      throw error;
    }
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }

  async extractFromImage(imageDataUrl) {
    console.log('Starting OCR extraction...');
    
    try {
      // Convert data URL to buffer and save to temp file
      // Tesseract works better with file paths
      const tempPath = path.join(os.tmpdir(), `instagram-capture-${Date.now()}.png`);
      
      // Extract base64 data
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Write to temp file
      fs.writeFileSync(tempPath, imageBuffer);
      console.log('Saved temp image to:', tempPath);
      
      await this.initialize();
      
      // Run OCR on the file
      const result = await this.worker.recognize(tempPath);
      const text = result.data.text;
      
      // Clean up temp file
      try { fs.unlinkSync(tempPath); } catch (e) {}
      
      console.log('OCR Raw Text (first 500 chars):', text.substring(0, 500));
      
      // Parse the extracted text
      const data = this.parseInstagramText(text);
      
      return data;
    } catch (error) {
      console.error('OCR Error:', error);
      // Return empty structure instead of null so fallback kicks in
      return {
        stories: [],
        posts: [],
        messages: [],
        profile: null,
        rawText: '',
        error: error.message
      };
    }
  }

  parseInstagramText(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    const data = {
      stories: [],
      posts: [],
      messages: [],
      profile: null,
      rawText: text
    };

    // Pattern matching for Instagram elements
    const usernamePattern = /^@?([a-zA-Z0-9._]{1,30})$/;
    const timePattern = /(\d+[hm]|just now|yesterday|\d+ (hours?|minutes?|days?) ago)/i;
    const likePattern = /(\d+[,.]?\d*[KkMm]?)\s*(likes?|views?)/i;
    const commentPattern = /(\d+[,.]?\d*[KkMm]?)\s*comments?/i;
    
    // Extract potential usernames and messages
    let currentUsername = null;
    let messageBuffer = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip very short lines or navigation elements
      if (line.length < 2) continue;
      if (['Home', 'Search', 'Explore', 'Reels', 'Messages', 'Notifications', 'Create', 'Profile', 'More'].includes(line)) continue;
      
      // Check for username pattern
      const usernameMatch = line.match(usernamePattern);
      if (usernameMatch && line.length > 2 && line.length < 25) {
        // This might be a username
        const username = usernameMatch[1].toLowerCase();
        
        // Check if next line could be a message or timestamp
        const nextLine = lines[i + 1]?.trim() || '';
        
        if (timePattern.test(nextLine) || nextLine.length > 10) {
          // Likely a story or message sender
          if (!data.stories.some(s => s.username === username)) {
            data.stories.push({
              id: data.stories.length + 1,
              username: username,
              avatar: this.getAvatarEmoji(username),
              viewed: false,
              timestamp: Date.now() - Math.random() * 86400000
            });
          }
          
          // If there's text content, it might be a message
          if (nextLine.length > 10 && !timePattern.test(nextLine)) {
            data.messages.push({
              id: data.messages.length + 1,
              username: username,
              avatar: this.getAvatarEmoji(username),
              text: nextLine.substring(0, 100),
              unread: data.messages.length < 3,
              timestamp: Date.now() - Math.random() * 86400000
            });
            i++; // Skip the next line since we used it
          }
        }
      }
      
      // Check for like counts (indicates a post)
      const likeMatch = line.match(likePattern);
      if (likeMatch) {
        const likes = this.parseNumber(likeMatch[1]);
        
        // Look backwards for caption/username
        let caption = '';
        let postUsername = 'unknown_user';
        
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const prevLine = lines[j].trim();
          if (prevLine.match(usernamePattern)) {
            postUsername = prevLine.replace('@', '').toLowerCase();
            break;
          } else if (prevLine.length > 20 && !timePattern.test(prevLine)) {
            caption = prevLine;
          }
        }
        
        if (!data.posts.some(p => p.likes === likes)) {
          data.posts.push({
            id: data.posts.length + 1,
            username: postUsername,
            avatar: this.getAvatarEmoji(postUsername),
            caption: caption || 'Photo post',
            likes: likes,
            comments: Math.floor(likes * 0.05),
            image: this.getGradient(data.posts.length),
            timestamp: Date.now() - Math.random() * 604800000
          });
        }
      }

      // Check for DM indicators
      if (line.toLowerCase().includes('message') || line.toLowerCase().includes('sent you')) {
        const prevLine = lines[i - 1]?.trim() || '';
        if (prevLine.match(usernamePattern)) {
          const username = prevLine.replace('@', '').toLowerCase();
          if (!data.messages.some(m => m.username === username)) {
            data.messages.push({
              id: data.messages.length + 1,
              username: username,
              avatar: this.getAvatarEmoji(username),
              text: line.substring(0, 100),
              unread: true,
              timestamp: Date.now() - Math.random() * 3600000
            });
          }
        }
      }
    }

    // If we didn't find much, try alternative parsing
    if (data.stories.length === 0 && data.messages.length === 0) {
      data.stories = this.extractNamesAsFallback(lines, 'story');
      data.messages = this.extractNamesAsFallback(lines, 'message');
    }

    // Ensure we have some data
    if (data.stories.length === 0) {
      data.stories = this.generateFromText(lines, 'stories');
    }
    if (data.messages.length === 0) {
      data.messages = this.generateFromText(lines, 'messages');
    }
    if (data.posts.length === 0) {
      data.posts = this.generateFromText(lines, 'posts');
    }

    console.log('Extracted data:', {
      stories: data.stories.length,
      posts: data.posts.length,
      messages: data.messages.length
    });

    return data;
  }

  extractNamesAsFallback(lines, type) {
    const results = [];
    const seenNames = new Set();
    
    // Look for any word that could be a username (no spaces, reasonable length)
    const namePattern = /^[a-zA-Z][a-zA-Z0-9._]{2,20}$/;
    
    for (const line of lines) {
      const words = line.split(/\s+/);
      for (const word of words) {
        const cleaned = word.replace(/[^a-zA-Z0-9._]/g, '').toLowerCase();
        if (namePattern.test(cleaned) && !seenNames.has(cleaned)) {
          seenNames.add(cleaned);
          
          if (type === 'story') {
            results.push({
              id: results.length + 1,
              username: cleaned,
              avatar: this.getAvatarEmoji(cleaned),
              viewed: results.length > 3,
              timestamp: Date.now() - Math.random() * 86400000
            });
          } else if (type === 'message') {
            results.push({
              id: results.length + 1,
              username: cleaned,
              avatar: this.getAvatarEmoji(cleaned),
              text: 'Tap to view message',
              unread: results.length < 3,
              timestamp: Date.now() - Math.random() * 86400000
            });
          }
          
          if (results.length >= 8) break;
        }
      }
      if (results.length >= 8) break;
    }
    
    return results;
  }

  generateFromText(lines, type) {
    // Extract any meaningful text and create entries
    const results = [];
    const meaningfulLines = lines.filter(l => 
      l.trim().length > 3 && 
      l.trim().length < 50 &&
      !['Home', 'Search', 'Explore', 'Reels', 'Messages', 'Notifications', 'Create', 'Profile', 'More', 'Settings'].includes(l.trim())
    );

    for (let i = 0; i < Math.min(6, meaningfulLines.length); i++) {
      const text = meaningfulLines[i].trim();
      const username = text.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9._]/g, '') || `user_${i + 1}`;
      
      if (type === 'stories') {
        results.push({
          id: i + 1,
          username: username.substring(0, 20),
          avatar: this.getAvatarEmoji(username),
          viewed: i > 2,
          timestamp: Date.now() - Math.random() * 86400000
        });
      } else if (type === 'messages') {
        results.push({
          id: i + 1,
          username: username.substring(0, 20),
          avatar: this.getAvatarEmoji(username),
          text: text.substring(0, 80),
          unread: i < 3,
          timestamp: Date.now() - Math.random() * 86400000
        });
      } else if (type === 'posts') {
        results.push({
          id: i + 1,
          username: username.substring(0, 20),
          avatar: this.getAvatarEmoji(username),
          caption: text.substring(0, 100),
          likes: Math.floor(Math.random() * 5000),
          comments: Math.floor(Math.random() * 200),
          image: this.getGradient(i),
          timestamp: Date.now() - Math.random() * 604800000
        });
      }
    }

    return results;
  }

  parseNumber(str) {
    if (!str) return 0;
    str = str.replace(/,/g, '');
    const multiplier = str.toLowerCase().includes('k') ? 1000 : 
                       str.toLowerCase().includes('m') ? 1000000 : 1;
    return Math.floor(parseFloat(str) * multiplier) || 0;
  }

  getAvatarEmoji(username) {
    const emojis = ['👤', '👩', '👨', '🧑', '👧', '👦', '🧔', '👩‍🦰', '👨‍🦱', '👩‍🦳', '🧑‍🎤', '👩‍💻', '👨‍🎨', '🧑‍🚀', '👩‍🔬', '🎭', '🎨', '📸', '🎵', '✨', '🌟', '💫', '🔥', '💖', '🌈'];
    // Use username to deterministically pick an emoji
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = ((hash << 5) - hash) + username.charCodeAt(i);
      hash = hash & hash;
    }
    return emojis[Math.abs(hash) % emojis.length];
  }

  getGradient(index) {
    const gradients = [
      'linear-gradient(135deg, #ff6b9d, #c678dd)',
      'linear-gradient(135deg, #61dafb, #c678dd)',
      'linear-gradient(135deg, #ffd93d, #ff6b9d)',
      'linear-gradient(135deg, #98c379, #61dafb)',
      'linear-gradient(135deg, #e06c75, #ffd93d)',
      'linear-gradient(135deg, #c678dd, #61dafb)',
      'linear-gradient(135deg, #2ecc71, #3498db)',
      'linear-gradient(135deg, #e74c3c, #9b59b6)'
    ];
    return gradients[index % gradients.length];
  }
}

module.exports = InstagramScraper;

