// ============================================================
//  Infamous AI v1.1 — script.js
//  Real AI via Google Gemini API (FREE — no credit card needed)
//  Get your free key → https://aistudio.google.com/app/apikey
// ============================================================

// ⚡ REPLACE THIS with your free Gemini key from aistudio.google.com
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── ADMIN ──────────────────────────────────────────────────
const ADMIN_EMAIL = "aryan11222567@gmail.com";

// ── PLANS ──────────────────────────────────────────────────
const PLANS = {
  free:     { name: "Free",     msgs: 10,  price: "₹0",   priceUSD: "Free",   icon: "🪨" },
  dirt:     { name: "Dirt",     msgs: 25,  price: "₹69",  priceUSD: "$0.83",  icon: "🟫" },
  stone:    { name: "Stone",    msgs: 50,  price: "₹149", priceUSD: "$1.79",  icon: "⬜" },
  obsidian: { name: "Obsidian", msgs: 80,  price: "₹229", priceUSD: "$2.75",  icon: "🟣" },
  bedrock:  { name: "Bedrock",  msgs: 150, price: "₹299", priceUSD: "$3.60",  icon: "🔷" },
};

// ── STORAGE HELPERS ────────────────────────────────────────
function getUsers()  { return JSON.parse(localStorage.getItem("iai_users")  || "{}"); }
function saveUsers(u){ localStorage.setItem("iai_users", JSON.stringify(u)); }
function getChats()  { return JSON.parse(localStorage.getItem("iai_chats")  || "{}"); }
function saveChats(c){ localStorage.setItem("iai_chats", JSON.stringify(c)); }
function getLogs()   { return JSON.parse(localStorage.getItem("iai_logs")   || "[]"); }
function saveLogs(l) { localStorage.setItem("iai_logs",  JSON.stringify(l)); }
function getCurrentUser(){ return JSON.parse(localStorage.getItem("iai_current") || "null"); }
function setCurrentUser(u){ localStorage.setItem("iai_current", JSON.stringify(u)); }

function addLog(tag, msg) {
  const logs = getLogs();
  logs.unshift({ tag, msg, time: new Date().toLocaleTimeString() });
  if (logs.length > 200) logs.pop();
  saveLogs(logs);
}

// ── DAILY LIMIT HELPERS ────────────────────────────────────
const today = () => new Date().toDateString();

function getMsgsUsed(email) {
  const users = getUsers();
  const u = users[email];
  if (!u) return 0;
  if (u.limitDate !== today()) { u.msgsUsed = 0; u.limitDate = today(); saveUsers(users); }
  return u.msgsUsed || 0;
}
function getMsgsLimit(email) {
  const users = getUsers();
  return PLANS[users[email]?.plan || "free"].msgs;
}
function incrementMsgs(email) {
  const users = getUsers();
  if (!users[email]) return;
  if (users[email].limitDate !== today()) { users[email].msgsUsed = 0; users[email].limitDate = today(); }
  users[email].msgsUsed = (users[email].msgsUsed || 0) + 1;
  saveUsers(users);
}

// ── SCREEN MANAGER ─────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════
const authTabs     = document.querySelectorAll(".tab-btn");
const authForms    = document.querySelectorAll(".auth-form");
const authError    = document.getElementById("auth-error");
const loginBtn     = document.getElementById("login-btn");
const signupBtn    = document.getElementById("signup-btn");

authTabs.forEach(btn => {
  btn.addEventListener("click", () => {
    authTabs.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    authForms.forEach(f => f.style.display = "none");
    document.getElementById(btn.dataset.tab + "-form").style.display = "block";
    authError.textContent = "";
  });
});

signupBtn.addEventListener("click", () => {
  const name  = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim().toLowerCase();
  const pass  = document.getElementById("signup-pass").value;
  if (!name || !email || !pass) { authError.textContent = "All fields required."; return; }
  if (!/\S+@\S+\.\S+/.test(email)) { authError.textContent = "Invalid email."; return; }
  const users = getUsers();
  if (users[email]) { authError.textContent = "Email already registered."; return; }
  users[email] = { name, email, pass, plan: "free", msgsUsed: 0, limitDate: today() };
  saveUsers(users);
  addLog("info", `Signup: ${name} (${email}) — Plan: Free`);
  setCurrentUser({ name, email });
  afterLogin({ name, email });
});

