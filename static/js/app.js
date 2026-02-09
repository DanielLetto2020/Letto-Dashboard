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
    const components = {
        '/': 'main-dashboard-content',
        '/explorer': 'explorer-view-content',
        '/projects': 'projects-view-content',
        '/git': 'git-view-content'
    };

    const tabs = {
        '/': 'tab-main',
        '/explorer': 'tab-explorer',
        '/projects': 'tab-projects',
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
    let activeTabId = tabs[path] || tabs['/'];
    if (!document.getElementById(activeTabId)) activeTabId = 'tab-main';
    
    if(document.getElementById(activeComp)) document.getElementById(activeComp).classList.remove('hidden');
    if(document.getElementById(activeTabId)) document.getElementById(activeTabId).className = "text-[14px] font-bold uppercase tracking-[0.2em] text-emerald-400 border-b-2 border-emerald-500 pb-1 transition-all";

    // Ensure detail view is hidden unless on /projects/<name>
    const detailView = document.getElementById('project-detail-view-content');
    if (detailView) detailView.classList.add('hidden');

    if (path === '/git') updateGitPage();
    if (path === '/projects') updateProjectsPage();

    // Handle /projects/<name> route
    if (path.startsWith('/projects/')) {
        const projectName = path.split('/')[2];
        if (projectName) {
            if(document.getElementById('projects-view-content')) document.getElementById('projects-view-content').classList.add('hidden');
            showProjectDetails(projectName);
        }
    }
}

