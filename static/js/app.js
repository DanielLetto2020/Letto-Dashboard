const authKey = 'letto_auth_token';
let lastUpdate = Date.now();
const UPDATE_MS = 20000;
let currentFilePath = '';
let currentFilePage = 1;

async function api(path, method = 'GET', body = null) {
    const token = localStorage.getItem(authKey);
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify({ ...body, token });
    else if (token) path += (path.includes('?') ? '&' : '?') + 'token=' + token;
    const res = await fetch(path, options);
    if (res.status === 401 && path !== '/api/auth') logout();
    return res.json();
}

async function updateStats() {
    const data = await api('/api/status');
    if (!data) return;
    document.getElementById('stat-cpu').innerText = Math.round(data.cpu) + '%';
    document.getElementById('stat-ram').innerText = Math.round(data.ram) + '%';
    document.getElementById('stat-disk').innerText = Math.round(data.disk) + '%';
    document.getElementById('stat-uptime').innerText = data.uptime;
    
    const hbSeconds = Math.floor(Date.now()/1000) - data.heartbeat_last;
    document.getElementById('hb-last-seen').innerText = `Last: ${hbSeconds < 60 ? 'Now' : Math.floor(hbSeconds/60) + 'm ago'}`;

    const agentsList = document.getElementById('agents-list');
    document.getElementById('stat-agents-count').innerText = data.agents.length;
    agentsList.innerHTML = '';
    data.agents.forEach(agent => {
        const row = document.createElement('div');
        row.className = 'row-item py-2 flex justify-between items-center text-[9px] text-slate-200';
        row.innerHTML = `<span>${agent.name}</span><span class="text-[7px] text-slate-600">PID:${agent.pid}</span>`;
        agentsList.appendChild(row);
    });

    const commitsList = document.getElementById('commits-list');
    commitsList.innerHTML = '';
    data.commits.forEach(c => {
        const row = document.createElement('div');
        row.className = 'row-item py-2 flex flex-col text-left';
        row.innerHTML = `<span class="text-[9px] text-slate-200 truncate">${c.msg}</span><span class="text-[7px] text-slate-600 uppercase font-bold tracking-tighter">${c.date}</span>`;
        commitsList.appendChild(row);
    });

    if (document.activeElement !== document.getElementById('heartbeat-editor')) {
        document.getElementById('heartbeat-editor').value = data.heartbeat_raw;
    }

    if (data.files) {
        const treeEl = document.getElementById('files-tree');
        treeEl.innerHTML = renderTree(data.files);
    }

    lastUpdate = Date.now();
}

function renderTree(nodes, indent = 0) {
    let html = '';
    nodes.forEach(node => {
        const padding = indent * 16;
        if (node.is_dir) {
            html += `<div class="dir-item py-1.5" style="padding-left: ${padding}px">
                <div class="flex items-center active:bg-white/5 rounded px-1" onclick="toggleDir(this)">
                    <span class="mr-2 text-[8px] transform transition-transform folder-arrow">▶</span>
                    <span class="mr-2">📁</span>
                    <span class="text-emerald-400 font-bold uppercase tracking-tight">${node.name}</span>
                </div>
                <div class="dir-children hidden">
                    ${node.children ? renderTree(node.children, indent + 1) : ''}
                </div>
            </div>`;
        } else {
            html += `<div class="file-item py-1.5 flex items-center active:bg-white/5 rounded px-1" style="padding-left: ${padding}px" onclick="openFile('${node.path}')">
                <span class="mr-2 ml-4">📄</span>
                <span class="text-slate-300">${node.name}</span>
            </div>`;
        }
    });
    return html;
}

function toggleDir(el) {
    const parent = el.parentElement;
    const children = parent.querySelector('.dir-children');
    const arrow = el.querySelector('.folder-arrow');
    const isHidden = children.classList.contains('hidden');
    
    if (isHidden) {
        children.classList.remove('hidden');
        arrow.style.transform = 'rotate(90deg)';
    } else {
        children.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

function toggleAllDirs(expand) {
    document.querySelectorAll('.dir-children').forEach(el => {
        if (expand) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
    document.querySelectorAll('.folder-arrow').forEach(el => {
        el.style.transform = expand ? 'rotate(90deg)' : 'rotate(0deg)';
    });
}

async function openFile(path, page = 1) {
    currentFilePath = path;
    currentFilePage = page;
    
    document.getElementById('main-dashboard-content').classList.add('hidden');
    document.getElementById('file-viewer-content').classList.remove('hidden');
    document.getElementById('viewer-filename').innerText = path.split('/').pop();
    document.getElementById('viewer-text').innerText = 'Loading content...';
    
    const data = await api(`/api/files/read?path=${encodeURIComponent(path)}&page=${page}`);
    
    if (data.error) {
        document.getElementById('viewer-text').innerText = 'Error: ' + data.error;
        return;
    }
    
    document.getElementById('viewer-text').innerText = data.content;
    
    const pager = document.getElementById('viewer-pagination');
    if (data.total_pages > 1) {
        pager.classList.remove('hidden');
        document.getElementById('page-info').innerText = `Page ${data.page} of ${data.total_pages}`;
        
        const prev = document.getElementById('page-prev');
        const next = document.getElementById('page-next');
        
        prev.disabled = (data.page <= 1);
        next.disabled = (data.page >= data.total_pages);
        
        prev.onclick = () => openFile(path, data.page - 1);
        next.onclick = () => openFile(path, data.page + 1);
    } else {
        pager.classList.add('hidden');
    }
}

function closeFileViewer() {
    document.getElementById('file-viewer-content').classList.add('hidden');
    document.getElementById('main-dashboard-content').classList.remove('hidden');
}

async function saveHeartbeat() {
    const content = document.getElementById('heartbeat-editor').value;
    const res = await api('/api/heartbeat/update', 'POST', { content });
    if (res.success) {
        const btn = document.querySelector('button[onclick="saveHeartbeat()"]');
        btn.innerText = 'OK';
        setTimeout(() => btn.innerText = 'SAVE TASKS', 2000);
    }
}

function updateTimer() {
    const timerEl = document.getElementById('sync-timer');
    if(!timerEl) return;
    const remaining = Math.max(0, UPDATE_MS - (Date.now() - lastUpdate));
    const seconds = Math.floor(remaining / 1000);
    const ms = remaining % 1000;
    timerEl.innerHTML = `${seconds}<span class="ms-text">.${ms.toString().padStart(3, '0')}</span>`;
}

async function handleLogin() {
    const token = document.getElementById('token-input').value;
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    if (res.ok) { localStorage.setItem(authKey, token); location.reload(); }
}

function logout() { localStorage.removeItem(authKey); location.reload(); }

window.onload = async () => {
    const savedToken = localStorage.getItem(authKey);
    if (savedToken) {
        const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: savedToken }) });
        if (res.ok) {
            document.getElementById('boot-loader').classList.add('hidden');
            document.getElementById('dashboard-view').classList.remove('hidden');
            updateStats();
            setInterval(updateStats, UPDATE_MS);
            setInterval(updateTimer, 41);
            return;
        }
    }
    document.getElementById('boot-loader').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
};