loginBtn.addEventListener("click", () => {
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const pass  = document.getElementById("login-pass").value;
  if (!email || !pass) { authError.textContent = "Fill in all fields."; return; }
  const users = getUsers();
  if (!users[email]) { authError.textContent = "No account found."; return; }
  if (users[email].pass !== pass) { authError.textContent = "Wrong password."; return; }
  setCurrentUser({ name: users[email].name, email });
  addLog("info", `Login: ${users[email].name} (${email}) — Plan: ${users[email].plan || "free"}`);
  afterLogin({ name: users[email].name, email });
});

function afterLogin(user) {
  if (user.email === ADMIN_EMAIL) { initAdmin(); showScreen("admin-screen"); }
  else { initChat(user); showScreen("chat-screen"); }
}

// Enter key support
document.getElementById("login-pass").addEventListener("keydown", e => { if(e.key==="Enter") loginBtn.click(); });
document.getElementById("signup-name").addEventListener("keydown", e => { if(e.key==="Enter") signupBtn.click(); });

// ══════════════════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════════════════
let currentUser = null;
let currentChatId = null;
let isStreaming = false;

function initChat(user) {
  currentUser = user;
  refreshSidebar();
  const chats = getChats();
  const userChats = Object.values(chats).filter(c => c.owner === user.email);
  if (userChats.length > 0) {
    const latest = userChats.sort((a,b) => b.updatedAt - a.updatedAt)[0];
    loadChat(latest.id);
  } else {
    newChat();
  }
}

function refreshSidebar() {
  if (!currentUser) return;
  const users = getUsers();
  const u = users[currentUser.email] || {};
  const plan = PLANS[u.plan || "free"];
  const used = getMsgsUsed(currentUser.email);
  const limit = plan.msgs;

  document.getElementById("sb-username").textContent = currentUser.name;
  document.getElementById("sb-email").textContent = currentUser.email;
  document.getElementById("sb-plan").textContent = plan.name;
  document.getElementById("sb-counter").innerHTML = `<span>${limit - used}</span> / ${limit} messages left today`;

  const listEl = document.getElementById("chat-list");
  listEl.innerHTML = "";
  const chats = getChats();
  const userChats = Object.values(chats)
    .filter(c => c.owner === currentUser.email)
    .sort((a,b) => b.updatedAt - a.updatedAt);

  userChats.forEach(chat => {
    const div = document.createElement("div");
    div.className = "chat-item" + (chat.id === currentChatId ? " active" : "");
    div.innerHTML = `<span>${chat.title || "New Chat"}</span><button class="chat-item-del" title="Delete">×</button>`;
    div.querySelector("span").addEventListener("click", () => loadChat(chat.id));
    div.querySelector(".chat-item-del").addEventListener("click", e => { e.stopPropagation(); deleteChat(chat.id); });
    listEl.appendChild(div);
  });

  updateInputUI();
}

function updateInputUI() {
  if (!currentUser) return;
  const used = getMsgsUsed(currentUser.email);
  const limit = getMsgsLimit(currentUser.email);
  const warn = document.getElementById("limit-warning");
  const sendBtn = document.getElementById("send-btn");
  const msgInput = document.getElementById("msg-input");
  if (used >= limit) {
    warn.textContent = `⚠ Daily limit reached (${limit} msgs). Upgrade your plan for more.`;
    warn.style.display = "block";
    sendBtn.disabled = true;
    msgInput.disabled = true;
  } else {
    warn.style.display = "none";
    sendBtn.disabled = false;
    msgInput.disabled = false;
  }
}