async function updateProjectsPage() {
    const data = await api('/api/projects');
    if (!data) return;
    const list = document.getElementById('projects-list');
    if(!list) return;
    list.innerHTML = '';
    data.forEach(p => {
        const card = document.createElement('div');
        card.className = 'stat-card p-6 rounded-3xl flex flex-col gap-3 scale-in';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <span class="text-xl font-bold text-white">${p.name}</span>
                <span class="text-[10px] ${p.has_git ? 'text-emerald-400 bg-emerald-400/10 shadow-[0_0_10px_rgba(52,211,153,0.1)]' : 'text-slate-600 bg-white/5'} px-2 py-1 rounded-lg font-mono uppercase">
                    ${p.has_git ? 'GIT ACTIVE' : 'NO GIT'}
                </span>
            </div>
            <div class="text-[11px] text-slate-500 uppercase tracking-widest">
                Origin: <span class="${p.has_origin ? 'text-emerald-500' : 'text-slate-700'}">${p.has_origin ? 'Connected' : 'Local Only'}</span>
            </div>
        `;
        card.onclick = () => navigateTo('/projects/' + p.name);
        list.appendChild(card);
    });
}

async function showProjectDetails(projectName) {
    // Hide all main content views
    const mainContent = document.getElementById('main-dashboard-content');
    const projectsContent = document.getElementById('projects-view-content');
    const gitContent = document.getElementById('git-view-content');
    const explorerContent = document.getElementById('explorer-view-content');
    [mainContent, projectsContent, gitContent, explorerContent].forEach(c => { if(c) c.classList.add('hidden'); });

    // Ensure the project detail view container exists
    let projectDetailContent = document.getElementById('project-detail-view-content');
    if (!projectDetailContent) {
        projectDetailContent = document.createElement('div');
        projectDetailContent.id = 'project-detail-view-content';
        projectDetailContent.className = 'view-content w-full h-full';
        document.getElementById('dashboard-view').appendChild(projectDetailContent);
    }
    projectDetailContent.classList.remove('hidden');

    // Fetch data to get the file tree
    const data = await api('/api/status');
    if (!data || !data.files) {
        projectDetailContent.innerHTML = `<div class="p-8 text-center text-red-500">Error loading project data</div>`;
        return;
    }

    // Find the project folder
    let projectNode = null;
    const projectsRoot = data.files.find(f => f.name === 'projects' && f.is_dir);
    if (projectsRoot && projectsRoot.children) {
        projectNode = projectsRoot.children.find(f => f.name === projectName && f.is_dir);
    }

    if (!projectNode) {
        projectDetailContent.innerHTML = `
            <div class="p-8 text-center">
                <div class="text-slate-500 mb-4">Project "${projectName}" not found.</div>
                <button onclick="navigateTo('/projects')" class="btn-primary px-6 py-2">Back to Projects</button>
            </div>`;
        return;
    }

    const downloadUrl = `/api/projects/${projectName}/download?token=${localStorage.getItem(authKey)}`;

    projectDetailContent.innerHTML = `
        <div class="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <div class="flex items-center gap-2 text-emerald-500 mb-1 cursor-pointer hover:text-emerald-400 text-sm font-mono uppercase tracking-widest" onclick="navigateTo('/projects')">
                        <span>←</span> back to list
                    </div>
                    <h2 class="text-3xl font-black text-white flex items-center gap-3">
                        ${projectName} <span class="bg-emerald-500 text-slate-900 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-tighter">v${projectNode.version || '1.0'}</span>
                    </h2>
                </div>
                <div class="flex gap-2">
                    <a href="${downloadUrl}" class="flex-1 sm:flex-none btn-primary bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/20">
                        <span>📥</span> Download ZIP
                    </a>
                </div>
            </div>

            <div class="card p-0 overflow-hidden">
                <div class="bg-slate-800/50 px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <span class="text-[11px] text-slate-400 font-mono uppercase tracking-widest">Project Workspace Explorer</span>
                    <span class="text-[10px] text-slate-600 font-mono italic">${projectName}/</span>
                </div>
                <div id="project-files-tree" class="p-4 bg-slate-950/20 min-h-[300px]">
                    ${renderTree(projectNode.children)}
                </div>
            </div>
        </div>
    `;
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
        updateAiStatus(false);
    }
}

async function updateAiStatus(isLive) {
    const statusEl = document.getElementById('ai-full-status');
    const btn = document.getElementById('ai-status-refresh');
    if(!statusEl || !btn) return;
    
    if(isLive) { 
        statusEl.classList.add('animate-pulse');
        btn.innerText = '⌛';
    }

    const endpoint = isLive ? '/api/ai_status_live' : '/api/ai_status_cached';
    const data = await api(endpoint);

    if (data && !data.error) {
        const usedK = (data.used / 1000).toFixed(1);
        const modelStr = data.model ? ` [${data.model}]` : '';
        const timeStr = data.timestamp ? ` (${new Date(data.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})` : '';
        statusEl.innerText = `${usedK}k/1m(${data.percent}%)${modelStr}`;
        statusEl.title = "Last update: " + timeStr;
    }

    if(isLive) {
        statusEl.classList.remove('animate-pulse');
        btn.innerText = '🩺';
    }
}

async function downloadBackup() {
    const btn = document.getElementById('backup-btn');
    const token = localStorage.getItem(authKey);
    btn.innerText = '⌛...';
    try {
        const res = await fetch(`/api/system/backup?token=${token}`);
        if (res.ok) {
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = `letto_backup_${new Date().toISOString().split('T')[0]}.zip`;
            link.click();
            btn.innerText = '✅ OK';
        }
    } catch (e) { btn.innerText = '❌ Error'; }
    setTimeout(() => { btn.innerHTML = '<span>📦</span> <span class="hidden sm:inline">Backup</span>'; }, 3000);
}

function renderTree(nodes, indent = 0) {
    let html = '';
    if(!nodes) return html;
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
            const safePath = btoa(node.path);
            html += `<div class="py-2 flex items-center active:bg-white/5 rounded px-2" style="padding-left: ${pad}px" onclick="openFileSafe('${safePath}')">
                <span class="mr-2 ml-4">📄</span><span class="text-slate-300 text-[14px]">${node.name}</span>
            </div>`;
        }
    });
    return html;
}

function openFileSafe(encodedPath) {
    openFile(atob(encodedPath));
}

function toggleDir(el) {
    const children = el.nextElementSibling;
    const arrow = el.querySelector('.folder-arrow');
    children.classList.toggle('hidden');
    if (arrow) arrow.style.transform = children.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)';
}

function toggleAllDirs(exp, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.dir-children').forEach(c => c.classList.toggle('hidden', !exp));
    container.querySelectorAll('.folder-arrow').forEach(a => a.style.transform = exp ? 'rotate(90deg)' : 'rotate(0deg)');
}

async function openFile(path, page = 1) {
    const mainContent = document.getElementById('main-dashboard-content');
    const projectsContent = document.getElementById('projects-view-content');
    const gitContent = document.getElementById('git-view-content');
    const explorerContent = document.getElementById('explorer-view-content');
    const fileViewer = document.getElementById('file-viewer-content');

    [mainContent, projectsContent, gitContent, explorerContent].forEach(c => { if(c) c.classList.add('hidden'); });
    if(fileViewer) fileViewer.classList.remove('hidden');
    document.getElementById('viewer-filename').innerText = path.split('/').pop();
    
    document.getElementById('viewer-text').innerText = 'Loading...';
    
    const translateBtn = document.getElementById('translate-btn');
    if(translateBtn) { translateBtn.classList.add('hidden'); isTranslated = false; }

    const data = await api(`/api/files/read?path=${encodeURIComponent(path)}&page=${page}`);
    if (!data || data.error) { document.getElementById('viewer-text').innerText = data ? data.error : 'Error'; return; }
    
    originalContent = data.content;
    translatedContent = '';
    document.getElementById('viewer-text').innerText = originalContent;

    const ext = path.split('.').pop().toLowerCase();
    if ((ext === 'md' || ext === 'txt') && translateBtn) translateBtn.classList.remove('hidden');
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
            if (res && res.translated) translatedContent = res.translated;
            else { btn.innerText = 'Error'; return; }
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
            updateAiStatus(false);
            setInterval(updateTimer, 41);
            return;
        }
    }
    document.getElementById('boot-loader').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
};
