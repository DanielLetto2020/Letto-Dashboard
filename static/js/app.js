const authKey = 'letto_auth_token';
let lastUpdate = Date.now();
const UPDATE_MS = 20000;
let autoRefreshEnabled = false;
let originalContent = '';
let translatedContent = '';
let isTranslated = false;

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
    const mainContent = document.getElementById('main-dashboard-content');
    const agentsContent = document.getElementById('agents-view-content');
    const gitContent = document.getElementById('git-view-content');
    const explorerContent = document.getElementById('explorer-view-content');
    
    const tabMain = document.getElementById('tab-main');
    const tabAgents = document.getElementById('tab-agents');
    const tabGit = document.getElementById('tab-git');
    const tabExplorer = document.getElementById('tab-explorer');

    // Reset visibility
    [mainContent, agentsContent, gitContent, explorerContent].forEach(c => {
        if(c) c.classList.add('hidden');
    });

    [tabMain, tabAgents, tabGit, tabExplorer].forEach(t => {
        if(t) t.className = "text-[14px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-200 transition-all";
    });

    if (path === '/agents') {
        if(agentsContent) agentsContent.classList.remove('hidden');
        if(tabAgents) tabAgents.className = "text-[14px] font-bold uppercase tracking-[0.2em] text-emerald-400 border-b-2 border-emerald-500 pb-1 transition-all";
    } else if (path === '/git') {
        if(gitContent) gitContent.classList.remove('hidden');
        if(tabGit) tabGit.className = "text-[14px] font-bold uppercase tracking-[0.2em] text-emerald-400 border-b-2 border-emerald-500 pb-1 transition-all";
        updateGitPage();
    } else if (path === '/explorer') {
        if(explorerContent) explorerContent.classList.remove('hidden');
        if(tabExplorer) tabExplorer.className = "text-[14px] font-bold uppercase tracking-[0.2em] text-emerald-400 border-b-2 border-emerald-500 pb-1 transition-all";
    } else {
        if(mainContent) mainContent.classList.remove('hidden');
        if(tabMain) tabMain.className = "text-[14px] font-bold uppercase tracking-[0.2em] text-emerald-400 border-b-2 border-emerald-500 pb-1 transition-all";
    }
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
    
    // Header Stats
    document.getElementById('stat-cpu').innerText = Math.round(data.cpu) + '%';
    document.getElementById('stat-ram').innerText = Math.round(data.ram) + '%';
    document.getElementById('stat-disk').innerText = Math.round(data.disk) + '%';
    document.getElementById('stat-uptime').innerText = data.uptime;
    
    if (data.ai) {
        const fullStatus = document.getElementById('ai-full-status');
        if (fullStatus) {
            const usedK = (data.ai.used / 1000).toFixed(1);
            fullStatus.innerText = `${usedK}k/1m(${data.ai.percent}%)`;
        }
    }

    const hbS = Math.floor(Date.now()/1000) - data.heartbeat_last;
    document.getElementById('hb-last-seen').innerText = hbS < 60 ? 'Now' : Math.floor(hbS/60) + 'm ago';
    
    if (data.files) document.getElementById('files-tree').innerHTML = renderTree(data.files);
    
    const agentsList = document.getElementById('agents-list');
    document.getElementById('stat-agents-count').innerText = data.agents.length;
    agentsList.innerHTML = '';
    data.agents.forEach(a => {
        const row = document.createElement('div');
        row.className = 'row-item py-4 flex justify-between items-center text-slate-300';
        row.innerHTML = `<span class="text-[14px] font-bold">${a.name}</span><span class="text-[11px] text-slate-600 font-mono italic">PID:${a.pid}</span>`;
        agentsList.appendChild(row);
    });

    const cronList = document.getElementById('cron-list');
    const cronCount = document.getElementById('cron-count');
    if (data.cron) {
        cronCount.innerText = data.cron.length;
        if (data.cron.length > 0) {
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
    }

    if (document.activeElement !== document.getElementById('heartbeat-editor')) {
        document.getElementById('heartbeat-editor').value = data.heartbeat_raw;
    }
    
    if (isManual || (autoRefreshEnabled && (Date.now() - lastUpdate >= UPDATE_MS))) {
        lastUpdate = Date.now();
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
    document.getElementById('main-dashboard-content').classList.add('hidden');
    document.getElementById('agents-view-content').classList.add('hidden');
    document.getElementById('git-view-content').classList.add('hidden');
    document.getElementById('explorer-view-content').classList.add('hidden');
    document.getElementById('file-viewer-content').classList.remove('hidden');
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

function closeFileViewer() {
    document.getElementById('file-viewer-content').classList.add('hidden');
    handleRouting();
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
        console.log("Letto Explorer: Magic Key applied from URL");
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
            setInterval(updateTimer, 41);
            return;
        }
    }
    document.getElementById('boot-loader').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
};