function newChat() {
  const id = "chat_" + Date.now();
  currentChatId = id;
  const chats = getChats();
  chats[id] = { id, owner: currentUser.email, title: "New Chat", messages: [], updatedAt: Date.now() };
  saveChats(chats);
  renderMessages([]);
  document.getElementById("chat-title").textContent = "New Chat";
  refreshSidebar();
}

function loadChat(id) {
  const chats = getChats();
  if (!chats[id]) return;
  currentChatId = id;
  document.getElementById("chat-title").textContent = chats[id].title;
  renderMessages(chats[id].messages);
  refreshSidebar();
}

function deleteChat(id) {
  const chats = getChats();
  delete chats[id];
  saveChats(chats);
  if (currentChatId === id) { currentChatId = null; newChat(); }
  else refreshSidebar();
}

function renderMessages(msgs) {
  const area = document.getElementById("messages-area");
  area.innerHTML = "";
  if (!msgs || msgs.length === 0) {
    area.innerHTML = `<div class="welcome-msg"><h2>⚡ Infamous AI v1.1</h2><p>Developer-focused AI. Ask me anything — code, debugging, concepts.</p></div>`;
    return;
  }
  msgs.forEach(m => appendBubble(m.role, m.content, false));
  area.scrollTop = area.scrollHeight;
}

function appendBubble(role, content, scroll = true) {
  const area = document.getElementById("messages-area");
  const old = area.querySelector(".welcome-msg");
  if (old) old.remove();

  const div = document.createElement("div");
  div.className = "msg-bubble " + role;
  const avatar = role === "ai"
    ? `<div class="msg-avatar">AI</div>`
    : `<div class="msg-avatar">U</div>`;
  div.innerHTML = `${avatar}<div class="msg-content">${formatMessage(content)}</div>`;
  area.appendChild(div);
  if (scroll) area.scrollTop = area.scrollHeight;
  return div;
}

function formatMessage(text) {
  // Convert markdown-like formatting
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
  return html;
}

