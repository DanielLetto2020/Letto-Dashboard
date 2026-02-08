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

async function updateStats() {
    // Если это вызов по таймеру (setInterval) и автообновление выключено — выходим
    // Но если это ручной вызов (например, нажатие кнопки 🔄), аргумента не будет, 
    // поэтому мы проверяем флаг. Кнопка теперь будет вызывать updateStats(true).
    const isManual = arguments[0] === true;
    if (!autoRefreshEnabled && !isManual) return;
    
    const data = await api('/api/status');
    if (!data) return;
    
    document.getElementById('stat-cpu').innerText = Math.round(data.cpu) + '%';
    document.getElementById('stat-ram').innerText = Math.round(data.ram) + '%';
    document.getElementById('stat-disk').innerText = Math.round(data.disk) + '%';
    document.getElementById('stat-uptime').innerText = data.uptime;
    
    const hbS = Math.floor(Date.now()/1000) - data.heartbeat_last;
    document.getElementById('hb-last-seen').innerText = hbS < 60 ? 'Now' : Math.floor(hbS/60) + 'm ago';
    
    if (data.files) document.getElementById('files-tree').innerHTML = renderTree(data.files);
    
    const agentsList = document.getElementById('agents-list');
    document.getElementById('stat-agents-count').innerText = data.agents.length;
    agentsList.innerHTML = '';
    data.agents.forEach(a => {
        const row = document.createElement('div');
        row.className = 'row-item py-2 flex justify-between items-center text-[9px] text-slate-300';
        row.innerHTML = `<span>${a.name}</span><span class="text-[7px] text-slate-600 font-mono italic">PID:${a.pid}</span>`;
        agentsList.appendChild(row);
    });

    // Commits & Branch
    const cl = document.getElementById('commits-list');
    const gitInfo = data.git || { branch: 'unknown', commits: [] };
    
    // Попробуем вставить ветку в заголовок
    const gitTitle = document.querySelector('#commits-list').previousElementSibling;
    gitTitle.innerHTML = `<span class="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Git History</span>
                          <span class="text-[7px] text-emerald-500/80 font-mono ml-2">[${gitInfo.branch}]</span>`;

    cl.innerHTML = '';
    gitInfo.commits.forEach(c => {
        const row = document.createElement('div');
        row.className = 'row-item py-2 flex flex-col text-left';
        row.innerHTML = `<span class="text-[9px] text-slate-200 truncate">${c.msg}</span><span class="text-[7px] text-slate-600 font-bold tracking-tighter uppercase">${c.date}</span>`;
        cl.appendChild(row);
    });

    if (document.activeElement !== document.getElementById('heartbeat-editor')) {
        document.getElementById('heartbeat-editor').value = data.heartbeat_raw;
    }
    
    lastUpdate = Date.now();
}

function renderTree(nodes, indent = 0) {
    let html = '';
    nodes.forEach(node => {
        const pad = indent * 16;
        if (node.is_dir) {
            html += `<div class="py-1">
                <div class="flex items-center active:bg-white/5 rounded px-1" style="padding-left: ${pad}px" onclick="toggleDir(this)">
                    <span class="mr-2 text-[8px] folder-arrow rotate-0 transition-transform">▶</span><span class="mr-2">📁</span>
                    <span class="text-emerald-400 font-bold uppercase tracking-tight">${node.name}</span>
                </div>
                <div class="dir-children hidden">${node.children ? renderTree(node.children, indent + 1) : ''}</div>
            </div>`;
        } else {
            html += `<div class="py-1 flex items-center active:bg-white/5 rounded px-1" style="padding-left: ${pad}px" onclick="openFile('${node.path.replace(/'/g, "\\'")}')">
                <span class="mr-2 ml-4">📄</span><span class="text-slate-300">${node.name}</span>
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

    const pager = document.getElementById('viewer-pagination');
    if (data.total_pages > 1) {
        pager.classList.remove('hidden');
        document.getElementById('page-info').innerText = `Page ${data.page} of ${data.total_pages}`;
        document.getElementById('page-prev').onclick = () => openFile(path, data.page - 1);
        document.getElementById('page-next').onclick = () => openFile(path, data.page + 1);
        document.getElementById('page-prev').disabled = data.page <= 1;
        document.getElementById('page-next').disabled = data.page >= data.total_pages;
    } else pager.classList.add('hidden');
}

function closeFileViewer() {
    document.getElementById('file-viewer-content').classList.add('hidden');
    document.getElementById('main-dashboard-content').classList.remove('hidden');
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
        timerEl.parentElement.style.opacity = '0.3';
        return;
    }
    timerEl.parentElement.style.opacity = '1';
    
    const rem = Math.max(0, UPDATE_MS - (Date.now() - lastUpdate));
    const seconds = Math.floor(rem / 1000);
    const ms = rem % 1000;
    timerEl.innerHTML = `${seconds}<span class="ms-text">.${ms.toString().padStart(3, '0')}</span>`;
}

function toggleAutoRefresh(enabled) {
    autoRefreshEnabled = enabled;
    if (enabled) {
        lastUpdate = Date.now();
        updateStats(); 
    }
}

async function handleLogin() {
    const t = document.getElementById('token-input').value;
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) });
    if (res.ok) { localStorage.setItem(authKey, t); location.reload(); }
}

function logout() { localStorage.removeItem(authKey); location.reload(); }

window.onload = async () => {
    const t = localStorage.getItem(authKey);
    if (t) {
        const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) });
        if (res.ok) {
            document.getElementById('boot-loader').classList.add('hidden');
            document.getElementById('dashboard-view').classList.remove('hidden');
            updateStats(true); // Принудительный первый запуск
            setInterval(updateStats, 1000); // Проверяем каждую секунду, но внутри logic автообновления
            setInterval(updateTimer, 41);
            return;
        }
    }
    document.getElementById('boot-loader').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
};
