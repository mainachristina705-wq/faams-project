// FAAMS frontend logic.
// This file handles login, navigation, and talking to the backend API.

const API = 'http://localhost:5000/api';

let state = {
  token: localStorage_replacement_get('faams_token'),
  user: JSON.parse(localStorage_replacement_get('faams_user') || 'null'),
};

// NOTE: this app avoids the browser's localStorage/sessionStorage APIs
// (they don't persist reliably in every environment). Instead we keep
// the session only in memory for the current page load. Simple in-memory stand-in:
function localStorage_replacement_get() { return null; }

const VOTE_HEADS_CACHE = { loaded: false, items: [] };
const DEPARTMENTS_CACHE = { loaded: false, items: [] };

// ---------- helpers ----------
function showToast(message, isError) {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.classList.toggle('error', !!isError);
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3200);
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  headers['Content-Type'] = 'application/json';
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

function fmtMoney(n) {
  return 'KES ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function pillLabel(status) {
  return status.replace(/_/g, ' ');
}

// Assigns a consistent, lively color chip to each vote head name,
// so the fund request table is easier to scan at a glance.
const CHIP_CLASSES = ['chip-a', 'chip-b', 'chip-c', 'chip-d', 'chip-e', 'chip-f'];
function chipClass(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CHIP_CLASSES[hash % CHIP_CLASSES.length];
}

// ---------- department loading (for registration form) ----------
async function loadDepartmentsForRegister() {
  const select = document.getElementById('reg-department');
  try {
    const data = await api('/public/departments');
    data.departments.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.department_id;
      opt.textContent = d.name;
      select.appendChild(opt);
    });
  } catch (e) {
    // silently ignore — departments are optional for non-MDA roles
  }
}

document.getElementById('reg-role').addEventListener('change', (e) => {
  const wrap = document.getElementById('reg-dept-wrap');
  wrap.style.display = e.target.value === 'mda_officer' ? 'block' : 'none';
});
document.getElementById('reg-dept-wrap').style.display = 'none';

// ---------- login / register screen switching ----------
document.getElementById('show-register').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  loadDepartmentsForRegister();
});
document.getElementById('show-login').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
});

// ---------- login ----------
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    state.token = data.token;
    state.user = data.user;
    enterApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------- register ----------
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const full_name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  const department_id = document.getElementById('reg-department').value || null;
  const errorEl = document.getElementById('register-error');
  errorEl.textContent = '';
  try {
    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ full_name, email, password, role, department_id }),
    });
    showToast('Account created. You can now sign in.');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('login-email').value = email;
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------- logout ----------
document.getElementById('logout-btn').addEventListener('click', () => {
  state.token = null;
  state.user = null;
  document.body.className = ''; // remove the role accent theme
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-form').reset();
});

// ---------- role display names ----------
const ROLE_LABELS = {
  mda_officer: 'MDA officer',
  treasury_accountant: 'Treasury accountant',
  director_of_budget: 'Director of budget',
  admin: 'System administrator',
};

// ---------- app entry ----------
function enterApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('user-role-badge').textContent = ROLE_LABELS[state.user.role] || state.user.role;
  document.getElementById('user-name').textContent = state.user.full_name;
  document.body.className = 'role-' + state.user.role; // applies this role's accent theme
  buildSidebar();
}

// ---------- sidebar per role ----------
const NAV_BY_ROLE = {
  mda_officer: [
    { id: 'submit', label: 'Submit request' },
    { id: 'my-requests', label: 'My requests' },
  ],
  treasury_accountant: [
    { id: 'accountant-queue', label: 'Requests to review' },
    { id: 'reports', label: 'Reports' },
  ],
  director_of_budget: [
    { id: 'director-queue', label: 'Requests to decide' },
    { id: 'reports', label: 'Reports' },
  ],
  admin: [
    { id: 'reports', label: 'Reports' },
  ],
};

function buildSidebar() {
  const nav = NAV_BY_ROLE[state.user.role] || [];
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';
  nav.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.textContent = item.label;
    btn.dataset.view = item.id;
    if (i === 0) btn.classList.add('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderView(item.id);
    });
    sidebar.appendChild(btn);
  });
  if (nav.length) renderView(nav[0].id);
}

