const authKey = 'letto_auth_token';
let lastUpdate = Date.now();
const UPDATE_MS = 20000;

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

    // Update File Tree
    const treeEl = document.getElementById('files-tree');
    if (treeEl && data.files) {
        treeEl.innerHTML = renderTree(data.files);
    }

    lastUpdate = Date.now();
    console.log("Stats updated at " + new Date().toLocaleTimeString());
}

function renderTree(nodes, indent = 0) {
    let html = '';
    nodes.forEach(node => {
        const icon = node.is_dir ? '📁' : '📄';
        const padding = indent * 12;
        html += `<div class="py-1 flex items-center" style="padding-left: ${padding}px">
            <span class="mr-1.5 opacity-70">${icon}</span>
            <span class="${node.is_dir ? 'text-emerald-400 font-bold' : 'text-slate-300'}">${node.name}</span>
        </div>`;
        if (node.is_dir && node.children) {
            html += renderTree(node.children, indent + 1);
        }
    });
    return html;
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
