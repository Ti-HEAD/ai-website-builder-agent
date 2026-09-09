export function renderFrontend(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#0f0f1a">
  <title>AI Web Site Builder</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f0f1a; color: #e0e0e8;
      height: 100vh; height: 100dvh;
      display: flex; flex-direction: column; overflow: hidden;
    }
    header {
      background: linear-gradient(135deg, #f6821f, #faae40);
      padding: 12px 16px; display: flex; align-items: center; gap: 8px;
      flex-wrap: wrap; flex-shrink: 0;
    }
    header h1 { font-size: 16px; color: #fff; font-weight: 700; }
    header .badge {
      background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 10px;
      font-size: 10px; color: #fff; white-space: nowrap;
    }
    .tabs { display: flex; background: #16162a; border-bottom: 1px solid #2a2a3a; flex-shrink: 0; }
    .tab {
      flex: 1; padding: 10px; text-align: center; font-size: 13px; font-weight: 600;
      color: #666; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;
    }
    .tab.active { color: #f6821f; border-bottom-color: #f6821f; }
    .tab .badge-count { background: #f6821f; color: #fff; border-radius: 10px; padding: 1px 6px; font-size: 10px; margin-left: 4px; }
    .panel { display: none; flex: 1; overflow: hidden; }
    .panel.active { display: flex; flex-direction: column; }
    #messages {
      flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
      padding: 12px; display: flex; flex-direction: column; gap: 10px;
    }
    .msg {
      max-width: 85%; padding: 10px 14px; border-radius: 14px;
      line-height: 1.5; font-size: 14px; white-space: pre-wrap; word-break: break-word;
    }
    .msg.user { align-self: flex-end; background: #f6821f; color: #fff; border-bottom-right-radius: 4px; }
    .msg.assistant { align-self: flex-start; background: #1e1e36; border: 1px solid #2a2a3a; border-bottom-left-radius: 4px; }
    .msg.tool { align-self: center; background: #1a1a2a; border: 1px dashed #444; font-size: 12px; color: #aaa; max-width: 92%; }
    .msg.tool .tool-name { color: #f6821f; font-weight: 600; }
    .input-bar {
      padding: 10px 12px; padding-bottom: max(10px, env(safe-area-inset-bottom));
      border-top: 1px solid #2a2a3a; display: flex; gap: 8px; background: #16162a; flex-shrink: 0;
    }
    #input {
      flex: 1; background: #1e1e36; border: 1px solid #2a2a3a; border-radius: 20px;
      padding: 10px 16px; color: #e0e0e8; font-size: 16px; outline: none;
      resize: none; max-height: 120px; overflow-y: auto; line-height: 1.5; font-family: inherit;
    }
    #input:focus { border-color: #f6821f; }
    #send {
      background: #f6821f; color: #fff; border: none; border-radius: 50%;
      width: 44px; height: 44px; font-size: 18px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    #send:active { background: #e07010; }
    .files-list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 8px; }
    .file-item {
      padding: 12px; margin-bottom: 6px; background: #1e1e36; border-radius: 10px;
      cursor: pointer; font-size: 14px; transition: background 0.2s;
    }
    .file-item:active { background: #2a2a48; }
    .file-item .name { font-weight: 600; color: #e0e0e8; }
    .file-item .meta { font-size: 11px; color: #888; margin-top: 2px; }
    .file-item.screenshot { border-left: 3px solid #f6821f; }
    .file-item.code { border-left: 3px solid #4ade80; }
    .screenshot-preview { max-width: 100%; border-radius: 8px; margin-top: 8px; border: 1px solid #2a2a3a; }
    .preview-link {
      display: inline-block; margin-top: 8px; padding: 8px 16px;
      background: #f6821f; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;
    }
    .step-indicator { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 600; margin-right: 5px; }
    .step-plan { background: #3b82f6; color: #fff; }
    .step-generate { background: #8b5cf6; color: #fff; }
    .step-save { background: #10b981; color: #fff; }
    .step-screenshot { background: #f59e0b; color: #fff; }
    .step-review { background: #ec4899; color: #fff; }
    .empty { text-align: center; color: #555; padding: 30px 20px; font-size: 13px; }
    .quick-prompts { display: flex; gap: 6px; padding: 8px 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; flex-shrink: 0; }
    .quick-prompt {
      background: #1e1e36; border: 1px solid #2a2a3a; border-radius: 16px;
      padding: 6px 12px; font-size: 12px; color: #aaa; white-space: nowrap; cursor: pointer; flex-shrink: 0;
    }
    .quick-prompt:active { background: #2a2a48; }
    .usage-bar { padding: 8px 12px; background: #16162a; border-bottom: 1px solid #2a2a3a; font-size: 11px; color: #888; flex-shrink: 0; }
    .usage-bar .usage-warn { color: #f59e0b; }
    .usage-bar .usage-ok { color: #4ade80; }
    @media (min-width: 768px) {
      .tabs { display: none; }
      .panel { display: flex !important; }
      .layout { display: flex; flex: 1; overflow: hidden; }
      .chat-panel { flex: 1; }
      .files-panel { width: 320px; border-left: 1px solid #2a2a3a; background: #16162a; }
      #messages { padding: 24px; gap: 16px; }
      .msg { max-width: 75%; }
      header { padding: 16px 24px; }
      header h1 { font-size: 20px; }
      .input-bar { padding: 16px 24px; }
      #input { border-radius: 12px; }
      #send { border-radius: 12px; width: auto; padding: 12px 24px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>🏗️ AI Site Builder</h1>
    <span class="badge">Agents SDK</span>
    <span class="badge">Workers AI</span>
    <span class="badge">R2</span>
    <span class="badge">Browser Run</span>
  </header>
  <div class="usage-bar" id="usage-bar">📊 R2: 読み込み中...</div>
  <div class="quick-prompts">
    <div class="quick-prompt" onclick="fillPrompt('ポートフォリオサイトを作って。スキル、経歴、連絡先を含めて')">ポートフォリオ</div>
    <div class="quick-prompt" onclick="fillPrompt('レストランの紹介サイトを作って。メニュー、営業時間、アクセス情報を含めて')">レストラン</div>
    <div class="quick-prompt" onclick="fillPrompt('ランディングページを作って。製品紹介とCTAボタンを含めて')">LP</div>
    <div class="quick-prompt" onclick="fillPrompt('ブログサイトを作って。記事一覧とAboutページを含めて')">ブログ</div>
  </div>
  <div class="tabs">
    <div class="tab active" onclick="switchTab('chat')">💬 チャット</div>
    <div class="tab" onclick="switchTab('files')">📁 ファイル <span class="badge-count" id="file-count">0</span></div>
  </div>
  <div class="layout" style="flex:1; overflow:hidden; display:flex; flex-direction:column;">
    <div class="panel active" id="chat-panel" style="flex-direction:column;">
      <div id="messages">
        <div class="empty">AIエージェントにサイト作成を指示してください。<br>上のクイックプロンプトをタップでもOK</div>
      </div>
      <div class="input-bar">
        <textarea id="input" placeholder="サイトの要件を入力..." autocomplete="off" enterkeyhint="send" rows="1"></textarea>
        <button id="send">➤</button>
      </div>
    </div>
    <div class="panel" id="files-panel" style="flex-direction:column; background:#16162a;">
      <div class="files-list" id="files-list"><div class="empty">ファイルなし</div></div>
    </div>
  </div>
  <script>
    const messagesEl = document.getElementById("messages");
    const inputEl = document.getElementById("input");
    const sendBtn = document.getElementById("send");
    const filesListEl = document.getElementById("files-list");
    const fileCountEl = document.getElementById("file-count");
    const usageBarEl = document.getElementById("usage-bar");
    function switchTab(tab) {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      if (tab === "chat") {
        document.querySelector(".tab:nth-child(1)").classList.add("active");
        document.getElementById("chat-panel").classList.add("active");
      } else {
        document.querySelector(".tab:nth-child(2)").classList.add("active");
        document.getElementById("files-panel").classList.add("active");
      }
    }
    function fillPrompt(text) { inputEl.value = text; inputEl.focus(); }
    const wsUrl = (location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host + "/agents/site-builder-agent/session";
    let ws;
    function connect() {
      usageBarEl.textContent = "📊 接続中...";
      ws = new WebSocket(wsUrl);
      ws.onopen = () => { usageBarEl.textContent = "📊 接続済み ✅"; };
      ws.onerror = (e) => { usageBarEl.textContent = "📊 接続エラー ❌"; console.error("WS error:", e); };
      ws.onmessage = (event) => { try { handleMessage(JSON.parse(event.data)); } catch(e) {} };
      ws.onclose = () => { usageBarEl.textContent = "📊 切断・再接続中..."; setTimeout(connect, 2000); };
    }
    function handleMessage(data) {
      if (data.type === "text-delta") appendTextDelta(data.textDelta);
      else if (data.type === "tool-call") addToolMessage(data.toolName, "実行中...");
      else if (data.type === "tool-result") handleToolResult(data.toolName, data.result);
      else if (data.type === "finish") refreshFiles();
    }
    let currentAssistantMsg = null;
    function appendTextDelta(text) {
      const empty = messagesEl.querySelector(".empty"); if (empty) empty.remove();
      if (!currentAssistantMsg) {
        currentAssistantMsg = document.createElement("div"); currentAssistantMsg.className = "msg assistant";
        messagesEl.appendChild(currentAssistantMsg);
      }
      currentAssistantMsg.textContent += text;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    function addToolMessage(toolName, status) {
      const empty = messagesEl.querySelector(".empty"); if (empty) empty.remove();
      currentAssistantMsg = null;
      const div = document.createElement("div"); div.className = "msg tool";
      const indicator = getStepIndicator(toolName);
      div.innerHTML = indicator + '<span class="tool-name">' + toolName + "</span> " + status;
      messagesEl.appendChild(div); messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    function getStepIndicator(toolName) {
      const map = {
        planProject: { c: "step-plan", l: "📋" },
        generateFile: { c: "step-generate", l: "📝" },
        saveToR2: { c: "step-save", l: "💾" },
        screenshotSite: { c: "step-screenshot", l: "🖥️" },
        reviewCode: { c: "step-review", l: "🔍" },
      };
      const s = map[toolName];
      return s ? '<span class="step-indicator ' + s.c + '">' + s.l + "</span>" : "";
    }
    function handleToolResult(toolName, result) {
      if (toolName === "planProject" && result.files) {
        addToolMessage(toolName, "完了\\n" + result.files.map(f => "・" + f.filename).join("\\n"));
      } else if (toolName === "generateFile" && result.filename) {
        addToolMessage(toolName, "完了: " + result.filename);
      } else if (toolName === "saveToR2" && result.saved) {
        addToolMessage(toolName, "保存: " + result.filename); refreshFiles();
      } else if (toolName === "screenshotSite" && result.screenshotKey) {
        addToolMessage(toolName, '完了\\n<img class="screenshot-preview" src="/preview/' + result.screenshotKey + '" />');
      } else if (toolName === "reviewCode") {
        addToolMessage(toolName, (result.approved ? "✅" : "⚠️") + " " + result.feedback);
        if (result.approved) addPreviewLinks();
      }
    }
    function addPreviewLinks() {
      const div = document.createElement("div"); div.className = "msg assistant";
      div.innerHTML = '<strong>✅ 完成！</strong><br><a class="preview-link" href="/preview/index.html" target="_blank">サイトを開く</a>';
      messagesEl.appendChild(div); messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        usageBarEl.textContent = "📊 接続されていません。少し待ってから再試行してください。";
        return;
      }
      const empty = messagesEl.querySelector(".empty"); if (empty) empty.remove();
      const d = document.createElement("div"); d.className = "msg user"; d.textContent = text;
      messagesEl.appendChild(d);
      ws.send(JSON.stringify({ type: "message", message: { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] } }));
      inputEl.value = ""; inputEl.style.height = "auto"; currentAssistantMsg = null;
    }
    sendBtn.addEventListener("click", sendMessage);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    });
    async function refreshFiles() {
      try {
        const res = await fetch("/api/files"); const data = await res.json();
        filesListEl.innerHTML = ""; fileCountEl.textContent = data.files.length;
        if (data.usage) {
          const u = data.usage; const pct = (u.storageGB / u.storageLimitGB * 100).toFixed(1);
          const warnClass = u.storageWarning ? "usage-warn" : "usage-ok";
          usageBarEl.innerHTML = '📊 R2: ' + u.storageGB + ' GB / ' + u.storageLimitGB + ' GB (' + pct + '%) · ファイル ' + u.fileCount + '/' + u.fileCountLimit +
            (u.storageWarning ? ' <span class="' + warnClass + '">⚠️ 無料枠接近</span>' : ' <span class="' + warnClass + '">✅ 安全</span>');
        }
        if (data.files.length === 0) { filesListEl.innerHTML = '<div class="empty">ファイルなし</div>'; return; }
        data.files.forEach(f => {
          const item = document.createElement("div");
          item.className = "file-item " + (f.isScreenshot ? "screenshot" : "code");
          item.innerHTML = '<div class="name">' + (f.isScreenshot ? "🖼️" : "📄") + " " + f.key + "</div>" +
            '<div class="meta">' + (f.size/1024).toFixed(1) + " KB · " + new Date(f.uploaded).toLocaleString("ja-JP") + "</div>";
          item.addEventListener("click", () => window.open("/preview/" + f.key, "_blank"));
          filesListEl.appendChild(item);
        });
      } catch(e) {}
    }
    connect(); refreshFiles();
  </script>
</body>
</html>`;
}