// ---------- view router ----------
function renderView(view) {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty-state">Loading&hellip;</div>';
  const renderers = {
    'submit': renderSubmitRequest,
    'my-requests': renderMyRequests,
    'accountant-queue': renderAccountantQueue,
    'director-queue': renderDirectorQueue,
    'reports': renderReports,
  };
  (renderers[view] || (() => {}))();
}

// ---------- MDA Officer: submit request ----------
async function loadVoteHeads() {
  if (VOTE_HEADS_CACHE.loaded) return VOTE_HEADS_CACHE.items;
  const data = await api('/public/vote-heads');
  VOTE_HEADS_CACHE.items = data.vote_heads;
  VOTE_HEADS_CACHE.loaded = true;
  return data.vote_heads;
}

async function renderSubmitRequest() {
  const content = document.getElementById('content');
  const voteHeads = await loadVoteHeads().catch(() => []);
  content.innerHTML = `
    <h2>Submit a fund request</h2>
    <p class="subhead">Enter the details of the project or activity you need funds for.</p>
    <form id="request-form" class="form-card">
      <label>Vote head
        <select id="req-vote-head" required>
          <option value="">Select a vote head</option>
          ${voteHeads.map(v => `<option value="${v.vote_head_id}">${v.name} (${v.code})</option>`).join('')}
        </select>
      </label>
      <label>Amount requested (KES)
        <input type="number" id="req-amount" min="1" step="0.01" required placeholder="e.g. 150000" />
      </label>
      <label>Purpose
        <textarea id="req-purpose" required placeholder="Describe what this request is for"></textarea>
      </label>
      <p class="error-text" id="request-error"></p>
      <button type="submit" class="btn-primary" style="width:auto;padding:10px 20px;">Submit request</button>
    </form>
  `;
  document.getElementById('request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('request-error');
    errorEl.textContent = '';
    try {
      await api('/requests', {
        method: 'POST',
        body: JSON.stringify({
          vote_head_id: document.getElementById('req-vote-head').value,
          amount: document.getElementById('req-amount').value,
          purpose: document.getElementById('req-purpose').value,
        }),
      });
      showToast('Request submitted.');
      renderView('my-requests');
      document.querySelectorAll('.sidebar button').forEach(b => b.classList.toggle('active', b.dataset.view === 'my-requests'));
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

async function renderMyRequests() {
  const content = document.getElementById('content');
  try {
    const data = await api('/requests/my-requests');
    content.innerHTML = `
      <h2>My requests</h2>
      <p class="subhead">Track the status of everything you've submitted.</p>
      ${requestsTable(data.requests, false)}
    `;
  } catch (err) {
    content.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function requestsTable(requests, showSubmitter) {
  if (!requests.length) {
    return '<div class="empty-state">No requests yet.</div>';
  }
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Date</th>
          ${showSubmitter ? '<th>Department</th><th>Submitted by</th>' : ''}
          <th>Vote head</th>
          <th>Amount</th>
          <th>Purpose</th>
          <th>Status</th>
        </tr></thead>
        <tbody>
          ${requests.map(r => `
            <tr>
              <td>${fmtDate(r.created_at)}</td>
              ${showSubmitter ? `<td>${r.department_name}</td><td>${r.submitted_by_name}</td>` : ''}
              <td><span class="vh-chip ${chipClass(r.vote_head_name)}">${r.vote_head_name}</span></td>
              <td class="amount">${fmtMoney(r.amount)}</td>
              <td>${r.purpose}${r.is_flagged_duplicate ? '<span class="dup-flag">Possible duplicate</span>' : ''}</td>
              <td><span class="pill ${r.status}">${pillLabel(r.status)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ---------- Treasury Accountant queue ----------
async function renderAccountantQueue() {
  const content = document.getElementById('content');
  try {
    const data = await api('/approvals/accountant-queue');
    content.innerHTML = `
      <h2>Requests awaiting your review</h2>
      <p class="subhead">Verify against the budget ceiling, then forward, reject, or send back for revision.</p>
      ${reviewTable(data.requests, 'accountant')}
    `;
    attachReviewHandlers('accountant');
  } catch (err) {
    content.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

// ---------- Director of Budget queue ----------
async function renderDirectorQueue() {
  const content = document.getElementById('content');
  try {
    const data = await api('/approvals/director-queue');
    content.innerHTML = `
      <h2>Requests awaiting your decision</h2>
      <p class="subhead">These have been reviewed and forwarded by a treasury accountant.</p>
      ${reviewTable(data.requests, 'director')}
    `;
    attachReviewHandlers('director');
  } catch (err) {
    content.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function reviewTable(requests, stage) {
  if (!requests.length) {
    return '<div class="empty-state">Nothing waiting for review right now.</div>';
  }
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Date</th><th>Department</th><th>Submitted by</th><th>Vote head</th>
          <th>Amount</th><th>Purpose</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${requests.map(r => `
            <tr>
              <td>${fmtDate(r.created_at)}</td>
              <td>${r.department_name}</td>
              <td>${r.submitted_by_name}</td>
              <td><span class="vh-chip ${chipClass(r.vote_head_name)}">${r.vote_head_name}</span></td>
              <td class="amount">${fmtMoney(r.amount)}</td>
              <td>${r.purpose}${r.is_flagged_duplicate ? '<span class="dup-flag">Possible duplicate</span>' : ''}</td>
              <td>
                <div class="action-btns" data-id="${r.request_id}">
                  ${stage === 'accountant' ? `
                    <button class="btn-sm approve" data-action="forward">Forward</button>
                    <button class="btn-sm reject" data-action="rejected">Reject</button>
                    <button class="btn-sm revise" data-action="sent_back">Send back</button>
                  ` : `
                    <button class="btn-sm approve" data-action="approved">Approve</button>
                    <button class="btn-sm reject" data-action="rejected">Reject</button>
                    <button class="btn-sm revise" data-action="sent_back">Send back</button>
                  `}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function attachReviewHandlers(stage) {
  document.querySelectorAll('.action-btns button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const wrap = btn.closest('.action-btns');
      const id = wrap.dataset.id;
      const decision = btn.dataset.action;
      let comment = '';
      if (decision === 'rejected' || decision === 'sent_back') {
        comment = prompt('Add a short comment explaining this decision (visible in the audit trail):') || '';
      }
      const endpoint = stage === 'accountant' ? `/approvals/${id}/accountant-review` : `/approvals/${id}/director-review`;
      try {
        await api(endpoint, { method: 'POST', body: JSON.stringify({ decision, comment }) });
        showToast('Decision recorded.');
        stage === 'accountant' ? renderAccountantQueue() : renderDirectorQueue();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

// ---------- Reports ----------
async function renderReports() {
  const content = document.getElementById('content');
  try {
    const data = await api('/reports/summary');
    const totalApproved = data.status_breakdown.find(s => s.status === 'approved');
    const totalPending = data.status_breakdown.find(s => s.status === 'pending');
    const totalRejected = data.status_breakdown.find(s => s.status === 'rejected');
    content.innerHTML = `
      <h2>Reports &amp; budget overview</h2>
      <p class="subhead">Fiscal year 2025/2026</p>
      <div class="stat-row">
        <div class="stat-card"><div class="label">Approved requests</div><div class="value">${totalApproved ? totalApproved.count : 0}</div></div>
        <div class="stat-card"><div class="label">Pending review</div><div class="value">${totalPending ? totalPending.count : 0}</div></div>
        <div class="stat-card"><div class="label">Rejected</div><div class="value">${totalRejected ? totalRejected.count : 0}</div></div>
        <div class="stat-card"><div class="label">Flagged as duplicate</div><div class="value">${data.flagged_duplicate_count}</div></div>
      </div>
      <h3 style="font-size:15px;margin-bottom:10px;">Budget by department</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Department</th><th>Total ceiling</th><th>Used</th><th>Remaining</th></tr></thead>
          <tbody>
            ${data.budget_by_department.map(d => `
              <tr>
                <td>${d.department_name}</td>
                <td class="amount">${fmtMoney(d.total_ceiling)}</td>
                <td class="amount">${fmtMoney(d.amount_used)}</td>
                <td class="amount">${fmtMoney(d.remaining)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

// ---------- boot ----------
// (No auto-login — since we don't persist sessions across page reloads,
// every visit starts at the login screen. This is intentional for this build.)
