/* ==========================================================================
   Jinpa CMS Admin Panel — Application
   A complete static SPA that manages site content via the GitHub API.
   No backend, no database, no server. Ships with every template.

   Copyright (c) 2025 Jinpa Project (getjinpa.com)
   Core engine licensed under BUSL-1.1. Templates are MIT.
   Commercial use of this engine requires written permission.
   ========================================================================== */
;(function () {
  'use strict';

  var _jnpMeta = { engine: 'jinpa-core', ref: 'jnpa-3f8c7d2a19b056e4' };

  // ==========================================================================
  // SECTION 1: Utilities
  // ==========================================================================

  /** Simple slug generator */
  function slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /** Format date as YYYY-MM-DD */
  function formatDate(d) {
    if (!d) return '';
    var date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return d;
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /** Format date for display */
  function displayDate(d) {
    if (!d) return '';
    var date = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /** Today as YYYY-MM-DD */
  function today() {
    return formatDate(new Date());
  }

  /** Escape HTML */
  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /** Base64 encode (utf-8 safe) */
  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  /** Base64 decode (utf-8 safe) */
  function b64decode(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  /** Generate post filename */
  function postFilename(dateStr, slug) {
    return dateStr + '-' + slug + '.md';
  }

  /** Generate page filename */
  function pageFilename(slug) {
    return slug + '.md';
  }

  /** Debounce */
  function debounce(fn, ms) {
    var timer;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  // ==========================================================================
  // SECTION 2: Simple YAML Frontmatter Parser
  // Handles: strings, numbers, booleans, dates, arrays, preserves unknown fields
  // ==========================================================================

  var Frontmatter = {
    /**
     * Parse a markdown file with frontmatter.
     * Returns { data: {}, content: string, raw: string }
     */
    parse: function (text) {
      text = text || '';
      var match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!match) {
        return { data: {}, content: text.trim(), raw: '' };
      }
      var yamlStr = match[1];
      var content = match[2];
      var data = this._parseYaml(yamlStr);
      return { data: data, content: content, raw: yamlStr };
    },

    /**
     * Serialize data + content back to a markdown string with frontmatter.
     * Preserves field order and unknown fields.
     */
    serialize: function (data, content) {
      var yaml = this._serializeYaml(data);
      return '---\n' + yaml + '---\n' + (content || '');
    },

    /** Parse simple YAML */
    _parseYaml: function (str) {
      var result = {};
      var lines = str.split(/\r?\n/);
      var i = 0;
      while (i < lines.length) {
        var line = lines[i];
        // Skip empty lines and comments
        if (line.trim() === '' || line.trim().charAt(0) === '#') { i++; continue; }
        var kv = line.match(/^(\w[\w\-]*)\s*:\s*(.*)$/);
        if (!kv) { i++; continue; }
        var key = kv[1];
        var val = kv[2].trim();
        // Check for multi-line array (next lines start with "  - ")
        if (val === '' || val === '|' || val === '>') {
          // Could be array or multiline string
          var arr = [];
          var multiline = [];
          var j = i + 1;
          while (j < lines.length) {
            var nextLine = lines[j];
            if (nextLine.match(/^\s+-\s+/)) {
              arr.push(nextLine.replace(/^\s+-\s+/, '').trim());
              j++;
            } else if (nextLine.match(/^\s+/) && nextLine.trim() !== '') {
              multiline.push(nextLine.trim());
              j++;
            } else {
              break;
            }
          }
          if (arr.length > 0) {
            result[key] = arr.map(function (v) { return Frontmatter._parseValue(v); });
          } else if (multiline.length > 0) {
            result[key] = multiline.join('\n');
          } else {
            result[key] = val === '' ? '' : val;
          }
          i = j;
          continue;
        }
        // Inline array [a, b, c]
        if (val.charAt(0) === '[' && val.charAt(val.length - 1) === ']') {
          var inner = val.slice(1, -1);
          if (inner.trim() === '') {
            result[key] = [];
          } else {
            result[key] = inner.split(',').map(function (v) {
              return Frontmatter._parseValue(v.trim());
            });
          }
          i++; continue;
        }
        result[key] = this._parseValue(val);
        i++;
      }
      return result;
    },

    _parseValue: function (val) {
      if (val === 'true') return true;
      if (val === 'false') return false;
      if (val === 'null' || val === '~') return null;
      // Quoted string
      if ((val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') ||
          (val.charAt(0) === "'" && val.charAt(val.length - 1) === "'")) {
        return val.slice(1, -1);
      }
      // Number
      if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
      // Date (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
      return val;
    },

    /** Serialize object to simple YAML */
    _serializeYaml: function (obj) {
      var lines = [];
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var val = obj[key];
        if (val === null || val === undefined) {
          lines.push(key + ': ');
          continue;
        }
        if (Array.isArray(val)) {
          if (val.length === 0) {
            lines.push(key + ': []');
          } else {
            lines.push(key + ':');
            for (var j = 0; j < val.length; j++) {
              lines.push('  - ' + this._serializeValue(val[j]));
            }
          }
          continue;
        }
        if (typeof val === 'object') {
          // Flatten nested objects won't happen in frontmatter typically
          lines.push(key + ': ' + JSON.stringify(val));
          continue;
        }
        lines.push(key + ': ' + this._serializeValue(val));
      }
      return lines.join('\n') + '\n';
    },

    _serializeValue: function (val) {
      if (val === true) return 'true';
      if (val === false) return 'false';
      if (val === null || val === undefined) return '';
      if (typeof val === 'number') return String(val);
      var s = String(val);
      // Quote if contains special characters
      if (s.indexOf(':') !== -1 || s.indexOf('#') !== -1 || s.indexOf('{') !== -1 ||
          s.indexOf('}') !== -1 || s.indexOf('[') !== -1 || s.indexOf(']') !== -1 ||
          s.indexOf(',') !== -1 || s.indexOf('&') !== -1 || s.indexOf('*') !== -1 ||
          s.indexOf('?') !== -1 || s.indexOf('|') !== -1 || s.indexOf('>') !== -1 ||
          s.indexOf("'") !== -1 || s.indexOf('"') !== -1 || s.indexOf('`') !== -1 ||
          s.indexOf('@') !== -1 || s.indexOf('%') !== -1) {
        return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
      }
      return s;
    }
  };

  // ==========================================================================
  // SECTION 3: Simple Markdown-to-HTML Converter
  // ==========================================================================

  function markdownToHtml(md) {
    if (!md) return '';
    var html = md;

    // Code blocks (fenced)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      return '<pre><code class="language-' + esc(lang) + '">' + esc(code.trim()) + '</code></pre>';
    });

    // Inline code (escape content for safety)
    html = html.replace(/`([^`]+)`/g, function (_, code) {
      return '<code>' + esc(code) + '</code>';
    });

    // Images (escape alt and src for safety)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, src) {
      return '<img alt="' + esc(alt) + '" src="' + esc(src) + '">';
    });

    // Links (escape href, sanitize javascript: URIs)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, text, href) {
      var safeHref = /^\s*javascript\s*:/i.test(href) ? '#' : esc(href);
      return '<a href="' + safeHref + '">' + esc(text) + '</a>';
    });

    // Headings
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^\*\*\*$/gm, '<hr>');

    // Bold + Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

    // Unordered lists
    html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Paragraphs (lines not already wrapped)
    var lines = html.split('\n');
    var result = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (l === '') {
        result.push('');
      } else if (l.charAt(0) === '<') {
        result.push(l);
      } else {
        result.push('<p>' + l + '</p>');
      }
    }

    return result.join('\n');
  }

  /**
   * Sanitize HTML before inserting into the preview pane.
   * Strips <script> tags and inline event handlers (onerror, onclick, etc.)
   * so user-written markdown cannot execute arbitrary JS in the preview.
   * Uses DOMParser which is available in all modern browsers.
   */
  function sanitizePreviewHtml(html) {
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      // Remove all <script> elements
      doc.querySelectorAll('script').forEach(function (el) { el.remove(); });
      // Strip inline event handler attributes from every element
      doc.querySelectorAll('*').forEach(function (el) {
        for (var i = el.attributes.length - 1; i >= 0; i--) {
          if (/^on/i.test(el.attributes[i].name)) {
            el.removeAttribute(el.attributes[i].name);
          }
        }
      });
      return doc.body.innerHTML;
    } catch (_) {
      return '';
    }
  }

  // ==========================================================================
  // SECTION 4: Toast Notifications
  // ==========================================================================

  var Toast = {
    container: null,
    init: function () {
      this.container = document.getElementById('toast-container');
    },
    show: function (message, type) {
      type = type || 'info';
      var icons = {
        success: '<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
        error: '<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
        warning: '<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
        info: '<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>'
      };
      var toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
        '<span class="toast-message">' + esc(message) + '</span>' +
        '<button class="toast-close" aria-label="Dismiss">&times;</button>';
      this.container.appendChild(toast);
      var self = this;
      toast.querySelector('.toast-close').addEventListener('click', function () {
        self._remove(toast);
      });
      setTimeout(function () { self._remove(toast); }, 5000);
    },
    _remove: function (el) {
      if (!el || !el.parentNode) return;
      el.classList.add('toast-out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }
  };

  // ==========================================================================
  // SECTION 5: Modal / Confirm Dialog
  // ==========================================================================

  var Modal = {
    overlay: null,
    titleEl: null,
    bodyEl: null,
    footerEl: null,
    closeEl: null,
    _resolve: null,

    init: function () {
      this.overlay = document.getElementById('modal-overlay');
      this.titleEl = document.getElementById('modal-title');
      this.bodyEl = document.getElementById('modal-body');
      this.footerEl = document.getElementById('modal-footer');
      this.closeEl = document.getElementById('modal-close');
      var self = this;
      this.closeEl.addEventListener('click', function () { self.close(false); });
      this.overlay.addEventListener('click', function (e) {
        if (e.target === self.overlay) self.close(false);
      });
    },

    open: function (opts) {
      this.titleEl.textContent = opts.title || '';
      this.bodyEl.innerHTML = opts.body || '';
      this.footerEl.innerHTML = opts.footer || '';
      this.overlay.style.display = 'flex';
      var self = this;
      return new Promise(function (resolve) {
        self._resolve = resolve;
      });
    },

    close: function (val) {
      this.overlay.style.display = 'none';
      if (this._resolve) {
        this._resolve(val);
        this._resolve = null;
      }
    },

    confirm: function (message, opts) {
      opts = opts || {};
      var self = this;
      return this.open({
        title: opts.title || 'Confirm',
        body: '<p>' + esc(message) + '</p>',
        footer: '<button class="btn btn-secondary" id="modal-cancel">' + (opts.cancelText || 'Cancel') +
          '</button><button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') +
          '" id="modal-ok">' + (opts.okText || 'Confirm') + '</button>'
      }).then(function (val) { return val; });
    }
  };

  // Attach modal button handlers via delegation
  document.addEventListener('click', function (e) {
    if (e.target.id === 'modal-ok') Modal.close(true);
    if (e.target.id === 'modal-cancel') Modal.close(false);
  });

  // ==========================================================================
  // SECTION 6: GitHub API Client
  // ==========================================================================

  var GitHub = {
    token: '',
    repo: '',   // "owner/repo"
    branch: 'main',
    baseUrl: 'https://api.github.com',

    /** Configure the client */
    configure: function (token, repo, branch) {
      this.token = token;
      this.repo = repo;
      this.branch = branch || 'main';
    },

    /** Make an authenticated API request */
    request: function (method, path, body) {
      var url = this.baseUrl + path;
      var opts = {
        method: method,
        headers: {
          'Authorization': 'Bearer ' + this.token,
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      return fetch(url, opts).then(function (res) {
        if (res.status === 204) return null;
        return res.json().then(function (data) {
          if (!res.ok) {
            var msg = (data && data.message) ? data.message : 'API error ' + res.status;
            var err = new Error(msg);
            err.status = res.status;
            err.data = data;
            throw err;
          }
          return data;
        });
      });
    },

    /** GET helper */
    get: function (path) { return this.request('GET', path); },

    /** PUT helper */
    put: function (path, body) { return this.request('PUT', path, body); },

    /** DELETE helper */
    del: function (path, body) {
      // DELETE with body needs special handling
      var url = this.baseUrl + path;
      return fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + this.token,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (res.status === 200 || res.status === 204) return null;
        return res.json().then(function (data) {
          var msg = (data && data.message) ? data.message : 'API error ' + res.status;
          var err = new Error(msg);
          err.status = res.status;
          throw err;
        });
      });
    },

    /** Validate token by fetching user */
    getUser: function () {
      return this.get('/user');
    },

    /** Get repository info */
    getRepo: function () {
      return this.get('/repos/' + this.repo);
    },

    /** List files in a directory */
    listFiles: function (path) {
      return this.get('/repos/' + this.repo + '/contents/' + path + '?ref=' + this.branch);
    },

    /** Get a single file (returns {content, sha, ...}) */
    getFile: function (path) {
      return this.get('/repos/' + this.repo + '/contents/' + path + '?ref=' + this.branch);
    },

    /** Create or update a file */
    saveFile: function (path, content, message, sha) {
      var body = {
        message: message,
        content: b64encode(content),
        branch: this.branch
      };
      if (sha) body.sha = sha;
      return this.put('/repos/' + this.repo + '/contents/' + path, body);
    },

    /** Delete a file */
    deleteFile: function (path, sha, message) {
      return this.del('/repos/' + this.repo + '/contents/' + path, {
        message: message,
        sha: sha,
        branch: this.branch
      });
    },

    /** Upload a binary file (base64 content) */
    uploadFile: function (path, base64Content, message) {
      return this.put('/repos/' + this.repo + '/contents/' + path, {
        message: message,
        content: base64Content,
        branch: this.branch
      });
    }
  };

  // ==========================================================================
  // SECTION 7: Web Crypto — Password-based PAT encryption (AES-GCM + PBKDF2)
  // Zero dependencies. Uses browser-native SubtleCrypto API.
  // The PAT is NEVER stored in plaintext. Only the encrypted blob is persisted.
  // ==========================================================================

  var Crypto = {
    SALT_LEN: 16,
    IV_LEN: 12,
    ITERATIONS: 600000, // OWASP recommended PBKDF2 iterations (2024+)

    /** Derive an AES-GCM key from a password + salt using PBKDF2 */
    _deriveKey: function (password, salt) {
      return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      ).then(function (keyMaterial) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: Crypto.ITERATIONS, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      });
    },

    /**
     * Encrypt plaintext with a password.
     * Returns a base64 string: salt (16B) + iv (12B) + ciphertext
     */
    encrypt: function (plaintext, password) {
      var salt = crypto.getRandomValues(new Uint8Array(this.SALT_LEN));
      var iv = crypto.getRandomValues(new Uint8Array(this.IV_LEN));
      var encoded = new TextEncoder().encode(plaintext);
      return this._deriveKey(password, salt).then(function (key) {
        return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoded);
      }).then(function (cipherBuf) {
        // Concatenate: salt + iv + ciphertext
        var cipher = new Uint8Array(cipherBuf);
        var combined = new Uint8Array(salt.length + iv.length + cipher.length);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(cipher, salt.length + iv.length);
        // Convert to base64
        var binary = '';
        for (var i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
        return btoa(binary);
      });
    },

    /**
     * Decrypt a base64 blob with a password.
     * Returns the plaintext string, or throws on wrong password.
     */
    decrypt: function (base64, password) {
      var binary = atob(base64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var salt = bytes.slice(0, this.SALT_LEN);
      var iv = bytes.slice(this.SALT_LEN, this.SALT_LEN + this.IV_LEN);
      var ciphertext = bytes.slice(this.SALT_LEN + this.IV_LEN);
      return this._deriveKey(password, salt).then(function (key) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext);
      }).then(function (decrypted) {
        return new TextDecoder().decode(decrypted);
      });
    }
  };

  // ==========================================================================
  // SECTION 8: Auth Manager — Encrypted PAT with password unlock
  //
  // How it works:
  //   FIRST TIME: User enters PAT + repo + chooses a password.
  //               PAT is encrypted with AES-256-GCM derived from password.
  //               Encrypted blob + repo/branch stored in localStorage.
  //               PAT lives only in memory during the session.
  //
  //   RETURNING:  User enters password only.
  //               Blob is decrypted → PAT recovered → session starts.
  //               Wrong password = decryption fails = no access.
  //
  //   LOGOUT:     PAT cleared from memory. Encrypted blob stays (for next login).
  //
  //   RESET:      User can wipe everything and start fresh (new PAT + password).
  // ==========================================================================

  var Auth = {
    STORAGE_KEY: 'jinpa_vault',
    user: null,

    /** Check if encrypted credentials exist */
    hasVault: function () {
      try {
        var saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          var data = JSON.parse(saved);
          return !!(data.encrypted && data.repo);
        }
      } catch (e) { /* ignore */ }
      return false;
    },

    /** Get stored repo/branch (non-secret, readable without password) */
    getVaultInfo: function () {
      try {
        var saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          var data = JSON.parse(saved);
          return { repo: data.repo || '', branch: data.branch || 'main' };
        }
      } catch (e) { /* ignore */ }
      return null;
    },

    /** First-time setup: encrypt PAT with password and store */
    setup: function (token, repo, branch, password) {
      var self = this;
      GitHub.configure(token, repo, branch);
      return this.validate().then(function (user) {
        return GitHub.getRepo().then(function (repoData) {
          if (!repoData.permissions || !repoData.permissions.push) {
            throw new Error('You do not have write access to ' + repo + '. Check the repository name and your token permissions.');
          }
          return GitHub.getFile('site.config.json').then(function () {
            // All validated — encrypt and store
            return Crypto.encrypt(token, password).then(function (encrypted) {
              localStorage.setItem(self.STORAGE_KEY, JSON.stringify({
                encrypted: encrypted,
                repo: repo,
                branch: branch || 'main'
              }));
              return user;
            });
          }).catch(function (err) {
            if (err.message && err.message.indexOf('write access') !== -1) throw err;
            throw new Error('This does not appear to be a Jinpa site. Could not find site.config.json in ' + repo + '.');
          });
        });
      });
    },

    /** Returning user: unlock vault with password */
    unlock: function (password) {
      var self = this;
      var saved;
      try {
        saved = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
      } catch (e) {
        return Promise.reject(new Error('No saved credentials found.'));
      }
      if (!saved || !saved.encrypted) {
        return Promise.reject(new Error('No saved credentials found.'));
      }
      return Crypto.decrypt(saved.encrypted, password).then(function (token) {
        GitHub.configure(token, saved.repo, saved.branch);
        return self.validate();
      }).catch(function (err) {
        GitHub.token = '';
        // DOMException from SubtleCrypto means wrong password
        if (err.name === 'OperationError' || err.message === 'The operation failed for an operation-specific reason') {
          throw new Error('Wrong password. Please try again.');
        }
        throw err;
      });
    },

    /** Validate current credentials (fetch GitHub user) */
    validate: function () {
      var self = this;
      return GitHub.getUser().then(function (user) {
        self.user = user;
        return user;
      });
    },

    /** Logout — clear PAT from memory, keep vault for re-login */
    logout: function () {
      this.user = null;
      GitHub.token = '';
      GitHub.repo = '';
    },

    /** Full reset — wipe everything */
    reset: function () {
      localStorage.removeItem(this.STORAGE_KEY);
      this.user = null;
      GitHub.token = '';
      GitHub.repo = '';
    }
  };

  // ==========================================================================
  // SECTION 9: Router
  // ==========================================================================

  var Router = {
    routes: {},
    currentRoute: '',

    /** Register a route handler */
    on: function (path, handler) {
      this.routes[path] = handler;
    },

    /** Navigate to a route */
    navigate: function (path) {
      window.location.hash = path;
    },

    /** Start listening */
    start: function () {
      var self = this;
      window.addEventListener('hashchange', function () { self._handleRoute(); });
      this._handleRoute();
    },

    /** Handle the current hash */
    _handleRoute: function () {
      var hash = window.location.hash || '#/dashboard';
      var path = hash.slice(1); // remove #

      // Update active nav item
      var navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(function (item) {
        var route = item.getAttribute('data-route');
        if (route && path.indexOf('/' + route) === 0) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      // Match route
      var matched = false;
      var routeKeys = Object.keys(this.routes);
      for (var i = 0; i < routeKeys.length; i++) {
        var pattern = routeKeys[i];
        var params = this._match(pattern, path);
        if (params !== null) {
          this.currentRoute = path;
          this.routes[pattern](params);
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Default to dashboard
        this.navigate('/dashboard');
      }

      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
    },

    /** Match a route pattern and extract params */
    _match: function (pattern, path) {
      var patternParts = pattern.split('/');
      var pathParts = path.split('/');
      if (patternParts.length !== pathParts.length) return null;
      var params = {};
      for (var i = 0; i < patternParts.length; i++) {
        if (patternParts[i].charAt(0) === ':') {
          params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
        } else if (patternParts[i] !== pathParts[i]) {
          return null;
        }
      }
      return params;
    }
  };

  // ==========================================================================
  // SECTION 10: Content Cache
  // ==========================================================================

  var Cache = {
    _data: {},
    _ttl: 60000, // 1 minute
    get: function (key) {
      var entry = this._data[key];
      if (entry && (Date.now() - entry.time) < this._ttl) return entry.value;
      return null;
    },
    set: function (key, value) {
      this._data[key] = { value: value, time: Date.now() };
    },
    clear: function (key) {
      if (key) { delete this._data[key]; } else { this._data = {}; }
    }
  };

  // ==========================================================================
  // SECTION 11: Content Manager (Posts & Pages CRUD)
  // ==========================================================================

  var Content = {
    postsPath: 'src/content/posts',
    pagesPath: 'src/content/pages',
    imagesPath: 'src/assets/images',

    /** List all posts */
    listPosts: function (forceRefresh) {
      if (!forceRefresh) {
        var cached = Cache.get('posts');
        if (cached) return Promise.resolve(cached);
      }
      return GitHub.listFiles(this.postsPath).then(function (files) {
        var posts = (files || []).filter(function (f) {
          return f.name.endsWith('.md');
        }).map(function (f) {
          return { name: f.name, path: f.path, sha: f.sha, size: f.size };
        });
        // Sort by name desc (newest date first)
        posts.sort(function (a, b) { return b.name.localeCompare(a.name); });
        Cache.set('posts', posts);
        return posts;
      }).catch(function (err) {
        if (err.status === 404) return [];
        throw err;
      });
    },

    /** Get a single post with full content */
    getPost: function (filename) {
      return GitHub.getFile(this.postsPath + '/' + filename).then(function (file) {
        var raw = b64decode(file.content);
        var parsed = Frontmatter.parse(raw);
        return {
          filename: file.name,
          path: file.path,
          sha: file.sha,
          frontmatter: parsed.data,
          content: parsed.content,
          raw: raw
        };
      });
    },

    /** Create a new post */
    createPost: function (data, content) {
      var dateStr = data.date || today();
      var slug = data.slug || slugify(data.title);
      var filename = postFilename(dateStr, slug);
      var body = Frontmatter.serialize(data, content);
      Cache.clear('posts');
      return GitHub.saveFile(
        this.postsPath + '/' + filename,
        body,
        'Create post: ' + data.title
      );
    },

    /** Update an existing post */
    updatePost: function (filename, sha, data, content) {
      var body = Frontmatter.serialize(data, content);
      Cache.clear('posts');
      return GitHub.saveFile(
        this.postsPath + '/' + filename,
        body,
        'Update post: ' + (data.title || filename),
        sha
      );
    },

    /** Delete a post */
    deletePost: function (filename, sha) {
      Cache.clear('posts');
      return GitHub.deleteFile(
        this.postsPath + '/' + filename,
        sha,
        'Delete post: ' + filename
      );
    },

    /** List all pages */
    listPages: function (forceRefresh) {
      if (!forceRefresh) {
        var cached = Cache.get('pages');
        if (cached) return Promise.resolve(cached);
      }
      return GitHub.listFiles(this.pagesPath).then(function (files) {
        var pages = (files || []).filter(function (f) {
          return f.name.endsWith('.md');
        }).map(function (f) {
          return { name: f.name, path: f.path, sha: f.sha, size: f.size };
        });
        pages.sort(function (a, b) { return a.name.localeCompare(b.name); });
        Cache.set('pages', pages);
        return pages;
      }).catch(function (err) {
        if (err.status === 404) return [];
        throw err;
      });
    },

    /** Get a single page */
    getPage: function (filename) {
      return GitHub.getFile(this.pagesPath + '/' + filename).then(function (file) {
        var raw = b64decode(file.content);
        var parsed = Frontmatter.parse(raw);
        return {
          filename: file.name,
          path: file.path,
          sha: file.sha,
          frontmatter: parsed.data,
          content: parsed.content,
          raw: raw
        };
      });
    },

    /** Create a new page */
    createPage: function (data, content) {
      var slug = data.slug || slugify(data.title);
      var filename = pageFilename(slug);
      var body = Frontmatter.serialize(data, content);
      Cache.clear('pages');
      return GitHub.saveFile(
        this.pagesPath + '/' + filename,
        body,
        'Create page: ' + data.title
      );
    },

    /** Update an existing page */
    updatePage: function (filename, sha, data, content) {
      var body = Frontmatter.serialize(data, content);
      Cache.clear('pages');
      return GitHub.saveFile(
        this.pagesPath + '/' + filename,
        body,
        'Update page: ' + (data.title || filename),
        sha
      );
    },

    /** Delete a page */
    deletePage: function (filename, sha) {
      Cache.clear('pages');
      return GitHub.deleteFile(
        this.pagesPath + '/' + filename,
        sha,
        'Delete page: ' + filename
      );
    },

    /** List images recursively */
    listImages: function (path, forceRefresh) {
      path = path || this.imagesPath;
      var cacheKey = 'images_' + path;
      if (!forceRefresh) {
        var cached = Cache.get(cacheKey);
        if (cached) return Promise.resolve(cached);
      }
      var self = this;
      return GitHub.listFiles(path).then(function (files) {
        var images = [];
        var dirs = [];
        (files || []).forEach(function (f) {
          if (f.type === 'dir') {
            dirs.push(f);
          } else if (/\.(jpe?g|png|gif|svg|webp|avif|ico)$/i.test(f.name)) {
            images.push({
              name: f.name,
              path: f.path,
              sha: f.sha,
              size: f.size,
              download_url: f.download_url
            });
          }
        });
        // Recurse into subdirectories
        var promises = dirs.map(function (d) { return self.listImages(d.path, forceRefresh); });
        return Promise.all(promises).then(function (subResults) {
          subResults.forEach(function (sub) {
            images = images.concat(sub);
          });
          Cache.set(cacheKey, images);
          return images;
        });
      }).catch(function (err) {
        if (err.status === 404) return [];
        throw err;
      });
    },

    /** Upload an image.
     *
     * Raster images (JPG, PNG, WebP …) are first run through a Canvas pipeline
     * in the browser: scaled down to a 1920px ceiling on the longest side and
     * re-encoded as JPEG at 85 % quality. This means images are already
     * web-optimised before they leave the browser — no server or CDN needed.
     *
     * SVG and GIF bypass the Canvas pipeline and are stored as-is (SVGs are
     * vector, GIFs may be animated).
     *
     * Files are committed to src/assets/images/YYYY/MM/ so Astro's <Image>
     * component can further optimise them (WebP conversion, size hints) at
     * build time. */
    uploadImage: function (file) {
      var self = this;
      var now = new Date();
      var yyyy = now.getFullYear();
      var mm = String(now.getMonth() + 1).padStart(2, '0');

      return new Promise(function (resolve, reject) {

        /** Commit a Blob or File to GitHub as base64. */
        function _commit(blob, filename) {
          var uploadPath = self.imagesPath + '/' + yyyy + '/' + mm + '/' + filename;
          var reader = new FileReader();
          reader.onload = function () {
            var base64 = reader.result.split(',')[1];
            Cache.clear();
            GitHub.uploadFile(uploadPath, base64, 'Upload image: ' + filename)
              .then(resolve)
              .catch(reject);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }

        // SVG and GIF: store verbatim (vector / possibly animated)
        if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
          var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
          _commit(file, safeName);
          return;
        }

        // Raster images: resize ≤ 1920px on longest side, recompress JPEG 85%
        var objectUrl = URL.createObjectURL(file);
        var img = new window.Image();

        img.onload = function () {
          URL.revokeObjectURL(objectUrl);

          var MAX = 1920;
          var w = img.naturalWidth;
          var h = img.naturalHeight;
          if (w > MAX || h > MAX) {
            if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
            else        { w = Math.round(w * MAX / h); h = MAX; }
          }

          var canvas = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);

          canvas.toBlob(function (blob) {
            var base = file.name
              .replace(/\.[^.]+$/, '')          // strip extension
              .replace(/[^a-zA-Z0-9_-]/g, '-')  // sanitise
              .toLowerCase();
            _commit(blob, base + '.jpg');
          }, 'image/jpeg', 0.85);
        };

        img.onerror = function () {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Could not read image file'));
        };

        img.src = objectUrl;
      });
    },

    /** Get site config */
    getSiteConfig: function () {
      return GitHub.getFile('site.config.json').then(function (file) {
        var raw = b64decode(file.content);
        return { data: JSON.parse(raw), sha: file.sha };
      });
    },

    /** Save site config */
    saveSiteConfig: function (data, sha) {
      var content = JSON.stringify(data, null, 2) + '\n';
      return GitHub.saveFile('site.config.json', content, 'Update site configuration', sha);
    },

    /** Get theme config */
    getThemeConfig: function () {
      return GitHub.getFile('theme.config.json').then(function (file) {
        var raw = b64decode(file.content);
        return { data: JSON.parse(raw), sha: file.sha };
      });
    },

    /** Save theme config */
    saveThemeConfig: function (data, sha) {
      var content = JSON.stringify(data, null, 2) + '\n';
      return GitHub.saveFile('theme.config.json', content, 'Update theme configuration', sha);
    }
  };

  // ==========================================================================
  // SECTION 12: View Renderers
  // ==========================================================================

  var contentArea = null;
  var topbarTitle = null;
  var topbarActions = null;

  function setTitle(title) {
    topbarTitle.textContent = title;
    document.title = title + ' — Jinpa CMS';
  }

  function setActions(html) {
    topbarActions.innerHTML = html || '';
  }

  function render(html) {
    contentArea.innerHTML = html;
  }

  function showLoading() {
    render('<div class="loading-state"><div class="spinner"></div></div>');
  }

  function showError(msg) {
    render('<div class="empty-state"><svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg><h3>Error</h3><p>' + esc(msg) + '</p></div>');
  }

  // ---- 11a: Dashboard ----

  function renderDashboard() {
    setTitle('Dashboard');
    setActions('');
    showLoading();

    Promise.all([
      Content.listPosts(),
      Content.listPages()
    ]).then(function (results) {
      var posts = results[0];
      var pages = results[1];

      var recentPosts = posts.slice(0, 5);

      var html = '';

      // Jinpa updates widget (populated async after render)
      html += '<div id="jinpa-updates-widget"></div>';

      // Stats
      html += '<div class="stats-grid">';
      html += '<div class="stat-card"><div class="stat-icon blue"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/></svg></div><div class="stat-label">Posts</div><div class="stat-value">' + posts.length + '</div></div>';
      html += '<div class="stat-card"><div class="stat-icon green"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg></div><div class="stat-label">Pages</div><div class="stat-value">' + pages.length + '</div></div>';
      html += '<div class="stat-card"><div class="stat-icon purple"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z"/></svg></div><div class="stat-label">Repository</div><div class="stat-value text-sm font-semibold" style="font-size:0.875rem;">' + esc(GitHub.repo) + '</div></div>';
      html += '<div class="stat-card"><div class="stat-icon amber"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clip-rule="evenodd"/></svg></div><div class="stat-label">Branch</div><div class="stat-value text-sm font-semibold" style="font-size:0.875rem;">' + esc(GitHub.branch) + '</div></div>';
      html += '</div>';

      // Quick actions
      html += '<div class="quick-actions">';
      html += '<a href="#/posts/new" class="quick-action"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>New Post</a>';
      html += '<a href="#/pages/new" class="quick-action"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>New Page</a>';
      html += '<a href="#/media" class="quick-action"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg>Manage Media</a>';
      html += '<a href="#/settings" class="quick-action"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>Settings</a>';
      html += '</div>';

      // Recent posts
      html += '<div class="card">';
      html += '<div class="card-header"><h3>Recent Posts</h3><a href="#/posts" class="btn btn-sm btn-secondary">View All</a></div>';
      if (recentPosts.length === 0) {
        html += '<div class="card-body"><div class="empty-state"><p>No posts yet. Create your first post!</p><a href="#/posts/new" class="btn btn-primary btn-sm">New Post</a></div></div>';
      } else {
        html += '<div class="card-body" style="padding:0;"><ul class="recent-posts-list" style="padding:0 1.25rem;">';
        recentPosts.forEach(function (p) {
          // Extract title from filename: YYYY-MM-DD-slug.md -> slug
          var parts = p.name.replace('.md', '').split('-');
          var dateStr = parts.slice(0, 3).join('-');
          var titleSlug = parts.slice(3).join('-');
          html += '<li><a class="post-title" href="#/posts/edit/' + encodeURIComponent(p.name) + '">' + esc(titleSlug.replace(/-/g, ' ')) + '</a><span class="post-date">' + displayDate(dateStr) + '</span></li>';
        });
        html += '</ul></div>';
      }
      html += '</div>';

      render(html);
      fetchJinpaUpdates();
    }).catch(function (err) {
      showError(err.message);
    });
  }

  // ---- Jinpa Updates Widget ----

  var JINPA_UPDATES_URL = 'https://getjinpa.com/updates.json';
  var JINPA_UPDATES_CACHE_KEY = 'jinpa_updates_cache';
  var JINPA_DISMISSED_KEY = 'jinpa_dismissed';

  function fetchJinpaUpdates() {
    // Try sessionStorage cache (1 hour TTL)
    try {
      var cached = sessionStorage.getItem(JINPA_UPDATES_CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 3600000) {
          renderUpdatesWidget(parsed.data);
          return;
        }
      }
    } catch (e) {}

    fetch(JINPA_UPDATES_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        try {
          sessionStorage.setItem(JINPA_UPDATES_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
        } catch (e) {}
        renderUpdatesWidget(data);
      })
      .catch(function () { /* fail silently — no internet or endpoint down */ });
  }

  function renderUpdatesWidget(data) {
    var widget = document.getElementById('jinpa-updates-widget');
    if (!widget) return;

    var dismissed = [];
    try { dismissed = JSON.parse(localStorage.getItem(JINPA_DISMISSED_KEY) || '[]'); } catch (e) {}

    var html = '<style>'
      + '.jinpa-announcement{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:.875rem 1rem;border-radius:.5rem;border:1px solid;margin-bottom:.5rem;}'
      + '.announcement-info{background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.2);}'
      + '.announcement-warning{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.2);}'
      + '.announcement-success{background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.2);}'
      + '.announcement-content{display:flex;flex-direction:column;gap:.25rem;font-size:.875rem;}'
      + '.announcement-content strong{font-weight:600;}'
      + '.announcement-dismiss{flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--text-tertiary);padding:.125rem;border-radius:.25rem;display:flex;line-height:1;}'
      + '.announcement-dismiss:hover{color:var(--text-primary);}'
      + '.jinpa-tip{display:flex;align-items:flex-start;gap:.625rem;padding:.75rem 1rem;background:var(--bg-surface-raised);border-radius:.5rem;border:1px solid var(--border-color);font-size:.8125rem;color:var(--text-secondary);margin-bottom:1rem;}'
      + '.jinpa-tip svg{flex-shrink:0;margin-top:.1rem;color:var(--color-primary);}'
      + '</style>';

    // Announcements (non-dismissed)
    var announcements = (data.announcements || []).filter(function (a) {
      return dismissed.indexOf(a.id) === -1;
    });
    announcements.forEach(function (a) {
      var cls = 'announcement-' + (a.type || 'info');
      html += '<div class="jinpa-announcement ' + cls + '" data-ann-id="' + esc(a.id) + '">';
      html += '<div class="announcement-content"><strong>' + esc(a.title) + '</strong><span>' + esc(a.body) + '</span></div>';
      if (a.dismissible) {
        html += '<button class="announcement-dismiss" data-dismiss="' + esc(a.id) + '" title="Dismiss">'
          + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
          + '</button>';
      }
      html += '</div>';
    });

    // Random tip
    var tips = data.tips || [];
    if (tips.length > 0) {
      var tip = tips[Math.floor(Math.random() * tips.length)];
      html += '<div class="jinpa-tip">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        + '<span>' + esc(tip.text) + '</span>'
        + '</div>';
    }

    widget.innerHTML = html;

    // Dismiss button listeners
    widget.querySelectorAll('[data-dismiss]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-dismiss');
        var list = [];
        try { list = JSON.parse(localStorage.getItem(JINPA_DISMISSED_KEY) || '[]'); } catch (e) {}
        if (list.indexOf(id) === -1) list.push(id);
        try { localStorage.setItem(JINPA_DISMISSED_KEY, JSON.stringify(list)); } catch (e) {}
        var ann = widget.querySelector('[data-ann-id="' + id + '"]');
        if (ann) ann.remove();
      });
    });
  }

  // ---- 11b: Posts List ----

  function renderPosts() {
    setTitle('Posts');
    setActions('<a href="#/posts/new" class="btn btn-primary btn-sm"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>New Post</a>');
    showLoading();

    Content.listPosts().then(function (posts) {
      // We need frontmatter from each to show title & status
      // For performance, we'll just parse filenames and load on demand
      if (posts.length === 0) {
        render('<div class="empty-state"><svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/></svg><h3>No posts yet</h3><p>Create your first blog post to get started.</p><a href="#/posts/new" class="btn btn-primary">New Post</a></div>');
        return;
      }

      // Load all post frontmatters (just the file metadata from filenames)
      var html = '<div class="card"><div class="table-wrapper"><table><thead><tr><th>Title</th><th>Date</th><th>Status</th><th style="width:120px;">Actions</th></tr></thead><tbody>';

      posts.forEach(function (p) {
        var parts = p.name.replace('.md', '').split('-');
        var dateStr = parts.slice(0, 3).join('-');
        var titleSlug = parts.slice(3).join('-');
        var displayTitle = titleSlug.replace(/-/g, ' ');
        displayTitle = displayTitle.charAt(0).toUpperCase() + displayTitle.slice(1);

        html += '<tr>';
        html += '<td><a href="#/posts/edit/' + encodeURIComponent(p.name) + '" style="font-weight:500;color:var(--text);">' + esc(displayTitle) + '</a><div class="text-xs text-muted font-mono mt-1">' + esc(p.name) + '</div></td>';
        html += '<td>' + displayDate(dateStr) + '</td>';
        html += '<td><span class="badge badge-published">Published</span></td>';
        html += '<td><div class="actions">';
        html += '<a href="#/posts/edit/' + encodeURIComponent(p.name) + '" class="btn btn-sm btn-secondary">Edit</a>';
        html += '<button class="btn btn-sm btn-danger" data-delete-post="' + esc(p.name) + '" data-sha="' + esc(p.sha) + '">Delete</button>';
        html += '</div></td>';
        html += '</tr>';
      });

      html += '</tbody></table></div></div>';
      render(html);

      // Delete handlers
      contentArea.querySelectorAll('[data-delete-post]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.getAttribute('data-delete-post');
          var sha = btn.getAttribute('data-sha');
          Modal.confirm('Are you sure you want to delete "' + name + '"? This cannot be undone.', {
            title: 'Delete Post',
            okText: 'Delete',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            btn.disabled = true;
            btn.textContent = '...';
            Content.deletePost(name, sha).then(function () {
              Toast.show('Post deleted successfully.', 'success');
              renderPosts();
            }).catch(function (err) {
              Toast.show('Failed to delete: ' + err.message, 'error');
              btn.disabled = false;
              btn.textContent = 'Delete';
            });
          });
        });
      });
    }).catch(function (err) {
      showError(err.message);
    });
  }

  // ---- 11c: Post Editor (Create / Edit) ----

  function renderPostEditor(params) {
    var isEdit = params && params.id;
    setTitle(isEdit ? 'Edit Post' : 'New Post');
    setActions('<a href="#/posts" class="btn btn-sm btn-secondary">Back to Posts</a>');

    if (isEdit) {
      showLoading();
      Content.getPost(params.id).then(function (post) {
        _buildPostForm(post);
      }).catch(function (err) {
        showError(err.message);
      });
    } else {
      _buildPostForm(null);
    }
  }

  function _buildPostForm(existingPost) {
    var fm = existingPost ? existingPost.frontmatter : {};
    var body = existingPost ? existingPost.content : '';
    var sha = existingPost ? existingPost.sha : '';
    var filename = existingPost ? existingPost.filename : '';

    var tagStr = '';
    if (fm.tags) {
      tagStr = Array.isArray(fm.tags) ? fm.tags.join(', ') : String(fm.tags);
    }
    var catStr = '';
    if (fm.categories) {
      catStr = Array.isArray(fm.categories) ? fm.categories.join(', ') : String(fm.categories);
    }

    var html = '<form id="post-form">';
    html += '<div class="card mb-3"><div class="card-body">';

    // Title
    html += '<div class="form-group"><label for="post-title">Title <span class="text-danger">*</span></label><input type="text" id="post-title" value="' + esc(fm.title || '') + '" placeholder="Enter post title" required></div>';

    // Date & Slug
    html += '<div class="form-row">';
    html += '<div class="form-group"><label for="post-date">Date</label><input type="date" id="post-date" value="' + esc(fm.date || today()) + '"></div>';
    html += '<div class="form-group"><label for="post-slug">Slug</label><input type="text" id="post-slug" value="' + esc(fm.slug || (filename ? filename.replace('.md', '').replace(/^\d{4}-\d{2}-\d{2}-/, '') : '')) + '" placeholder="auto-generated-from-title"><div class="form-hint">Leave empty to auto-generate from title.</div></div>';
    html += '</div>';

    // Description
    html += '<div class="form-group"><label for="post-desc">Description</label><textarea id="post-desc" rows="2" placeholder="Brief description for SEO and previews">' + esc(fm.description || '') + '</textarea></div>';

    // Author
    html += '<div class="form-group"><label for="post-author">Author</label><input type="text" id="post-author" value="' + esc(fm.author || '') + '" placeholder="Author name"></div>';

    // Tags & Categories
    html += '<div class="form-row">';
    html += '<div class="form-group"><label for="post-tags">Tags</label><input type="text" id="post-tags" value="' + esc(tagStr) + '" placeholder="tag1, tag2, tag3"><div class="form-hint">Comma-separated</div></div>';
    html += '<div class="form-group"><label for="post-cats">Categories</label><input type="text" id="post-cats" value="' + esc(catStr) + '" placeholder="category1, category2"><div class="form-hint">Comma-separated</div></div>';
    html += '</div>';

    // Featured Image
    html += '<div class="form-group"><label for="post-image">Featured Image</label><input type="text" id="post-image" value="' + esc(fm.image || fm.heroImage || '') + '" placeholder="/src/assets/images/2024/01/photo.jpg"><div class="form-hint">Path to an image in your media library.</div></div>';

    // Draft
    html += '<div class="form-check"><input type="checkbox" id="post-draft"' + (fm.draft ? ' checked' : '') + '><label for="post-draft">Save as draft</label></div>';

    html += '</div></div>';

    // Markdown editor
    html += '<div class="card mb-3"><div class="card-header"><h3>Content</h3></div>';
    html += '<div class="editor-container">';
    html += '<div class="editor-toolbar">';
    html += '<button type="button" data-md="bold" title="Bold"><strong>B</strong></button>';
    html += '<button type="button" data-md="italic" title="Italic"><em>I</em></button>';
    html += '<button type="button" data-md="heading" title="Heading">H</button>';
    html += '<span class="separator"></span>';
    html += '<button type="button" data-md="link" title="Link">&#128279;</button>';
    html += '<button type="button" data-md="image" title="Image">&#128247;</button>';
    html += '<button type="button" data-md="code" title="Code">&lt;/&gt;</button>';
    html += '<span class="separator"></span>';
    html += '<button type="button" data-md="ul" title="Bullet List">&#8226;</button>';
    html += '<button type="button" data-md="ol" title="Numbered List">1.</button>';
    html += '<button type="button" data-md="quote" title="Blockquote">&#8221;</button>';
    html += '<button type="button" data-md="hr" title="Horizontal Rule">&#8213;</button>';
    html += '<button type="button" class="preview-toggle" id="toggle-preview">Preview</button>';
    html += '</div>';
    html += '<div class="editor-body">';
    html += '<div class="editor-write"><textarea id="post-content" placeholder="Write your post content in Markdown...">' + esc(body) + '</textarea></div>';
    html += '<div class="editor-preview" id="editor-preview"></div>';
    html += '</div></div>';
    html += '</div>';

    // Hidden fields
    html += '<input type="hidden" id="post-sha" value="' + esc(sha) + '">';
    html += '<input type="hidden" id="post-filename" value="' + esc(filename) + '">';

    // Save button
    html += '<div class="flex items-center justify-between">';
    html += '<a href="#/posts" class="btn btn-secondary">Cancel</a>';
    html += '<button type="submit" class="btn btn-primary btn-lg" id="post-save">' + (existingPost ? 'Update Post' : 'Create Post') + '</button>';
    html += '</div>';

    html += '</form>';
    render(html);

    // Store original frontmatter for preserving unknown fields on save
    contentArea._originalPostFrontmatter = existingPost ? existingPost.frontmatter : null;

    // Auto-slug from title
    var titleInput = document.getElementById('post-title');
    var slugInput = document.getElementById('post-slug');
    if (!existingPost) {
      titleInput.addEventListener('input', function () {
        slugInput.value = slugify(titleInput.value);
      });
    }

    // Markdown toolbar
    _setupMarkdownToolbar('post-content');

    // Preview toggle
    var previewBtn = document.getElementById('toggle-preview');
    var previewPane = document.getElementById('editor-preview');
    var editorTA = document.getElementById('post-content');
    previewBtn.addEventListener('click', function () {
      previewBtn.classList.toggle('active');
      previewPane.classList.toggle('visible');
      if (previewPane.classList.contains('visible')) {
        previewPane.innerHTML = sanitizePreviewHtml(markdownToHtml(editorTA.value));
      }
    });
    editorTA.addEventListener('input', debounce(function () {
      if (previewPane.classList.contains('visible')) {
        previewPane.innerHTML = sanitizePreviewHtml(markdownToHtml(editorTA.value));
      }
    }, 300));

    // Form submit
    document.getElementById('post-form').addEventListener('submit', function (e) {
      e.preventDefault();
      _savePost(!!existingPost);
    });
  }

  function _savePost(isEdit) {
    var title = document.getElementById('post-title').value.trim();
    if (!title) {
      Toast.show('Title is required.', 'error');
      return;
    }

    var date = document.getElementById('post-date').value || today();
    var slug = document.getElementById('post-slug').value.trim() || slugify(title);
    var description = document.getElementById('post-desc').value.trim();
    var author = document.getElementById('post-author').value.trim();
    var tags = document.getElementById('post-tags').value.trim();
    var cats = document.getElementById('post-cats').value.trim();
    var image = document.getElementById('post-image').value.trim();
    var draft = document.getElementById('post-draft').checked;
    var content = document.getElementById('post-content').value;
    var sha = document.getElementById('post-sha').value;
    var oldFilename = document.getElementById('post-filename').value;

    // Start with original frontmatter to preserve unknown fields (e.g. layout, featured, etc.)
    var original = contentArea._originalPostFrontmatter || {};
    var data = {};
    var origKeys = Object.keys(original);
    for (var k = 0; k < origKeys.length; k++) {
      data[origKeys[k]] = original[origKeys[k]];
    }
    // Overlay known fields
    data.title = title;
    data.date = date;
    data.slug = slug;
    if (description) { data.description = description; } else { delete data.description; }
    if (author) { data.author = author; } else { delete data.author; }
    if (tags) { data.tags = tags.split(',').map(function (t) { return t.trim(); }).filter(Boolean); } else { delete data.tags; }
    if (cats) { data.categories = cats.split(',').map(function (c) { return c.trim(); }).filter(Boolean); } else { delete data.categories; }
    if (image) { data.image = image; } else { delete data.image; }
    if (draft) { data.draft = true; } else { delete data.draft; }

    var btn = document.getElementById('post-save');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    var promise;
    if (isEdit && sha) {
      var newFilename = postFilename(date, slug);
      if (newFilename !== oldFilename) {
        // Filename changed (date or slug changed) — need to create new + delete old
        promise = Content.createPost(data, content).then(function () {
          return Content.deletePost(oldFilename, sha);
        });
      } else {
        promise = Content.updatePost(oldFilename, sha, data, content);
      }
    } else {
      promise = Content.createPost(data, content);
    }

    promise.then(function () {
      Toast.show(isEdit ? 'Post updated!' : 'Post created!', 'success');
      Router.navigate('/posts');
    }).catch(function (err) {
      Toast.show('Failed to save: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Update Post' : 'Create Post';
    });
  }

  // ---- 11d: Pages List ----

  function renderPages() {
    setTitle('Pages');
    setActions('<a href="#/pages/new" class="btn btn-primary btn-sm"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>New Page</a>');
    showLoading();

    Content.listPages().then(function (pages) {
      if (pages.length === 0) {
        render('<div class="empty-state"><svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg><h3>No pages yet</h3><p>Create your first page to get started.</p><a href="#/pages/new" class="btn btn-primary">New Page</a></div>');
        return;
      }

      var html = '<div class="card"><div class="table-wrapper"><table><thead><tr><th>Title / Filename</th><th style="width:120px;">Actions</th></tr></thead><tbody>';

      pages.forEach(function (p) {
        var displayName = p.name.replace('.md', '').replace(/-/g, ' ');
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

        html += '<tr>';
        html += '<td><a href="#/pages/edit/' + encodeURIComponent(p.name) + '" style="font-weight:500;color:var(--text);">' + esc(displayName) + '</a><div class="text-xs text-muted font-mono mt-1">' + esc(p.name) + '</div></td>';
        html += '<td><div class="actions">';
        html += '<a href="#/pages/edit/' + encodeURIComponent(p.name) + '" class="btn btn-sm btn-secondary">Edit</a>';
        html += '<button class="btn btn-sm btn-danger" data-delete-page="' + esc(p.name) + '" data-sha="' + esc(p.sha) + '">Delete</button>';
        html += '</div></td>';
        html += '</tr>';
      });

      html += '</tbody></table></div></div>';
      render(html);

      contentArea.querySelectorAll('[data-delete-page]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.getAttribute('data-delete-page');
          var sha = btn.getAttribute('data-sha');
          Modal.confirm('Are you sure you want to delete "' + name + '"?', {
            title: 'Delete Page',
            okText: 'Delete',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            btn.disabled = true;
            btn.textContent = '...';
            Content.deletePage(name, sha).then(function () {
              Toast.show('Page deleted.', 'success');
              renderPages();
            }).catch(function (err) {
              Toast.show('Delete failed: ' + err.message, 'error');
              btn.disabled = false;
              btn.textContent = 'Delete';
            });
          });
        });
      });
    }).catch(function (err) {
      showError(err.message);
    });
  }

  // ---- 11e: Page Editor ----

  function renderPageEditor(params) {
    var isEdit = params && params.id;
    setTitle(isEdit ? 'Edit Page' : 'New Page');
    setActions('<a href="#/pages" class="btn btn-sm btn-secondary">Back to Pages</a>');

    if (isEdit) {
      showLoading();
      Content.getPage(params.id).then(function (page) {
        _buildPageForm(page);
      }).catch(function (err) {
        showError(err.message);
      });
    } else {
      _buildPageForm(null);
    }
  }

  function _buildPageForm(existingPage) {
    var fm = existingPage ? existingPage.frontmatter : {};
    var body = existingPage ? existingPage.content : '';
    var sha = existingPage ? existingPage.sha : '';
    var filename = existingPage ? existingPage.filename : '';

    var html = '<form id="page-form">';
    html += '<div class="card mb-3"><div class="card-body">';

    html += '<div class="form-group"><label for="page-title">Title <span class="text-danger">*</span></label><input type="text" id="page-title" value="' + esc(fm.title || '') + '" placeholder="Page title" required></div>';

    html += '<div class="form-row">';
    html += '<div class="form-group"><label for="page-slug">Slug</label><input type="text" id="page-slug" value="' + esc(fm.slug || (filename ? filename.replace('.md', '') : '')) + '" placeholder="auto-generated"><div class="form-hint">URL path for this page</div></div>';
    html += '<div class="form-group"><label for="page-order">Order</label><input type="number" id="page-order" value="' + esc(String(fm.order || 0)) + '" min="0"><div class="form-hint">Sort order (lower = first)</div></div>';
    html += '</div>';

    html += '<div class="form-group"><label for="page-desc">Description</label><textarea id="page-desc" rows="2" placeholder="Brief description">' + esc(fm.description || '') + '</textarea></div>';

    html += '<div class="form-group"><label for="page-parent">Parent Page</label><input type="text" id="page-parent" value="' + esc(fm.parent || '') + '" placeholder="none"><div class="form-hint">Slug of parent page for hierarchy</div></div>';

    html += '<div class="form-check"><input type="checkbox" id="page-nav"' + (fm.show_in_nav !== false ? ' checked' : '') + '><label for="page-nav">Show in navigation</label></div>';

    html += '</div></div>';

    // Editor
    html += '<div class="card mb-3"><div class="card-header"><h3>Content</h3></div>';
    html += '<div class="editor-container">';
    html += '<div class="editor-toolbar">';
    html += '<button type="button" data-md="bold" title="Bold"><strong>B</strong></button>';
    html += '<button type="button" data-md="italic" title="Italic"><em>I</em></button>';
    html += '<button type="button" data-md="heading" title="Heading">H</button>';
    html += '<span class="separator"></span>';
    html += '<button type="button" data-md="link" title="Link">&#128279;</button>';
    html += '<button type="button" data-md="image" title="Image">&#128247;</button>';
    html += '<button type="button" data-md="code" title="Code">&lt;/&gt;</button>';
    html += '<span class="separator"></span>';
    html += '<button type="button" data-md="ul" title="Bullet List">&#8226;</button>';
    html += '<button type="button" data-md="ol" title="Numbered List">1.</button>';
    html += '<button type="button" data-md="quote" title="Blockquote">&#8221;</button>';
    html += '<button type="button" class="preview-toggle" id="toggle-preview">Preview</button>';
    html += '</div>';
    html += '<div class="editor-body">';
    html += '<div class="editor-write"><textarea id="page-content" placeholder="Write page content in Markdown...">' + esc(body) + '</textarea></div>';
    html += '<div class="editor-preview" id="editor-preview"></div>';
    html += '</div></div>';
    html += '</div>';

    html += '<input type="hidden" id="page-sha" value="' + esc(sha) + '">';
    html += '<input type="hidden" id="page-filename" value="' + esc(filename) + '">';

    html += '<div class="flex items-center justify-between">';
    html += '<a href="#/pages" class="btn btn-secondary">Cancel</a>';
    html += '<button type="submit" class="btn btn-primary btn-lg" id="page-save">' + (existingPage ? 'Update Page' : 'Create Page') + '</button>';
    html += '</div>';

    html += '</form>';
    render(html);

    // Store original frontmatter for preserving unknown fields on save
    contentArea._originalPageFrontmatter = existingPage ? existingPage.frontmatter : null;

    // Auto-slug
    var titleInput = document.getElementById('page-title');
    var slugInput = document.getElementById('page-slug');
    if (!existingPage) {
      titleInput.addEventListener('input', function () {
        slugInput.value = slugify(titleInput.value);
      });
    }

    // Markdown toolbar
    _setupMarkdownToolbar('page-content');

    // Preview
    var previewBtn = document.getElementById('toggle-preview');
    var previewPane = document.getElementById('editor-preview');
    var editorTA = document.getElementById('page-content');
    previewBtn.addEventListener('click', function () {
      previewBtn.classList.toggle('active');
      previewPane.classList.toggle('visible');
      if (previewPane.classList.contains('visible')) {
        previewPane.innerHTML = sanitizePreviewHtml(markdownToHtml(editorTA.value));
      }
    });
    editorTA.addEventListener('input', debounce(function () {
      if (previewPane.classList.contains('visible')) {
        previewPane.innerHTML = sanitizePreviewHtml(markdownToHtml(editorTA.value));
      }
    }, 300));

    // Submit
    document.getElementById('page-form').addEventListener('submit', function (e) {
      e.preventDefault();
      _savePage(!!existingPage);
    });
  }

  function _savePage(isEdit) {
    var title = document.getElementById('page-title').value.trim();
    if (!title) {
      Toast.show('Title is required.', 'error');
      return;
    }

    var slug = document.getElementById('page-slug').value.trim() || slugify(title);
    var order = parseInt(document.getElementById('page-order').value, 10) || 0;
    var description = document.getElementById('page-desc').value.trim();
    var parent = document.getElementById('page-parent').value.trim();
    var showInNav = document.getElementById('page-nav').checked;
    var content = document.getElementById('page-content').value;
    var sha = document.getElementById('page-sha').value;
    var oldFilename = document.getElementById('page-filename').value;

    // Start with original frontmatter to preserve unknown fields (e.g. layout, etc.)
    var original = contentArea._originalPageFrontmatter || {};
    var data = {};
    var origKeys = Object.keys(original);
    for (var k = 0; k < origKeys.length; k++) {
      data[origKeys[k]] = original[origKeys[k]];
    }
    // Overlay known fields
    data.title = title;
    data.slug = slug;
    data.order = order;
    if (description) { data.description = description; } else { delete data.description; }
    if (parent) { data.parent = parent; } else { delete data.parent; }
    data.show_in_nav = showInNav;

    var btn = document.getElementById('page-save');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    var promise;
    if (isEdit && sha) {
      var newFilename = pageFilename(slug);
      if (newFilename !== oldFilename) {
        promise = Content.createPage(data, content).then(function () {
          return Content.deletePage(oldFilename, sha);
        });
      } else {
        promise = Content.updatePage(oldFilename, sha, data, content);
      }
    } else {
      promise = Content.createPage(data, content);
    }

    promise.then(function () {
      Toast.show(isEdit ? 'Page updated!' : 'Page created!', 'success');
      Router.navigate('/pages');
    }).catch(function (err) {
      Toast.show('Failed to save: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Update Page' : 'Create Page';
    });
  }

  // ---- 11f: Media Manager ----

  function renderMedia() {
    setTitle('Media');
    setActions('');
    showLoading();

    var html = '';

    // Upload zone
    html += '<div class="upload-zone" id="upload-zone">';
    html += '<svg width="40" height="40" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z"/><path d="M9 13h2v5a1 1 0 11-2 0v-5z"/></svg>';
    html += '<div class="upload-text">Drop images here or click to upload</div>';
    html += '<div class="upload-hint">Supports JPG, PNG, GIF, SVG, WebP</div>';
    html += '<input type="file" id="upload-input" multiple accept="image/*" style="display:none;">';
    html += '</div>';

    // Image grid (placeholder, will load)
    html += '<div id="media-grid" class="media-grid"><div class="loading-state"><div class="spinner"></div></div></div>';

    render(html);

    // Setup upload
    var zone = document.getElementById('upload-zone');
    var input = document.getElementById('upload-input');

    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', function () {
      zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('drag-over');
      _handleUpload(e.dataTransfer.files);
    });
    input.addEventListener('change', function () {
      _handleUpload(input.files);
      input.value = '';
    });

    // Load images
    _loadMediaGrid();
  }

  function _loadMediaGrid() {
    var grid = document.getElementById('media-grid');
    if (!grid) return;

    Content.listImages(null, true).then(function (images) {
      if (images.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No images found. Upload your first image above.</p></div>';
        return;
      }

      var html = '';
      images.forEach(function (img) {
        var relativePath = img.path;
        html += '<div class="media-item" data-path="' + esc(relativePath) + '">';
        html += '<div class="media-actions">';
        html += '<button data-copy-path="' + esc('/' + relativePath) + '" title="Copy path">&#128203;</button>';
        html += '<button data-delete-media="' + esc(relativePath) + '" data-sha="' + esc(img.sha) + '" title="Delete">&#128465;</button>';
        html += '</div>';
        html += '<img class="media-thumb" src="' + esc(img.download_url) + '" alt="' + esc(img.name) + '" loading="lazy">';
        html += '<div class="media-name">' + esc(img.name) + '</div>';
        html += '</div>';
      });

      grid.innerHTML = html;

      // Copy path handlers
      grid.querySelectorAll('[data-copy-path]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var path = btn.getAttribute('data-copy-path');
          navigator.clipboard.writeText(path).then(function () {
            Toast.show('Path copied: ' + path, 'success');
          });
        });
      });

      // Delete handlers
      grid.querySelectorAll('[data-delete-media]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var path = btn.getAttribute('data-delete-media');
          var sha = btn.getAttribute('data-sha');
          Modal.confirm('Delete this image? This cannot be undone.', {
            title: 'Delete Image',
            okText: 'Delete',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            GitHub.deleteFile(path, sha, 'Delete image: ' + path.split('/').pop()).then(function () {
              Toast.show('Image deleted.', 'success');
              Cache.clear();
              _loadMediaGrid();
            }).catch(function (err) {
              Toast.show('Delete failed: ' + err.message, 'error');
            });
          });
        });
      });
    }).catch(function (err) {
      grid.innerHTML = '<div class="empty-state"><p>' + esc(err.message) + '</p></div>';
    });
  }

  function _handleUpload(files) {
    if (!files || files.length === 0) return;
    var count = files.length;
    var done = 0;
    Toast.show('Uploading ' + count + ' file(s)...', 'info');

    for (var i = 0; i < files.length; i++) {
      (function (file) {
        Content.uploadImage(file).then(function () {
          done++;
          if (done === count) {
            Toast.show('All files uploaded!', 'success');
            _loadMediaGrid();
          }
        }).catch(function (err) {
          done++;
          Toast.show('Failed to upload ' + file.name + ': ' + err.message, 'error');
          if (done === count) _loadMediaGrid();
        });
      })(files[i]);
    }
  }

  // ---- 11g: Settings Editor ----

  function renderSettings() {
    setTitle('Settings');
    setActions('');
    showLoading();

    Content.getSiteConfig().then(function (result) {
      _buildSettingsForm(result.data, result.sha);
    }).catch(function (err) {
      showError('Could not load site.config.json: ' + err.message);
    });
  }

  function _buildSettingsForm(config, sha) {
    var site = config.site || {};
    var nav = config.navigation || {};
    var content = config.content || {};
    var seo = config.seo || {};
    var author = site.author || {};
    var mainNav = nav.main || [];
    var footerNav = nav.footer || [];
    var socialLinks = nav.social || [];

    var html = '<form id="settings-form">';

    // Site
    html += '<div class="settings-section"><h3>Site</h3><p class="section-desc">Basic site information.</p>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="form-group"><label for="s-title">Site Title</label><input type="text" id="s-title" value="' + esc(site.title || '') + '"></div>';
    html += '<div class="form-group"><label for="s-desc">Description</label><textarea id="s-desc" rows="2">' + esc(site.description || '') + '</textarea></div>';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label for="s-url">Site URL</label><input type="url" id="s-url" value="' + esc(site.url || '') + '"></div>';
    html += '<div class="form-group"><label for="s-lang">Language</label><input type="text" id="s-lang" value="' + esc(site.language || 'en') + '"></div>';
    html += '</div>';
    html += '</div></div></div>';

    // Author
    html += '<div class="settings-section"><h3>Author</h3><p class="section-desc">Default author information.</p>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label for="s-author-name">Name</label><input type="text" id="s-author-name" value="' + esc(author.name || '') + '"></div>';
    html += '<div class="form-group"><label for="s-author-email">Email</label><input type="email" id="s-author-email" value="' + esc(author.email || '') + '"></div>';
    html += '</div>';
    html += '<div class="form-group"><label for="s-author-url">URL</label><input type="url" id="s-author-url" value="' + esc(author.url || '') + '"></div>';
    html += '</div></div></div>';

    // Content
    html += '<div class="settings-section"><h3>Content</h3><p class="section-desc">How content is displayed.</p>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label for="s-ppp">Posts Per Page</label><input type="number" id="s-ppp" value="' + (content.postsPerPage || 10) + '" min="1" max="100"></div>';
    html += '<div class="form-group"><label for="s-excerpt">Excerpt Length</label><input type="number" id="s-excerpt" value="' + (content.excerptLength || 200) + '" min="50" max="1000"></div>';
    html += '</div>';
    html += '<div class="form-group"><label for="s-datefmt">Date Format</label><input type="text" id="s-datefmt" value="' + esc(content.dateFormat || 'MMMM D, YYYY') + '"><div class="form-hint">e.g. MMMM D, YYYY</div></div>';
    html += '<div class="form-row">';
    html += '<div class="form-check"><input type="checkbox" id="s-show-author"' + (content.showAuthor !== false ? ' checked' : '') + '><label for="s-show-author">Show Author</label></div>';
    html += '<div class="form-check"><input type="checkbox" id="s-show-date"' + (content.showDate !== false ? ' checked' : '') + '><label for="s-show-date">Show Date</label></div>';
    html += '<div class="form-check"><input type="checkbox" id="s-show-tags"' + (content.showTags !== false ? ' checked' : '') + '><label for="s-show-tags">Show Tags</label></div>';
    html += '<div class="form-check"><input type="checkbox" id="s-show-share"' + (content.showShareButtons ? ' checked' : '') + '><label for="s-show-share">Share Buttons</label></div>';
    html += '<div class="form-check"><input type="checkbox" id="s-show-readtime"' + (content.showReadTime !== false ? ' checked' : '') + '><label for="s-show-readtime">Read Time</label></div>';
    html += '</div>';
    html += '</div></div></div>';

    // SEO
    html += '<div class="settings-section"><h3>SEO</h3><p class="section-desc">Search engine optimization settings.</p>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="form-group"><label for="s-title-tpl">Title Template</label><input type="text" id="s-title-tpl" value="' + esc(seo.titleTemplate || '') + '"><div class="form-hint">Use %s as placeholder for page title</div></div>';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label for="s-og-img">Default OG Image</label><input type="text" id="s-og-img" value="' + esc(seo.ogImage || '') + '"></div>';
    html += '<div class="form-group"><label for="s-twitter-card">Twitter Card</label><select id="s-twitter-card"><option value="summary"' + (seo.twitterCard === 'summary' ? ' selected' : '') + '>Summary</option><option value="summary_large_image"' + (seo.twitterCard === 'summary_large_image' ? ' selected' : '') + '>Summary Large Image</option></select></div>';
    html += '</div>';
    html += '<div class="form-group"><label for="s-twitter-handle">Twitter Handle</label><input type="text" id="s-twitter-handle" value="' + esc(seo.twitterHandle || '') + '" placeholder="@username"></div>';
    html += '</div></div></div>';

    // Navigation — Main
    html += '<div class="settings-section"><h3>Main Navigation</h3><p class="section-desc">Links shown in the site header.</p>';
    html += '<div class="card"><div class="card-body">';
    html += '<div id="main-nav-editor" class="nav-editor-list">';
    mainNav.forEach(function (item, idx) {
      html += _navEditorItem('main', idx, item.label || '', item.url || '');
    });
    html += '</div>';
    html += '<button type="button" class="btn btn-sm btn-secondary" id="add-main-nav">+ Add Link</button>';
    html += '</div></div></div>';

    // Navigation — Footer
    html += '<div class="settings-section"><h3>Footer Navigation</h3><p class="section-desc">Links shown in the site footer.</p>';
    html += '<div class="card"><div class="card-body">';
    html += '<div id="footer-nav-editor" class="nav-editor-list">';
    footerNav.forEach(function (item, idx) {
      html += _navEditorItem('footer', idx, item.label || '', item.url || '');
    });
    html += '</div>';
    html += '<button type="button" class="btn btn-sm btn-secondary" id="add-footer-nav">+ Add Link</button>';
    html += '</div></div></div>';

    // Social Links
    html += '<div class="settings-section"><h3>Social Links</h3><p class="section-desc">Social media profiles.</p>';
    html += '<div class="card"><div class="card-body">';
    html += '<div id="social-editor" class="nav-editor-list">';
    socialLinks.forEach(function (item, idx) {
      html += _socialEditorItem(idx, item.platform || '', item.url || '');
    });
    html += '</div>';
    html += '<button type="button" class="btn btn-sm btn-secondary" id="add-social">+ Add Social Link</button>';
    html += '</div></div></div>';

    // Hidden SHA
    html += '<input type="hidden" id="settings-sha" value="' + esc(sha) + '">';

    // Save
    html += '<div class="flex justify-between items-center" style="margin-top:1.5rem;">';
    html += '<div></div>';
    html += '<button type="submit" class="btn btn-primary btn-lg" id="settings-save">Save Settings</button>';
    html += '</div>';

    html += '</form>';
    render(html);

    // Nav editor add/remove
    _setupNavEditors();

    // Store original config for preserving unknown keys
    contentArea._originalConfig = config;

    // Submit
    document.getElementById('settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      _saveSettings();
    });
  }

  function _navEditorItem(prefix, idx, label, url) {
    return '<div class="nav-editor-item" data-nav="' + prefix + '">' +
      '<input type="text" placeholder="Label" value="' + esc(label) + '" class="nav-label">' +
      '<input type="text" placeholder="/url/" value="' + esc(url) + '" class="nav-url">' +
      '<button type="button" class="btn-icon nav-remove" title="Remove">&times;</button>' +
      '</div>';
  }

  function _socialEditorItem(idx, platform, url) {
    return '<div class="nav-editor-item" data-social>' +
      '<input type="text" placeholder="platform" value="' + esc(platform) + '" class="social-platform" style="max-width:120px;">' +
      '<input type="text" placeholder="https://..." value="' + esc(url) + '" class="social-url">' +
      '<button type="button" class="btn-icon nav-remove" title="Remove">&times;</button>' +
      '</div>';
  }

  function _setupNavEditors() {
    // Remove buttons
    contentArea.addEventListener('click', function (e) {
      if (e.target.classList.contains('nav-remove')) {
        var item = e.target.closest('.nav-editor-item');
        if (item) item.remove();
      }
    });

    // Add main nav
    var addMain = document.getElementById('add-main-nav');
    if (addMain) {
      addMain.addEventListener('click', function () {
        var list = document.getElementById('main-nav-editor');
        list.insertAdjacentHTML('beforeend', _navEditorItem('main', list.children.length, '', ''));
      });
    }

    // Add footer nav
    var addFooter = document.getElementById('add-footer-nav');
    if (addFooter) {
      addFooter.addEventListener('click', function () {
        var list = document.getElementById('footer-nav-editor');
        list.insertAdjacentHTML('beforeend', _navEditorItem('footer', list.children.length, '', ''));
      });
    }

    // Add social
    var addSocial = document.getElementById('add-social');
    if (addSocial) {
      addSocial.addEventListener('click', function () {
        var list = document.getElementById('social-editor');
        list.insertAdjacentHTML('beforeend', _socialEditorItem(list.children.length, '', ''));
      });
    }
  }

  function _saveSettings() {
    // Rebuild config preserving unknown fields
    var original = contentArea._originalConfig || {};
    var config = JSON.parse(JSON.stringify(original));

    // Site
    if (!config.site) config.site = {};
    config.site.title = document.getElementById('s-title').value.trim();
    config.site.description = document.getElementById('s-desc').value.trim();
    config.site.url = document.getElementById('s-url').value.trim();
    config.site.language = document.getElementById('s-lang').value.trim();

    // Author
    if (!config.site.author) config.site.author = {};
    config.site.author.name = document.getElementById('s-author-name').value.trim();
    config.site.author.email = document.getElementById('s-author-email').value.trim();
    config.site.author.url = document.getElementById('s-author-url').value.trim();

    // Content
    if (!config.content) config.content = {};
    config.content.postsPerPage = parseInt(document.getElementById('s-ppp').value, 10) || 10;
    config.content.excerptLength = parseInt(document.getElementById('s-excerpt').value, 10) || 200;
    config.content.dateFormat = document.getElementById('s-datefmt').value.trim();
    config.content.showAuthor = document.getElementById('s-show-author').checked;
    config.content.showDate = document.getElementById('s-show-date').checked;
    config.content.showTags = document.getElementById('s-show-tags').checked;
    config.content.showShareButtons = document.getElementById('s-show-share').checked;
    config.content.showReadTime = document.getElementById('s-show-readtime').checked;

    // SEO
    if (!config.seo) config.seo = {};
    config.seo.titleTemplate = document.getElementById('s-title-tpl').value.trim();
    config.seo.ogImage = document.getElementById('s-og-img').value.trim();
    config.seo.twitterCard = document.getElementById('s-twitter-card').value;
    config.seo.twitterHandle = document.getElementById('s-twitter-handle').value.trim();

    // Navigation — Main
    if (!config.navigation) config.navigation = {};
    config.navigation.main = [];
    document.querySelectorAll('#main-nav-editor .nav-editor-item').forEach(function (item) {
      var label = item.querySelector('.nav-label').value.trim();
      var url = item.querySelector('.nav-url').value.trim();
      if (label && url) config.navigation.main.push({ label: label, url: url });
    });

    // Navigation — Footer
    config.navigation.footer = [];
    document.querySelectorAll('#footer-nav-editor .nav-editor-item').forEach(function (item) {
      var label = item.querySelector('.nav-label').value.trim();
      var url = item.querySelector('.nav-url').value.trim();
      if (label && url) config.navigation.footer.push({ label: label, url: url });
    });

    // Social
    config.navigation.social = [];
    document.querySelectorAll('#social-editor .nav-editor-item').forEach(function (item) {
      var platform = item.querySelector('.social-platform').value.trim();
      var url = item.querySelector('.social-url').value.trim();
      if (platform) config.navigation.social.push({ platform: platform, url: url });
    });

    var sha = document.getElementById('settings-sha').value;
    var btn = document.getElementById('settings-save');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    Content.saveSiteConfig(config, sha).then(function () {
      Toast.show('Settings saved!', 'success');
      renderSettings();
    }).catch(function (err) {
      Toast.show('Save failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Save Settings';
    });
  }

  // ---- 11h: Theme Customizer ----

  function renderTheme() {
    setTitle('Theme');
    setActions('');
    showLoading();

    Content.getThemeConfig().then(function (result) {
      _buildThemeForm(result.data, result.sha);
    }).catch(function (err) {
      showError('Could not load theme.config.json: ' + err.message);
    });
  }

  function _buildThemeForm(config, sha) {
    var settings = config.settings || {};
    var colors = settings.colors || {};
    var fonts = settings.fonts || {};
    var features = config.features || {};

    var html = '<form id="theme-form">';

    // Theme Info
    html += '<div class="settings-section"><h3>Theme Information</h3>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label>Name</label><input type="text" id="t-name" value="' + esc(config.name || '') + '"></div>';
    html += '<div class="form-group"><label>Author</label><input type="text" id="t-author" value="' + esc(config.author || '') + '"></div>';
    html += '</div>';
    html += '<div class="form-group"><label>Description</label><input type="text" id="t-desc" value="' + esc(config.description || '') + '"></div>';
    html += '</div></div></div>';

    // Colors
    html += '<div class="settings-section"><h3>Colors</h3><p class="section-desc">Customize the theme color palette.</p>';
    html += '<div class="card"><div class="card-body">';

    var colorFields = [
      { key: 'primary', label: 'Primary' },
      { key: 'secondary', label: 'Secondary' },
      { key: 'accent', label: 'Accent' },
      { key: 'background', label: 'Background' },
      { key: 'surface', label: 'Surface' },
      { key: 'text', label: 'Text' },
      { key: 'textMuted', label: 'Text Muted' }
    ];

    // Live preview
    html += '<div class="color-preview" id="color-preview">';
    colorFields.forEach(function (cf) {
      html += '<div class="color-swatch" data-swatch="' + cf.key + '" style="background:' + esc(colors[cf.key] || '#ccc') + ';" title="' + esc(cf.label) + '"></div>';
    });
    html += '</div>';

    colorFields.forEach(function (cf) {
      var val = colors[cf.key] || '#000000';
      html += '<div class="color-row">';
      html += '<label>' + esc(cf.label) + '</label>';
      html += '<input type="color" data-color-key="' + cf.key + '" value="' + esc(val) + '">';
      html += '<input type="text" class="color-hex" data-color-hex="' + cf.key + '" value="' + esc(val) + '">';
      html += '</div>';
    });

    html += '</div></div></div>';

    // Fonts
    html += '<div class="settings-section"><h3>Fonts</h3><p class="section-desc">Typography settings.</p>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="form-group"><label for="t-font-heading">Heading Font</label><select id="t-font-heading">';
    var fontOptions = ['Inter, system-ui, sans-serif', 'Georgia, serif', 'Merriweather, serif', 'Lora, serif', 'Playfair Display, serif', 'Roboto, sans-serif', 'Open Sans, sans-serif', 'Montserrat, sans-serif', 'system-ui, sans-serif'];
    fontOptions.forEach(function (f) {
      html += '<option value="' + esc(f) + '"' + (fonts.heading === f ? ' selected' : '') + '>' + esc(f.split(',')[0]) + '</option>';
    });
    html += '</select></div>';
    html += '<div class="form-group"><label for="t-font-body">Body Font</label><select id="t-font-body">';
    fontOptions.forEach(function (f) {
      html += '<option value="' + esc(f) + '"' + (fonts.body === f ? ' selected' : '') + '>' + esc(f.split(',')[0]) + '</option>';
    });
    html += '</select></div>';
    html += '<div class="form-group"><label for="t-font-mono">Mono Font</label><input type="text" id="t-font-mono" value="' + esc(fonts.mono || 'ui-monospace, monospace') + '"></div>';
    html += '</div></div></div>';

    // Features
    html += '<div class="settings-section"><h3>Features</h3><p class="section-desc">Enable or disable theme features.</p>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="feature-grid">';

    var featureList = [
      { key: 'darkMode', label: 'Dark Mode' },
      { key: 'search', label: 'Search' },
      { key: 'rss', label: 'RSS Feed' },
      { key: 'sitemap', label: 'Sitemap' },
      { key: 'viewTransitions', label: 'View Transitions' }
    ];

    featureList.forEach(function (feat) {
      var checked = features[feat.key] !== false;
      html += '<div class="feature-toggle">';
      html += '<label>' + esc(feat.label) + '</label>';
      html += '<label class="toggle"><input type="checkbox" data-feature="' + feat.key + '"' + (checked ? ' checked' : '') + '><span class="toggle-slider"></span></label>';
      html += '</div>';
    });

    html += '</div>';
    html += '</div></div></div>';

    // Layout
    html += '<div class="settings-section"><h3>Layout</h3><p class="section-desc">Spacing and sizing.</p>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="form-row">';
    html += '<div class="form-group"><label for="t-radius">Border Radius</label><input type="text" id="t-radius" value="' + esc(settings.borderRadius || '0.375rem') + '"></div>';
    html += '<div class="form-group"><label for="t-maxwidth">Max Width</label><input type="text" id="t-maxwidth" value="' + esc(settings.maxWidth || '72rem') + '"></div>';
    html += '</div>';
    html += '</div></div></div>';

    html += '<input type="hidden" id="theme-sha" value="' + esc(sha) + '">';

    html += '<div class="flex justify-between items-center" style="margin-top:1.5rem;">';
    html += '<div></div>';
    html += '<button type="submit" class="btn btn-primary btn-lg" id="theme-save">Save Theme</button>';
    html += '</div>';

    html += '</form>';
    render(html);

    // Store original config
    contentArea._originalThemeConfig = config;

    // Live color preview
    contentArea.querySelectorAll('[data-color-key]').forEach(function (picker) {
      var key = picker.getAttribute('data-color-key');
      var hex = contentArea.querySelector('[data-color-hex="' + key + '"]');
      var swatch = contentArea.querySelector('[data-swatch="' + key + '"]');

      picker.addEventListener('input', function () {
        hex.value = picker.value;
        if (swatch) swatch.style.background = picker.value;
      });
      hex.addEventListener('input', function () {
        if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) {
          picker.value = hex.value;
          if (swatch) swatch.style.background = hex.value;
        }
      });
    });

    // Submit
    document.getElementById('theme-form').addEventListener('submit', function (e) {
      e.preventDefault();
      _saveTheme();
    });
  }

  function _saveTheme() {
    var original = contentArea._originalThemeConfig || {};
    var config = JSON.parse(JSON.stringify(original));

    config.name = document.getElementById('t-name').value.trim();
    config.author = document.getElementById('t-author').value.trim();
    config.description = document.getElementById('t-desc').value.trim();

    // Colors
    if (!config.settings) config.settings = {};
    if (!config.settings.colors) config.settings.colors = {};
    contentArea.querySelectorAll('[data-color-key]').forEach(function (picker) {
      config.settings.colors[picker.getAttribute('data-color-key')] = picker.value;
    });

    // Fonts
    if (!config.settings.fonts) config.settings.fonts = {};
    config.settings.fonts.heading = document.getElementById('t-font-heading').value;
    config.settings.fonts.body = document.getElementById('t-font-body').value;
    config.settings.fonts.mono = document.getElementById('t-font-mono').value.trim();

    // Layout
    config.settings.borderRadius = document.getElementById('t-radius').value.trim();
    config.settings.maxWidth = document.getElementById('t-maxwidth').value.trim();

    // Features
    if (!config.features) config.features = {};
    contentArea.querySelectorAll('[data-feature]').forEach(function (cb) {
      config.features[cb.getAttribute('data-feature')] = cb.checked;
    });

    var sha = document.getElementById('theme-sha').value;
    var btn = document.getElementById('theme-save');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    Content.saveThemeConfig(config, sha).then(function () {
      Toast.show('Theme saved!', 'success');
      renderTheme();
    }).catch(function (err) {
      Toast.show('Save failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Save Theme';
    });
  }

  // ==========================================================================
  // SECTION 13: Markdown Toolbar Helper
  // ==========================================================================

  function _setupMarkdownToolbar(textareaId) {
    var toolbar = contentArea.querySelector('.editor-toolbar');
    if (!toolbar) return;

    toolbar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-md]');
      if (!btn) return;
      e.preventDefault();

      var action = btn.getAttribute('data-md');
      var ta = document.getElementById(textareaId);
      if (!ta) return;

      var start = ta.selectionStart;
      var end = ta.selectionEnd;
      var text = ta.value;
      var sel = text.substring(start, end);
      var before = text.substring(0, start);
      var after = text.substring(end);
      var insert = '';
      var cursorOffset = 0;

      switch (action) {
        case 'bold':
          insert = '**' + (sel || 'bold text') + '**';
          cursorOffset = sel ? insert.length : 2;
          break;
        case 'italic':
          insert = '*' + (sel || 'italic text') + '*';
          cursorOffset = sel ? insert.length : 1;
          break;
        case 'heading':
          // Toggle through heading levels
          if (before.endsWith('### ')) {
            // Already h3, remove
            ta.value = before.slice(0, -4) + sel + after;
            ta.selectionStart = ta.selectionEnd = start - 4 + sel.length;
            ta.dispatchEvent(new Event('input'));
            return;
          }
          insert = '## ' + (sel || 'Heading');
          cursorOffset = sel ? insert.length : 3;
          break;
        case 'link':
          insert = '[' + (sel || 'link text') + '](url)';
          cursorOffset = sel ? insert.length - 1 : 1;
          break;
        case 'image':
          insert = '![' + (sel || 'alt text') + '](image-url)';
          cursorOffset = sel ? insert.length - 1 : 2;
          break;
        case 'code':
          if (sel.indexOf('\n') !== -1) {
            insert = '```\n' + (sel || 'code') + '\n```';
          } else {
            insert = '`' + (sel || 'code') + '`';
          }
          cursorOffset = sel ? insert.length : 1;
          break;
        case 'ul':
          insert = '- ' + (sel || 'list item');
          cursorOffset = insert.length;
          break;
        case 'ol':
          insert = '1. ' + (sel || 'list item');
          cursorOffset = insert.length;
          break;
        case 'quote':
          insert = '> ' + (sel || 'quote');
          cursorOffset = insert.length;
          break;
        case 'hr':
          insert = '\n---\n';
          cursorOffset = insert.length;
          break;
        default:
          return;
      }

      ta.value = before + insert + after;
      ta.selectionStart = ta.selectionEnd = start + cursorOffset;
      ta.focus();
      ta.dispatchEvent(new Event('input'));
    });
  }

  // ==========================================================================
  // SECTION 14: App Initialization
  // ==========================================================================

  function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-shell').style.display = 'none';

    var unlockForm = document.getElementById('unlock-form');
    var setupForm = document.getElementById('setup-form');
    var subtitle = document.getElementById('login-subtitle');

    if (Auth.hasVault()) {
      // Returning user — show password unlock
      var info = Auth.getVaultInfo();
      document.getElementById('vault-repo-display').textContent = info.repo;
      unlockForm.style.display = 'block';
      setupForm.style.display = 'none';
      subtitle.textContent = 'Welcome back';
      // Focus password field
      setTimeout(function () { document.getElementById('unlock-password').focus(); }, 100);
    } else {
      // First time — show setup form
      unlockForm.style.display = 'none';
      setupForm.style.display = 'block';
      subtitle.textContent = 'Connect your site';
    }
  }

  function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-shell').style.display = 'flex';

    // Update user info in sidebar
    if (Auth.user) {
      document.getElementById('user-avatar').src = Auth.user.avatar_url || '';
      document.getElementById('user-name').textContent = Auth.user.login || '';
      document.getElementById('user-repo').textContent = GitHub.repo || '';
    }
  }

  function init() {
    // Init subsystems
    Toast.init();
    Modal.init();

    contentArea = document.getElementById('content-area');
    topbarTitle = document.getElementById('topbar-title');
    topbarActions = document.getElementById('topbar-actions');

    // Register routes
    Router.on('/dashboard', renderDashboard);
    Router.on('/posts', renderPosts);
    Router.on('/posts/new', function () { renderPostEditor({}); });
    Router.on('/posts/edit/:id', renderPostEditor);
    Router.on('/pages', renderPages);
    Router.on('/pages/new', function () { renderPageEditor({}); });
    Router.on('/pages/edit/:id', renderPageEditor);
    Router.on('/media', renderMedia);
    Router.on('/settings', renderSettings);
    Router.on('/theme', renderTheme);

    // Sidebar toggle (mobile)
    var hamburger = document.getElementById('hamburger');
    var sidebar = document.getElementById('sidebar');
    var sidebarClose = document.getElementById('sidebar-close');
    hamburger.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
    sidebarClose.addEventListener('click', function () {
      sidebar.classList.remove('open');
    });

    // Dark mode toggle
    var darkToggle = document.getElementById('toggle-dark');
    darkToggle.addEventListener('click', function () {
      var html = document.documentElement;
      var current = html.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('jinpa_admin_theme', next);
    });
    // Restore dark mode preference
    var savedTheme = localStorage.getItem('jinpa_admin_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Logout — keeps vault, clears session
    document.getElementById('logout-btn').addEventListener('click', function () {
      Auth.logout();
      showLogin();
      Toast.show('Signed out. Your encrypted credentials are saved for next time.', 'info');
    });

    // ---- SETUP FORM (first-time) ----
    document.getElementById('setup-submit').addEventListener('click', function () {
      var token = document.getElementById('setup-token').value.trim();
      var repo = document.getElementById('setup-repo').value.trim();
      var branch = document.getElementById('setup-branch').value.trim() || 'main';
      var pw1 = document.getElementById('setup-password').value;
      var pw2 = document.getElementById('setup-password2').value;

      if (!token) { Toast.show('Please enter a GitHub token.', 'error'); return; }
      if (!repo) { Toast.show('Please enter a repository (owner/repo).', 'error'); return; }
      if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
        Toast.show('Repository format: owner/repo (e.g., "myname/my-site").', 'error');
        return;
      }
      if (!pw1) { Toast.show('Please choose a password.', 'error'); return; }
      if (pw1.length < 4) { Toast.show('Password must be at least 4 characters.', 'error'); return; }
      if (pw1 !== pw2) { Toast.show('Passwords do not match.', 'error'); return; }

      var btn = document.getElementById('setup-submit');
      btn.disabled = true;
      btn.textContent = 'Setting up...';

      Auth.setup(token, repo, branch, pw1).then(function (user) {
        Toast.show('Welcome, ' + user.login + '! Your site is connected.', 'success');
        // Clear sensitive fields
        document.getElementById('setup-token').value = '';
        document.getElementById('setup-password').value = '';
        document.getElementById('setup-password2').value = '';
        showApp();
        Router.start();
      }).catch(function (err) {
        Toast.show(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Set Up & Sign In';
      });
    });

    // Allow Enter in setup fields
    ['setup-token', 'setup-repo', 'setup-branch', 'setup-password', 'setup-password2'].forEach(function (id) {
      document.getElementById(id).addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('setup-submit').click();
        }
      });
    });

    // ---- UNLOCK FORM (returning user) ----
    document.getElementById('unlock-submit').addEventListener('click', function () {
      var pw = document.getElementById('unlock-password').value;
      if (!pw) { Toast.show('Please enter your password.', 'error'); return; }

      var btn = document.getElementById('unlock-submit');
      btn.disabled = true;
      btn.textContent = 'Unlocking...';

      Auth.unlock(pw).then(function (user) {
        document.getElementById('unlock-password').value = '';
        Toast.show('Welcome back, ' + user.login + '!', 'success');
        showApp();
        Router.start();
      }).catch(function (err) {
        Toast.show(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Unlock';
        document.getElementById('unlock-password').value = '';
        document.getElementById('unlock-password').focus();
      });
    });

    // Allow Enter in unlock field
    document.getElementById('unlock-password').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('unlock-submit').click();
      }
    });

    // Switch to setup (from unlock screen)
    document.getElementById('switch-to-setup').addEventListener('click', function () {
      Modal.confirm('This will remove your saved credentials. You will need to enter your GitHub token again.', {
        title: 'Reset Credentials',
        okText: 'Reset',
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        Auth.reset();
        showLogin();
      });
    });

    // Check for vault import from setup wizard (passed via URL hash)
    // Format: #/import-vault/BASE64_ENCODED_VAULT_JSON
    // The hash is never sent to the server — it stays client-side only
    var hash = window.location.hash || '';
    if (hash.indexOf('#/import-vault/') === 0) {
      var vaultData = hash.slice('#/import-vault/'.length);
      try {
        var decoded = JSON.parse(atob(decodeURIComponent(vaultData)));
        if (decoded.encrypted && decoded.repo) {
          // Import the vault into localStorage
          localStorage.setItem(Auth.STORAGE_KEY, JSON.stringify({
            encrypted: decoded.encrypted,
            repo: decoded.repo,
            branch: decoded.branch || 'main'
          }));
          // Clean the URL hash immediately (security: remove vault data from browser history)
          window.location.hash = '#/dashboard';
          Toast.show('Admin credentials imported! Enter your password to start.', 'success');
        }
      } catch (e) {
        // Invalid vault data — ignore and show normal login
        window.location.hash = '';
      }
    }

    // Show the appropriate login screen
    showLogin();
  }

  // Boot when DOM is ready
  var _jnpBuild = 'b4e7f19a-c3d2-4801-9f56-jnpa';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
