/* =========================================================
   Expense & Budget Visualizer
   Features:
   - LocalStorage persistence
   - Add / Delete transactions (with date)
   - Live balance update
   - Sort by date, amount, category, name
   - Pie chart (Canvas 2D API)
   - Monthly summary table
   - Dark / Light mode toggle (persisted in localStorage)
   ========================================================= */

// ── Category colour palette ──────────────────────────────
const CATEGORY_COLORS = {
  Food:      '#0a84c8',   // ocean blue
  Transport: '#27ae8f',   // teal green
  Fun:       '#f5c518',   // golden yellow
};

// ── Storage keys ─────────────────────────────────────────
const STORAGE_KEY   = 'expense_tracker_transactions';
const THEME_KEY     = 'expense_tracker_theme';

// ── State ────────────────────────────────────────────────
function loadTransactions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveTransactions(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

let transactions = loadTransactions();

// ── DOM refs ─────────────────────────────────────────────
const form            = document.getElementById('transaction-form');
const inputName       = document.getElementById('item-name');
const inputAmount     = document.getElementById('item-amount');
const inputCategory   = document.getElementById('item-category');
const totalBalanceEl  = document.getElementById('total-balance');
const listEl          = document.getElementById('transaction-list');
const emptyMsg        = document.getElementById('empty-msg');
const canvas          = document.getElementById('pie-chart');
const legendEl        = document.getElementById('chart-legend');
const ctx             = canvas.getContext('2d');
const sortSelect      = document.getElementById('sort-select');
const summaryBody     = document.getElementById('summary-body');
const summaryEmpty    = document.getElementById('summary-empty');
const themeToggle     = document.getElementById('theme-toggle');
const themeIcon       = document.getElementById('theme-icon');
const themeLabel      = document.getElementById('theme-label');
const htmlEl          = document.documentElement;

// ── Helpers ──────────────────────────────────────────────
function formatMoney(val) {
  return 'Rp ' + Math.abs(val).toLocaleString('id-ID');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Format "2025-07" → "July 2025" */
function formatMonthKey(key) {
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Sort ─────────────────────────────────────────────────
function getSorted(list) {
  const mode = sortSelect.value;
  const copy = [...list];
  switch (mode) {
    case 'date-desc':
      return copy.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    case 'date-asc':
      return copy.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount);
    case 'category-asc':
      return copy.sort((a, b) => a.category.localeCompare(b.category));
    case 'name-asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy;
  }
}

// ── Render ───────────────────────────────────────────────
function render() {
  renderBalance();
  renderList();
  renderChart();
  renderMonthlySummary();
}

// Balance
function renderBalance() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  totalBalanceEl.textContent = 'Rp ' + total.toLocaleString('id-ID');
  totalBalanceEl.style.color = total < 0
    ? 'var(--danger)'
    : 'var(--accent)';
}

// Transaction list
function renderList() {
  listEl.innerHTML = '';

  if (transactions.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  getSorted(transactions).forEach(t => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.dataset.id = t.id;

    li.innerHTML = `
      <div class="transaction-info">
        <span class="transaction-name">${escapeHtml(t.name)}</span>
        <span class="transaction-amount">${formatMoney(t.amount)}</span>
        <span class="transaction-category">${escapeHtml(t.category)}</span>
      </div>
      <button class="btn-delete" aria-label="Delete ${escapeHtml(t.name)}">Delete</button>
    `;

    li.querySelector('.btn-delete').addEventListener('click', () => {
      deleteTransaction(t.id);
    });

    listEl.appendChild(li);
  });
}

// Pie chart
function renderChart() {
  const totals = {};
  transactions.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
  });

  const categories = Object.keys(totals);
  const values     = categories.map(c => totals[c]);
  const grand      = values.reduce((a, b) => a + b, 0);

  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);

  if (grand === 0) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = isDark() ? '#2a2d36' : '#e0e0e0';
    ctx.fill();
    legendEl.innerHTML = '';
    return;
  }

  let startAngle = -Math.PI / 2;
  const cx = size / 2, cy = size / 2, radius = size / 2 - 4;

  categories.forEach((cat, i) => {
    const sliceAngle = (values[i] / grand) * (Math.PI * 2);
    const color = CATEGORY_COLORS[cat] || '#95a5a6';

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isDark() ? '#1c1f26' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle += sliceAngle;
  });

  // Legend
  legendEl.innerHTML = '';
  categories.forEach(cat => {
    const color = CATEGORY_COLORS[cat] || '#95a5a6';
    const li = document.createElement('li');
    li.className = 'legend-item';
    li.innerHTML = `
      <span class="legend-swatch" style="background:${color};"></span>
      <span>${escapeHtml(cat)}</span>
    `;
    legendEl.appendChild(li);
  });
}

// Monthly summary
function renderMonthlySummary() {
  summaryBody.innerHTML = '';

  if (transactions.length === 0) {
    summaryEmpty.style.display = 'block';
    return;
  }
  summaryEmpty.style.display = 'none';

  // Group by month key "YYYY-MM"
  const months = {};
  transactions.forEach(t => {
    const key = (t.date || todayISO()).slice(0, 7); // "YYYY-MM"
    if (!months[key]) months[key] = [];
    months[key].push(t);
  });

  // Sort months newest first
  const sortedKeys = Object.keys(months).sort((a, b) => b.localeCompare(a));

  sortedKeys.forEach(key => {
    const group = months[key];
    const total = group.reduce((s, t) => s + Math.abs(t.amount), 0);

    // Find top category
    const catTotals = {};
    group.forEach(t => {
      catTotals[t.category] = (catTotals[t.category] || 0) + Math.abs(t.amount);
    });
    const topCat = Object.keys(catTotals).reduce((a, b) =>
      catTotals[a] >= catTotals[b] ? a : b
    );

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="summary-month">${escapeHtml(formatMonthKey(key))}</td>
      <td>${group.length}</td>
      <td class="summary-amount">${formatMoney(total)}</td>
      <td><span class="summary-badge">${escapeHtml(topCat)}</span></td>
    `;
    summaryBody.appendChild(tr);
  });
}

// ── Actions ──────────────────────────────────────────────
function addTransaction(name, amount, category) {
  transactions.push({
    id: generateId(),
    name,
    amount,
    category,
    date: todayISO(),
  });
  saveTransactions(transactions);
  render();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions(transactions);
  render();
}

// ── Form submit ──────────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();

  const name   = inputName.value.trim();
  const amount = parseFloat(inputAmount.value.replace(/[,.]/g, ''));
  const cat    = inputCategory.value;

  if (!name)      { inputName.focus();   return; }
  if (isNaN(amount)) { inputAmount.focus(); return; }

  addTransaction(name, amount, cat);
  inputName.value   = '';
  inputAmount.value = '';
  inputCategory.selectedIndex = 0;
  inputName.focus();
});

// ── Sort change ──────────────────────────────────────────
sortSelect.addEventListener('change', () => renderList());

// ── Dark / Light mode ────────────────────────────────────
function isDark() {
  return htmlEl.getAttribute('data-theme') === 'dark';
}

function applyTheme(theme) {
  htmlEl.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  if (theme === 'dark') {
    themeIcon.textContent  = '☀️';
    themeLabel.textContent = 'Light Mode';
  } else {
    themeIcon.textContent  = '🌙';
    themeLabel.textContent = 'Dark Mode';
  }
  // Re-render chart so stroke colour updates
  renderChart();
}

themeToggle.addEventListener('click', () => {
  applyTheme(isDark() ? 'light' : 'dark');
});

// ── Init ─────────────────────────────────────────────────
(function init() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme);
  render();
})();
