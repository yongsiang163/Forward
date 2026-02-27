const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf-8');

// 1. Add Firebase SDK Scripts to the <head> before our own CSS
html = html.replace(
  '<link rel="stylesheet" href="css/main.css">',
  `<!-- Firebase SDKs -->
  <script src="https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.0.0/firebase-auth-compat.js"></script>
  <!-- Firebase Config -->
  <script src="js/firebase-config.js"></script>
  <link rel="stylesheet" href="css/main.css">`
);

// 2. Add Account Settings UI
const settingsDataBlock = `      <div class="settings-section">
        <p class="settings-section-label">Data</p>`;

const settingsAuthBlock = `      <div class="settings-section">
        <p class="settings-section-label">Account & Sync</p>
        <div class="settings-row" id="sync-account-btn" onclick="toggleAuthModal()">
          <div class="settings-row-body">
            <p class="settings-row-text" id="sync-account-title">Link Account</p>
            <p class="settings-row-sub" id="sync-account-sub">Sync across devices</p>
          </div>
          <span class="settings-row-action" id="sync-account-status">→</span>
        </div>
      </div>

      <div class="settings-section">
        <p class="settings-section-label">Data</p>`;

html = html.replace(settingsDataBlock, settingsAuthBlock);

// 3. Add Auth Modal HTML to the bottom of the body (before <script src="js/data.js">)
const authModalHtml = `
  <!-- AUTH MODAL -->
  <div class="capture-sheet" id="auth-modal">
    <div class="capture-backdrop" onclick="document.getElementById('auth-modal').classList.remove('active')"></div>
    <div class="capture-modal">
      <div class="capture-handle"></div>
      <div style="padding: 24px; text-align: center;">
        <h3 style="margin: 0 0 8px 0; color: var(--text); font-family: var(--header-font); font-size: 24px;">Link Account</h3>
        <p style="margin: 0 0 24px 0; color: var(--sub-text); font-size: 15px;">Create an account to sync your Forward data to other devices.</p>
        
        <input type="email" id="auth-email" class="project-input" placeholder="Email address" style="margin-bottom: 12px;"/>
        <input type="password" id="auth-password" class="project-input" placeholder="Password" style="margin-bottom: 16px;"/>
        
        <button id="auth-submit-btn" class="item-action-main-btn" onclick="linkEmailAccount()">Link Account</button>
        <button id="auth-signout-btn" class="item-action-main-btn promote" onclick="signOutAccount()" style="display:none; margin-top:12px;">Sign Out</button>
        <p id="auth-error-msg" style="color: #ff6b6b; margin-top: 16px; font-size: 14px; display: none;"></p>
      </div>
    </div>
  </div>
  
  <script src="js/data.js">`;

html = html.replace('<script src="js/data.js">', authModalHtml);

fs.writeFileSync('index.html', html);
console.log('Successfully injected Firebase UI into index.html');
