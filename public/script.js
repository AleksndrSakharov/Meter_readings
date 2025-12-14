const state = {
    user: null,
    schema: null
};

const ui = {
    authPanel: document.getElementById('auth-panel'),
    appPanel: document.getElementById('app-panel'),
    usernameInput: document.getElementById('username-input'),
    userLabel: document.getElementById('user-label'),
    form: document.getElementById('dynamic-form'),
    history: document.getElementById('history'),
    loginBtn: document.getElementById('login-btn'),
    historyBtn: document.getElementById('show-history'),
    backBtn: document.getElementById('back-btn'),
    submitBtn: document.getElementById('submit-form'),
    resetBtn: document.getElementById('reset-form')
};

ui.loginBtn.addEventListener('click', handleLogin);
ui.historyBtn.addEventListener('click', handleHistoryToggle);
ui.submitBtn.addEventListener('click', handleSubmit);
ui.resetBtn.addEventListener('click', () => {
    ui.form.reset();
    const apt = ui.form.querySelector('input[name="квартира"]');
    if (apt && state.user) apt.value = state.user;
});
ui.backBtn.addEventListener('click', handleBack);

function handleHistoryToggle() {
    if (ui.history.classList.contains('hidden')) {
        fetchHistory();
    } else {
        ui.history.classList.add('hidden');
    }
}

function handleBack() {
    state.user = null;
    ui.userLabel.textContent = '';
    ui.form.innerHTML = '';
    ui.history.classList.add('hidden');
    ui.history.innerHTML = '';
    ui.appPanel.classList.add('hidden');
    ui.authPanel.classList.remove('hidden');
    ui.usernameInput.focus();
}

async function handleLogin() {
    const username = ui.usernameInput.value.trim();
    if (!username) {
        alert('Введите номер квартиры/логин');
        return;
    }

    state.user = username;
    ui.userLabel.textContent = `Вы вошли как: ${username}`;
    ui.authPanel.classList.add('hidden');
    ui.appPanel.classList.remove('hidden');

    await loadSchemaAndRender();
}

async function loadSchemaAndRender() {
    try {
        const res = await fetch('/api/schema');
        if (!res.ok) throw new Error('Не удалось загрузить схему');
        state.schema = await res.json();
        renderForm(state.schema);
    } catch (err) {
        alert(err.message || 'Ошибка загрузки схемы');
    }
}

function renderForm(schema) {
    ui.form.innerHTML = '';
    if (!schema) return;
    ui.form.appendChild(buildNode(schema, []));

    const apt = ui.form.querySelector('input[name="квартира"]');
    if (apt && state.user) {
        apt.value = state.user;
        apt.readOnly = true;
    }
}

function buildNode(node, pathParts) {
    const wrap = document.createElement('fieldset');

    if (node.name) {
        const legend = document.createElement('legend');
        legend.textContent = node.name;
        wrap.appendChild(legend);
    }

    for (const key of Object.keys(node)) {
        if (key === 'name') continue;
        const value = node[key];

        if (key === 'resources' && Array.isArray(value)) {
            value.forEach((resource, index) => {
                wrap.appendChild(buildNode(resource, [...pathParts, 'resources', String(index)]));
            });
            continue;
        }

        if (typeof value === 'string' && (value === 'string' || value === 'number')) {
            const row = document.createElement('div');
            row.className = 'form-row';

            const label = document.createElement('label');
            label.textContent = `${key}:`;

            const input = document.createElement('input');
            input.type = value === 'number' ? 'number' : 'text';
            input.name = key;
            input.dataset.path = [...pathParts, key].join('|');
            input.dataset.type = value;

            row.appendChild(label);
            row.appendChild(input);
            wrap.appendChild(row);
        }
    }

    return wrap;
}

function assignByPath(target, pathString, rawValue, type) {
    const parts = pathString.split('|');
    let current = target;

    for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        const isLast = i === parts.length - 1;

        if (part === 'resources') {
            const index = Number(parts[i + 1]);
            if (!Array.isArray(current.resources)) current.resources = [];
            if (!current.resources[index]) current.resources[index] = {};
            current = current.resources[index];
            i += 1;
            continue;
        }

        if (isLast) {
            let value = rawValue;
            if (type === 'number') value = rawValue === '' ? null : Number(rawValue);
            current[part] = value;
        } else {
            if (!current[part]) current[part] = {};
            current = current[part];
        }
    }
}

async function handleSubmit() {
    if (!state.user) return alert('Сначала авторизуйтесь');

    const inputs = ui.form.querySelectorAll('input[data-path]');
    const payload = {};

    inputs.forEach(input => {
        assignByPath(payload, input.dataset.path, input.value, input.dataset.type);
    });

    try {
        const res = await fetch('/api/records', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-username': state.user
            },
            body: JSON.stringify(payload)
        });

        const body = await res.json();
        if (!res.ok) throw new Error(body.message || 'Ошибка сохранения');

        alert(body.message || 'Показания сохранены');
        ui.form.reset();
        const apt = ui.form.querySelector('input[name="квартира"]');
        if (apt) apt.value = state.user;
        await fetchHistory();
    } catch (err) {
        alert(err.message || 'Ошибка');
    }
}

async function fetchHistory() {
    if (!state.user) return;
    try {
        const res = await fetch('/api/records', { headers: { 'x-username': state.user } });
        if (!res.ok) throw new Error('Не удалось загрузить историю');
        const records = await res.json();
        renderHistory(records);
        ui.history.classList.remove('hidden');
    } catch (err) {
        alert(err.message || 'Ошибка загрузки истории');
    }
}

function renderHistory(records) {
    ui.history.innerHTML = '';
    if (!records || records.length === 0) {
        ui.history.innerHTML = '<p class="hint">Записей пока нет.</p>';
        return;
    }

    records.slice().reverse().forEach(entry => {
        const card = document.createElement('div');
        card.className = 'history-card';

        const header = document.createElement('header');
        const title = document.createElement('strong');
        title.textContent = entry.name || 'Отправка';
        const date = document.createElement('span');
        date.className = 'date';
        date.textContent = entry.meta?.capturedAt ? new Date(entry.meta.capturedAt).toLocaleString() : 'Без времени';
        header.appendChild(title);
        header.appendChild(date);

        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(entry, null, 2);

        card.appendChild(header);
        card.appendChild(pre);
        ui.history.appendChild(card);
    });
}