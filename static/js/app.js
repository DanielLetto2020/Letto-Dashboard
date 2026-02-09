const authKey = 'letto_auth_token';
let lastUpdate = Date.now();
const UPDATE_MS = 20000;
let autoRefreshEnabled = false;
let originalContent = '';
let translatedContent = '';
let isTranslated = false;

async function downloadBackup() {
    const btn = document.getElementById('backup-btn');
    const originalContent = btn.innerHTML;
    const token = localStorage.getItem(authKey);
    
    btn.innerHTML = '<span>⌛</span> <span>Zipping...</span>';
    btn.disabled = true;
    
    try {
        const url = `/api/system/backup?token=${token}`;
        const res = await fetch(url);
        if (res.ok) {
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            const dateStr = new Date().toISOString().split('T')[0];
            link.download = `letto_backup_${dateStr}.zip`;
            link.click();
            btn.innerHTML = '<span>✅</span> <span>Done!</span>';
        } else {
            btn.innerHTML = '<span>❌</span> <span>Error</span>';
        }
    } catch (e) {
        console.error("Backup error:", e);
        btn.innerHTML = '<span>❌</span> <span>Error</span>';
    }
    
    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }, 5000);
}

async function api(path, method = 'GET', body = null) {
    const token = localStorage.getItem(authKey);
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify({ ...body, token });
    else if (token) path += (path.includes('?') ? '&' : '?') + 'token=' + token;
    
    try {
        const res = await fetch(path, options);
        if (res.status === 401 && path !== '/api/auth') logout();
        return await res.json();
    } catch (e) {
        console.error("API Error:", e);
        return null;
    }
}

function navigateTo(path) {
    window.history.pushState({}, "", path);
    handleRouting();
}

function handleRouting() {
    const path = window.location.pathname;
    const components = {
        '/': 'main-dashboard-content',
        '/explorer': 'explorer-view-content',
        '/agents': 'agents-view-content',
        '/git': 'git-view-content'
    };

    const tabs = {
        '/': 'tab-main',
        '/explorer': 'tab-explorer',
        '/agents': 'tab-agents',
        '/git': 'tab-git'
    };

    // Hide all
    Object.values(components).forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    // Reset tabs
    Object.values(tabs).forEach(id => {
        const el = document.getElementById(id);
        if(el) el.className = "text-[14px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-200 transition-all";
    });

    // Show active
    const activeComp = components[path] || components['/'];
    const activeTab = tabs[path] || tabs['/'];
    
    if(document.getElementById(activeComp)) document.getElementById(activeComp).classList.remove('hidden');
    if(document.getElementById(activeTab)) document.getElementById(activeTab).className = "text-[14px] font-bold uppercase tracking-[0.2em] text-emerald-400 border-b-2 border-emerald-500 pb-1 transition-all";

    if (path === '/git') updateGitPage();
}

window.onpopstate = () => handleRouting();

async function updateGitPage() {
    const data = await api('/api/status');
    if (!data || !data.git) return;
    document.getElementById('git-page-branch').innerText = data.git.branch;
    const list = document.getElementById('git-full-list');
    list.innerHTML = '';
    data.git.commits.forEach(c => {
        const row = document.createElement('div');
        row.className = 'py-4 border-b border-white/5 flex flex-col gap-2 scale-in';
        row.innerHTML = `<span class="text-[15px] text-slate-100 font-bold leading-tight">${c.msg}</span><span class="text-[11px] text-emerald-500/60 font-mono uppercase tracking-widest">${c.date}</span>`;
        list.appendChild(row);
    });
}