function showTyping() {
  const area = document.getElementById("messages-area");
  const div = document.createElement("div");
  div.className = "msg-bubble ai"; div.id = "typing-bubble";
  div.innerHTML = `<div class="msg-avatar">AI</div><div class="msg-content"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}
function removeTyping() {
  const t = document.getElementById("typing-bubble");
  if (t) t.remove();
}

// ── GEMINI API ─────────────────────────────────────────────
async function callGemini(messages) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    return "⚠️ **API Key Not Configured**\n\nGet your **free** Gemini API key:\n1. Go to https://aistudio.google.com/app/apikey\n2. Click **Create API Key**\n3. Copy & paste it into `script.js` at the top (replace `YOUR_GEMINI_API_KEY`)\n\nThe Gemini API is **completely free** — no credit card needed.";
  }

  // Build Gemini contents array from chat history
  const contents = messages.map(m => ({
    role: m.role === "ai" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const body = {
    contents,
    systemInstruction: {
      parts: [{ text: "You are Infamous AI v1.1 — a highly capable, developer-focused AI assistant. You excel at coding, debugging, and technical explanations. Be concise, accurate, and direct. Use markdown for code blocks." }]
    },
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
  };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
}

// ── SEND MESSAGE ───────────────────────────────────────────
async function sendMessage() {
  if (isStreaming) return;
  const input = document.getElementById("msg-input");
  const text = input.value.trim();
  if (!text) return;

  // Check limit
  const used = getMsgsUsed(currentUser.email);
  const limit = getMsgsLimit(currentUser.email);
  if (used >= limit) { updateInputUI(); return; }

  input.value = ""; input.style.height = "auto";

  const chats = getChats();
  if (!chats[currentChatId]) newChat();
  const chat = getChats()[currentChatId];

  // Add user message
  chat.messages.push({ role: "user", content: text });
  if (chat.title === "New Chat" && text.length > 0) {
    chat.title = text.slice(0, 36) + (text.length > 36 ? "…" : "");
    document.getElementById("chat-title").textContent = chat.title;
  }
  chat.updatedAt = Date.now();
  saveChats({ ...getChats(), [currentChatId]: chat });

  appendBubble("user", text);
  incrementMsgs(currentUser.email);
  refreshSidebar();

  isStreaming = true;
  document.getElementById("send-btn").disabled = true;
  showTyping();

  try {
    const reply = await callGemini(chat.messages);
    removeTyping();
    chat.messages.push({ role: "ai", content: reply });
    chat.updatedAt = Date.now();
    saveChats({ ...getChats(), [currentChatId]: chat });
    appendBubble("ai", reply);
    addLog("info", `Chat: ${currentUser.name} (${currentUser.email}) — ${chat.messages.length} msgs`);
  } catch (err) {
    removeTyping();
    appendBubble("ai", `❌ **Error:** ${err.message}`);
    addLog("error", `API error for ${currentUser.email}: ${err.message}`);
  } finally {
    isStreaming = false;
    document.getElementById("send-btn").disabled = false;
    updateInputUI();
  }
}

// ── INPUT EVENTS ───────────────────────────────────────────
document.getElementById("send-btn").addEventListener("click", sendMessage);
document.getElementById("msg-input").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
document.getElementById("msg-input").addEventListener("input", function() {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 160) + "px";
});
document.getElementById("new-chat-btn").addEventListener("click", newChat);
document.getElementById("plans-btn").addEventListener("click", () => { initPlans(); showScreen("plans-screen"); });
document.getElementById("logout-btn").addEventListener("click", () => {
  setCurrentUser(null);
  currentUser = null; currentChatId = null;
  showScreen("auth-screen");
});

// ══════════════════════════════════════════════════════════════
//  PLANS PAGE
// ══════════════════════════════════════════════════════════════
function initPlans() {
  const users = getUsers();
  const current = currentUser ? (users[currentUser.email]?.plan || "free") : "free";
  const grid = document.getElementById("plans-grid");
  grid.innerHTML = "";

  Object.entries(PLANS).forEach(([key, plan]) => {
    const isCurrent = key === current;
    const card = document.createElement("div");
    card.className = "plan-card" + (key === "bedrock" ? " featured" : "");
    card.innerHTML = `
      ${key === "bedrock" ? '<div class="badge-top">🔥 BEST VALUE</div>' : ""}
      <div class="plan-icon">${plan.icon}</div>
      <div class="plan-name">${plan.name}</div>
      <div class="plan-price">${plan.price}<br><small>${plan.priceUSD}</small></div>
      <div class="plan-msgs">${plan.msgs} msgs/day</div>
      <button class="btn-buy ${isCurrent ? "current" : ""}" data-plan="${key}" ${isCurrent ? "disabled" : ""}>
        ${isCurrent ? "✓ Current Plan" : "Buy Now"}
      </button>`;
    if (!isCurrent) {
      card.querySelector(".btn-buy").addEventListener("click", () => openPaymentModal(key, plan));
    }
    grid.appendChild(card);
  });
}

document.getElementById("plans-back-btn").addEventListener("click", () => showScreen("chat-screen"));

// ══════════════════════════════════════════════════════════════
//  PAYMENT MODAL
// ══════════════════════════════════════════════════════════════
function openPaymentModal(planKey, plan) {
  document.getElementById("modal-plan-name").textContent = `${plan.icon} ${plan.name} Plan`;
  document.getElementById("modal-plan-price").textContent = `${plan.price} / day limit: ${plan.msgs} messages`;
  document.getElementById("modal-overlay").classList.add("open");
}

document.getElementById("modal-close-btn").addEventListener("click", () => {
  document.getElementById("modal-overlay").classList.remove("open");
});
document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay"))
    document.getElementById("modal-overlay").classList.remove("open");
});

// ══════════════════════════════════════════════════════════════
//  ADMIN PANEL
// ══════════════════════════════════════════════════════════════
function initAdmin() {
  renderAdminStats();
  renderAdminUsers();
  renderAdminLogs();
}

// Admin navigation
document.querySelectorAll(".admin-nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav-item").forEach(i => i.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
    item.classList.add("active");
    document.getElementById(item.dataset.panel).classList.add("active");
  });
});

document.getElementById("admin-logout").addEventListener("click", () => {
  setCurrentUser(null);
  currentUser = null;
  showScreen("auth-screen");
});

function renderAdminStats() {
  const users = getUsers();
  const emails = Object.keys(users);
  const total = emails.length;
  const paid = emails.filter(e => users[e].plan !== "free").length;
  const planCounts = {};
  emails.forEach(e => { const p = users[e].plan || "free"; planCounts[p] = (planCounts[p] || 0) + 1; });
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-paid").textContent = paid;
  document.getElementById("stat-free").textContent = planCounts.free || 0;
  document.getElementById("stat-top").textContent = planCounts.bedrock || 0;
}

function renderAdminUsers() {
  const users = getUsers();
  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = "";
  const entries = Object.entries(users).filter(([e]) => e !== ADMIN_EMAIL);

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:20px">No users yet</td></tr>`;
    return;
  }

  entries.forEach(([email, u]) => {
    const used = getMsgsUsed(email);
    const limit = PLANS[u.plan || "free"].msgs;
    const tr = document.createElement("tr");
    const planOptions = Object.keys(PLANS).map(k =>
      `<option value="${k}" ${k === (u.plan||"free") ? "selected" : ""}>${PLANS[k].name}</option>`
    ).join("");
    tr.innerHTML = `
      <td>${u.name}</td>
      <td>${email}</td>
      <td><span class="plan-badge">${PLANS[u.plan||"free"].name}</span></td>
      <td>${used}/${limit}</td>
      <td>
        <select class="plan-sel" data-email="${email}">${planOptions}</select>
        <button class="btn-apply" data-email="${email}">Apply</button>
        <button class="btn-reset-lim" data-email="${email}">Reset</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-apply").forEach(btn => {
    btn.addEventListener("click", () => {
      const email = btn.dataset.email;
      const sel = tbody.querySelector(`.plan-sel[data-email="${email}"]`);
      const users2 = getUsers();
      const oldPlan = users2[email].plan || "free";
      users2[email].plan = sel.value;
      saveUsers(users2);
      addLog("warn", `Admin changed plan: ${email} ${oldPlan} → ${sel.value}`);
      renderAdminStats(); renderAdminUsers(); renderAdminLogs();
    });
  });
  tbody.querySelectorAll(".btn-reset-lim").forEach(btn => {
    btn.addEventListener("click", () => {
      const email = btn.dataset.email;
      const users2 = getUsers();
      users2[email].msgsUsed = 0;
      users2[email].limitDate = today();
      saveUsers(users2);
      addLog("warn", `Admin reset msg limit for: ${email}`);
      renderAdminUsers(); renderAdminLogs();
    });
  });
}

function renderAdminLogs() {
  const logs = getLogs();
  const box = document.getElementById("console-box");
  box.innerHTML = "";
  if (logs.length === 0) {
    box.innerHTML = `<div class="log-line" style="color:var(--text-dim)">No logs yet...</div>`;
    return;
  }
  logs.forEach(l => {
    const div = document.createElement("div");
    div.className = "log-line";
    div.innerHTML = `<span class="log-time">[${l.time}]</span><span class="log-tag ${l.tag}">${l.tag.toUpperCase()}</span><span class="log-msg">${l.msg}</span>`;
    box.appendChild(div);
  });
}

document.getElementById("refresh-logs-btn").addEventListener("click", () => {
  renderAdminLogs();
  addLog("info", "Admin refreshed console logs");
  renderAdminLogs();
});
document.getElementById("clear-logs-btn").addEventListener("click", () => {
  saveLogs([]);
  renderAdminLogs();
});

// ── BOOT ──────────────────────────────────────────────────
(function boot() {
  const user = getCurrentUser();
  if (!user) { showScreen("auth-screen"); return; }
  if (user.email === ADMIN_EMAIL) { initAdmin(); showScreen("admin-screen"); }
  else { initChat(user); showScreen("chat-screen"); }
})();