async function updateStats() {
    const isManual = arguments[0] === true;
    if (!autoRefreshEnabled && !isManual) return;
    
    const data = await api('/api/status');
    if (!data) return;
    
    // Header Stats (Fast)
    if(document.getElementById('stat-cpu')) document.getElementById('stat-cpu').innerText = Math.round(data.cpu) + '%';
    if(document.getElementById('stat-ram')) document.getElementById('stat-ram').innerText = Math.round(data.ram) + '%';
    if(document.getElementById('stat-disk')) document.getElementById('stat-disk').innerText = Math.round(data.disk) + '%';
    if(document.getElementById('stat-uptime')) document.getElementById('stat-uptime').innerText = data.uptime;
    
    const hbS = Math.floor(Date.now()/1000) - data.heartbeat_last;
    if(document.getElementById('hb-last-seen')) document.getElementById('hb-last-seen').innerText = hbS < 60 ? 'Now' : Math.floor(hbS/60) + 'm ago';
    
    if (data.files && document.getElementById('files-tree')) document.getElementById('files-tree').innerHTML = renderTree(data.files);
    
    if (data.system_configs && document.getElementById('system-configs-list')) {
        const sysList = document.getElementById('system-configs-list');
        sysList.innerHTML = '';
        data.system_configs.forEach(node => {
            const row = document.createElement('div');
            row.className = 'py-2 flex items-center active:bg-white/5 rounded px-2 cursor-pointer';
            row.onclick = () => openFile(node.path);
            row.innerHTML = `<span class="mr-2">⚙️</span><span class="text-slate-300 text-[14px]">${node.name}</span>`;
            sysList.appendChild(row);
        });
    }
    
    const agentsList = document.getElementById('agents-list');
    if(agentsList) {
        document.getElementById('stat-agents-count').innerText = data.agents.length;
        agentsList.innerHTML = '';
        data.agents.forEach(a => {
            const row = document.createElement('div');
            row.className = 'row-item py-4 flex justify-between items-center text-slate-300';
            row.innerHTML = `<span class="text-[14px] font-bold">${a.name}</span><span class="text-[11px] text-slate-600 font-mono italic">PID:${a.pid}</span>`;
            agentsList.appendChild(row);
        });
    }

    const cronList = document.getElementById('cron-list');
    if(cronList && data.cron) {
        document.getElementById('cron-count').innerText = data.cron.length;
        cronList.innerHTML = '';
        data.cron.forEach(job => {
            const row = document.createElement('div');
            row.className = 'row-item py-4 flex flex-col text-left gap-2';
            row.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="text-[14px] text-slate-200 font-bold">${job.name || 'Unnamed Task'}</span>
                    <span class="text-[11px] text-emerald-500/60 font-mono uppercase">${job.schedule || 'at once'}</span>
                </div>
                <div class="flex justify-between items-center text-[12px] text-slate-500">
                    <span class="truncate pr-4">${job.payload}</span>
                    <span class="font-bold text-slate-800">${job.id.slice(0,8)}</span>
                </div>`;
            cronList.appendChild(row);
        });
    }

    if (document.activeElement !== document.getElementById('heartbeat-editor')) {
        const hbEditor = document.getElementById('heartbeat-editor');
        if(hbEditor) hbEditor.value = data.heartbeat_raw;
    }
    
    if (isManual || (autoRefreshEnabled && (Date.now() - lastUpdate >= UPDATE_MS))) {
        lastUpdate = Date.now();
        updateAiStatus(false); // Background update
    }
}

async function updateAiStatus(isLive) {
    const statusEl = document.getElementById('ai-full-status');
    const btn = document.getElementById('ai-status-refresh');
    
    if(isLive) { 
        statusEl.classList.add('animate-pulse');
        btn.innerText = '⌛';
    }

    // Attempt cache first on initial load, then live
    const endpoint = isLive ? '/api/ai_status_live' : '/api/ai_status_cached';
    const data = await api(endpoint);

    if (data && !data.error) {
        const usedK = (data.used / 1000).toFixed(1);
        const modelStr = data.model ? ` [${data.model}]` : '';
        const timeStr = data.timestamp ? ` (as of ${new Date(data.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})` : '';
        statusEl.innerText = `${usedK}k/1m(${data.percent}%)${modelStr}`;
        statusEl.title = "Last update: " + timeStr;
    }

    if(isLive) {
        statusEl.classList.remove('animate-pulse');
        btn.innerText = '🩺';
    }
}

function renderTree(nodes, indent = 0) {
    let html = '';
    nodes.forEach(node => {
        const pad = indent * 16;
        if (node.is_dir) {
            html += `<div class="py-1">
                <div class="flex items-center active:bg-white/5 rounded px-2" style="padding-left: ${pad}px" onclick="toggleDir(this)">
                    <span class="mr-2 text-[10px] folder-arrow rotate-0 transition-transform text-slate-600">▶</span><span class="mr-2">📁</span>
                    <span class="text-emerald-400 font-bold uppercase tracking-tight text-[14px]">${node.name}</span>
                </div>
                <div class="dir-children hidden">${node.children ? renderTree(node.children, indent + 1) : ''}</div>
            </div>`;
        } else {
            html += `<div class="py-2 flex items-center active:bg-white/5 rounded px-2" style="padding-left: ${pad}px" onclick="openFile('${node.path.replace(/'/g, "\\'")}')">
                <span class="mr-2 ml-4">📄</span><span class="text-slate-300 text-[14px]">${node.name}</span>
            </div>`;
        }
    });
    return html;
}

function toggleDir(el) {
    const children = el.nextElementSibling;
    const arrow = el.querySelector('.folder-arrow');
    const isHidden = children.classList.contains('hidden');
    children.classList.toggle('hidden');
    arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
}

function toggleAllDirs(exp) {
    document.querySelectorAll('.dir-children').forEach(c => c.classList.toggle('hidden', !exp));
    document.querySelectorAll('.folder-arrow').forEach(a => a.style.transform = exp ? 'rotate(90deg)' : 'rotate(0deg)');
}

async function openFile(path, page = 1) {
    const mainContent = document.getElementById('main-dashboard-content');
    const agentsContent = document.getElementById('agents-view-content');
    const gitContent = document.getElementById('git-view-content');
    const explorerContent = document.getElementById('explorer-view-content');
    const fileViewer = document.getElementById('file-viewer-content');

    [mainContent, agentsContent, gitContent, explorerContent].forEach(c => { if(c) c.classList.add('hidden'); });
    fileViewer.classList.remove('hidden');
    document.getElementById('viewer-filename').innerText = path.split('/').pop();
    
    const codeEl = document.getElementById('viewer-text');
    codeEl.innerText = 'Loading...';
    
    const translateBtn = document.getElementById('translate-btn');
    translateBtn.classList.add('hidden');
    isTranslated = false;
    translateBtn.innerText = 'Translate';

    const data = await api(`/api/files/read?path=${encodeURIComponent(path)}&page=${page}`);
    if (!data || data.error) { codeEl.innerText = data ? data.error : 'Connection error'; return; }
    
    originalContent = data.content;
    translatedContent = '';
    codeEl.innerText = originalContent;

    const ext = path.split('.').pop().toLowerCase();
    if (ext === 'md' || ext === 'txt') {
        translateBtn.classList.remove('hidden');
    }
}

function closeFileViewer() {
    document.getElementById('file-viewer-content').classList.add('hidden');
    handleRouting();
}

async function toggleTranslation() {
    const btn = document.getElementById('translate-btn');
    const codeEl = document.getElementById('viewer-text');
    
    if (isTranslated) {
        codeEl.innerText = originalContent;
        btn.innerText = 'Translate';
        isTranslated = false;
    } else {
        if (!translatedContent) {
            btn.innerText = 'Translating...';
            const res = await api('/api/translate', 'POST', { text: originalContent });
            if (res && res.translated) {
                translatedContent = res.translated;
            } else {
                alert('Translation failed. Check backend logs.');
                btn.innerText = 'Translate';
                return;
            }
        }
        codeEl.innerText = translatedContent;
        btn.innerText = 'Original';
        isTranslated = true;
    }
}

async function saveHeartbeat() {
    const res = await api('/api/heartbeat/update', 'POST', { content: document.getElementById('heartbeat-editor').value });
    if (res && res.success) {
        const btn = document.querySelector('button[onclick="saveHeartbeat()"]');
        btn.innerText = 'OK';
        setTimeout(() => btn.innerText = 'SAVE TASKS', 2000);
    }
}

function updateTimer() {
    const timerEl = document.getElementById('sync-timer');
    if(!timerEl) return;
    if (!autoRefreshEnabled) {
        timerEl.parentElement.parentElement.style.opacity = '0.3';
        timerEl.innerText = '20';
        return;
    }
    timerEl.parentElement.parentElement.style.opacity = '1';
    const now = Date.now();
    const elapsed = now - lastUpdate;
    if (elapsed >= UPDATE_MS) { updateStats(); return; }
    const rem = Math.max(0, UPDATE_MS - elapsed);
    const seconds = Math.floor(rem / 1000);
    const ms = rem % 1000;
    timerEl.innerHTML = `${seconds}<span class="ms-text">.${ms.toString().padStart(3, '0')}</span>`;
}

function toggleAutoRefresh(enabled) {
    autoRefreshEnabled = enabled;
    if (enabled) { lastUpdate = Date.now(); updateStats(); }
}

async function handleLogin() {
    const t = document.getElementById('token-input').value;
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) });
    if (res.ok) { localStorage.setItem(authKey, t); location.reload(); }
}

function logout() { localStorage.removeItem(authKey); location.reload(); }

window.onload = async () => {
    // Check for Magic Link (?key=...)
    const urlParams = new URLSearchParams(window.location.search);
    const magicKey = urlParams.get('key');
    if (magicKey) {
        localStorage.setItem(authKey, magicKey);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const t = localStorage.getItem(authKey);
    if (t) {
        const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) });
        if (res.ok) {
            document.getElementById('boot-loader').classList.add('hidden');
            document.getElementById('dashboard-view').classList.remove('hidden');
            handleRouting();
            updateStats(true); 
            updateAiStatus(false); // Background cached update
            setInterval(updateTimer, 41);
            return;
        }
    }
    document.getElementById('boot-loader').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
};
