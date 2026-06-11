/* ── ERP Analytics Dashboard — dashboard.js ─────────────────────────────── */
'use strict';

// ── Config ───────────────────────────────────────────────────────────────────
const API_BASE     = '/erp';
const ANALYTICS_BASE = '/erp-analytics';

// Fallback demo data (used when API is unreachable, e.g., no auth token)
const DEMO = {
  orders: [
    { OrderID: 1, OrderDate: '2025-11-01', TotalAmount: 38500, CurrencyCode: 'EUR', StatusCode: 'FU', ClientName: 'TechNova Solutions',   ManagerFirstName: 'Sarah', ManagerLastName: 'Mitchell' },
    { OrderID: 2, OrderDate: '2025-12-05', TotalAmount: 26400, CurrencyCode: 'EUR', StatusCode: 'FU', ClientName: 'GlobalRetail Group',    ManagerFirstName: 'Sarah', ManagerLastName: 'Mitchell' },
    { OrderID: 3, OrderDate: '2026-01-10', TotalAmount: 18000, CurrencyCode: 'EUR', StatusCode: 'AP', ClientName: 'Apex Logistics Ltd',    ManagerFirstName: 'Tom',   ManagerLastName: 'Reynolds' },
    { OrderID: 4, OrderDate: '2026-02-14', TotalAmount: 11000, CurrencyCode: 'EUR', StatusCode: 'SU', ClientName: 'Nordic Systems AB',     ManagerFirstName: 'Tom',   ManagerLastName: 'Reynolds' },
    { OrderID: 5, OrderDate: '2026-03-20', TotalAmount: 17000, CurrencyCode: 'EUR', StatusCode: 'AP', ClientName: 'BrightMed Healthcare',  ManagerFirstName: 'Sarah', ManagerLastName: 'Mitchell' },
    { OrderID: 6, OrderDate: '2026-04-01', TotalAmount:  9600, CurrencyCode: 'EUR', StatusCode: 'SU', ClientName: 'Orion Manufacturing',   ManagerFirstName: 'Tom',   ManagerLastName: 'Reynolds' },
    { OrderID: 7, OrderDate: '2026-05-15', TotalAmount: 12500, CurrencyCode: 'EUR', StatusCode: 'DR', ClientName: 'TechNova Solutions',    ManagerFirstName: 'Tom',   ManagerLastName: 'Reynolds' },
    { OrderID: 8, OrderDate: '2026-05-28', TotalAmount: 24000, CurrencyCode: 'EUR', StatusCode: 'DR', ClientName: 'GlobalRetail Group',    ManagerFirstName: 'Tom',   ManagerLastName: 'Reynolds' },
  ],
  invoices: [
    { InvoiceID: 1, IssueDate: '2025-11-30', DueDate: '2025-12-30', TotalAmount: 38500, PaidAmount: 38500, CurrencyCode: 'EUR', InvoiceStatus_code: 'PAID', ClientName: 'TechNova Solutions' },
    { InvoiceID: 2, IssueDate: '2026-01-15', DueDate: '2026-02-15', TotalAmount: 26400, PaidAmount: 13200, CurrencyCode: 'EUR', InvoiceStatus_code: 'PART', ClientName: 'GlobalRetail Group' },
    { InvoiceID: 3, IssueDate: '2026-02-10', DueDate: '2026-03-12', TotalAmount: 17000, PaidAmount:     0, CurrencyCode: 'EUR', InvoiceStatus_code: 'OVER', ClientName: 'BrightMed Healthcare' },
  ],
  clients: [
    { ClientID: 1, CompanyName: 'TechNova Solutions',  City: 'Menlo Park', CountryCode: 'US', CreditLimit: 150000, CurrencyCode: 'EUR' },
    { ClientID: 2, CompanyName: 'GlobalRetail Group',  City: 'Munich',     CountryCode: 'DE', CreditLimit: 250000, CurrencyCode: 'EUR' },
    { ClientID: 3, CompanyName: 'Apex Logistics Ltd',  City: 'Singapore',  CountryCode: 'SG', CreditLimit: 100000, CurrencyCode: 'EUR' },
    { ClientID: 4, CompanyName: 'Nordic Systems AB',   City: 'Stockholm',  CountryCode: 'SE', CreditLimit:  80000, CurrencyCode: 'EUR' },
    { ClientID: 5, CompanyName: 'BrightMed Healthcare',City: 'Dubai',      CountryCode: 'AE', CreditLimit: 200000, CurrencyCode: 'EUR' },
    { ClientID: 6, CompanyName: 'Orion Manufacturing', City: 'Milan',      CountryCode: 'IT', CreditLimit: 120000, CurrencyCode: 'EUR' },
  ],
};

// ── Utilities ────────────────────────────────────────────────────────────────
const fmt = {
  currency: (v, code = 'EUR') =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(v),
  date: (s) => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  pct:  (part, total) => total ? Math.round((part / total) * 100) : 0,
};

const flag = (code) => {
  const flags = { US:'🇺🇸', DE:'🇩🇪', SG:'🇸🇬', SE:'🇸🇪', AE:'🇦🇪', IT:'🇮🇹', GB:'🇬🇧', FR:'🇫🇷' };
  return flags[code] || '🌍';
};

const statusLabel = {
  DR: 'Draft', SU: 'Submitted', AP: 'Approved', RE: 'Rejected',
  FU: 'Fulfilled', CA: 'Canceled',
  UNPA: 'Unpaid', PART: 'Partial', PAID: 'Paid', OVER: 'Overdue', CANC: 'Canceled',
  PEND: 'Pending', APPR: 'Approved', REJC: 'Rejected',
};

function badgeHTML(code) {
  const cssClass = code ? code.toLowerCase() : 'dr';
  return `<span class="badge ${cssClass}">${statusLabel[code] || code}</span>`;
}

// ── Live Clock ───────────────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('live-clock');
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZoneName: 'short'
    });
  };
  tick();
  setInterval(tick, 1000);
}

// ── Counter Animation ─────────────────────────────────────────────────────────
function animateCount(el, target, isCurrency = false, duration = 900) {
  const start = performance.now();
  const update = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const val = Math.round(target * ease);
    el.textContent = isCurrency ? fmt.currency(val) : val.toLocaleString();
    if (p < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── Chart.js defaults ────────────────────────────────────────────────────────
Chart.defaults.color = '#8ba3c7';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;

const CHART_COLORS = {
  blue:   '#3b82f6', cyan:   '#06b6d4', green:  '#10b981',
  amber:  '#f59e0b', red:    '#ef4444', purple: '#8b5cf6',
};

// ── Revenue Bar Chart ─────────────────────────────────────────────────────────
function buildRevenueChart(invoices) {
  // Aggregate by month
  const monthly = {};
  invoices.forEach(inv => {
    if (!inv.IssueDate) return;
    const d = new Date(inv.IssueDate);
    const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    monthly[key] = (monthly[key] || 0) + (inv.TotalAmount || 0);
  });

  // Pad with demo months if too few
  if (Object.keys(monthly).length < 2) {
    const demoMonths = ['Nov 25','Dec 25','Jan 26','Feb 26','Mar 26','Apr 26'];
    const demoVals   = [38500,  26400,  17000,  0,       17000,  9600  ];
    demoMonths.forEach((m, i) => { monthly[m] = monthly[m] || demoVals[i]; });
  }

  const labels = Object.keys(monthly);
  const data   = Object.values(monthly);
  const total  = data.reduce((s, v) => s + v, 0);

  document.getElementById('revenue-total-badge').textContent = fmt.currency(total);

  const ctx = document.getElementById('revenueChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (EUR)',
        data,
        backgroundColor: data.map((_, i) =>
          i === data.length - 1
            ? 'rgba(59, 130, 246, 0.9)'
            : 'rgba(59, 130, 246, 0.35)'
        ),
        borderColor: 'rgba(59, 130, 246, 0.8)',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt.currency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { color: 'transparent' },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { color: 'transparent' },
          ticks: {
            callback: v => v >= 1000 ? `€${v/1000}k` : `€${v}`,
          },
        },
      },
    },
  });
}

// ── Donut Chart (Order Status) ─────────────────────────────────────────────────
function buildStatusChart(orders) {
  const counts = { DR: 0, SU: 0, AP: 0, FU: 0, RE: 0, CA: 0 };
  orders.forEach(o => { if (counts[o.StatusCode] !== undefined) counts[o.StatusCode]++; });

  const colors  = [CHART_COLORS.blue, CHART_COLORS.amber, CHART_COLORS.green, CHART_COLORS.purple, CHART_COLORS.red, CHART_COLORS.cyan];
  const labels  = Object.keys(counts).map(k => statusLabel[k]);
  const data    = Object.values(counts);

  const ctx = document.getElementById('statusChart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor:     colors,
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} orders`,
          },
        },
      },
    },
  });

  // Legend
  const legend = document.getElementById('donut-legend');
  legend.innerHTML = Object.keys(counts).map((k, i) => `
    <div class="legend-item">
      <div class="legend-left">
        <div class="legend-dot" style="background:${colors[i]}"></div>
        <span class="legend-label">${statusLabel[k]}</span>
      </div>
      <span class="legend-value">${counts[k]}</span>
    </div>
  `).join('');
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function renderKPIs(orders, invoices) {
  const totalRevenue = invoices.reduce((s, i) => s + (i.TotalAmount || 0), 0);
  const paidRevenue  = invoices.reduce((s, i) => s + (i.PaidAmount  || 0), 0);
  const totalOrders  = orders.length;
  const pendingApprovals = orders.filter(o => o.StatusCode === 'SU').length;
  const overdueInvoices  = invoices.filter(i => i.InvoiceStatus_code === 'OVER').length;

  animateCount(document.getElementById('kpi-revenue-value'), totalRevenue, true);
  document.getElementById('kpi-revenue-sub').textContent =
    `${fmt.currency(paidRevenue)} collected`;

  animateCount(document.getElementById('kpi-orders-value'), totalOrders);
  document.getElementById('kpi-orders-sub').textContent =
    `${orders.filter(o => o.StatusCode === 'FU').length} fulfilled`;

  animateCount(document.getElementById('kpi-pending-value'), pendingApprovals);
  animateCount(document.getElementById('kpi-overdue-value'), overdueInvoices);
}

// ── Clients Table ─────────────────────────────────────────────────────────────
function renderClients(clients) {
  document.getElementById('clients-count-badge').textContent = `${clients.length} clients`;
  const sorted = [...clients].sort((a, b) => b.CreditLimit - a.CreditLimit);
  const maxLimit = sorted[0]?.CreditLimit || 1;

  const tbody = document.getElementById('clients-tbody');
  tbody.innerHTML = sorted.map(c => `
    <tr>
      <td><div class="company-name">${c.CompanyName}</div></td>
      <td><span class="country-flag">${flag(c.CountryCode)}</span>${c.City || '—'}</td>
      <td><strong>${fmt.currency(c.CreditLimit, c.CurrencyCode)}</strong></td>
      <td style="min-width:100px">
        <div class="progress-bar">
          <div class="progress-fill" style="width:${fmt.pct(c.CreditLimit, maxLimit)}%"></div>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── Activity Feed (Recent Orders) ────────────────────────────────────────────
function renderActivity(orders) {
  document.getElementById('activity-count-badge').textContent = `${orders.length} orders`;

  const recent = [...orders]
    .sort((a, b) => new Date(b.OrderDate) - new Date(a.OrderDate))
    .slice(0, 6);

  const typeIcon = { DR: '📝', SU: '📤', AP: '✅', FU: '📦', RE: '❌', CA: '🚫' };

  const list = document.getElementById('activity-list');
  list.innerHTML = recent.map(o => `
    <div class="activity-item">
      <div class="activity-icon order">${typeIcon[o.StatusCode] || '📋'}</div>
      <div class="activity-content">
        <div class="activity-title">
          Order #${o.OrderID} — ${o.ClientName || '—'}
          &nbsp;${badgeHTML(o.StatusCode)}
        </div>
        <div class="activity-meta">
          ${fmt.currency(o.TotalAmount, o.CurrencyCode)} &middot; ${fmt.date(o.OrderDate)}
          ${o.ManagerFirstName ? `&middot; ${o.ManagerFirstName} ${o.ManagerLastName}` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// ── Invoices Table ───────────────────────────────────────────────────────────
function renderInvoices(invoices) {
  const tbody = document.getElementById('invoices-tbody');
  if (!invoices.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#4a6080;padding:20px">No invoices found</td></tr>';
    return;
  }
  tbody.innerHTML = invoices.map(inv => {
    const pct = fmt.pct(inv.PaidAmount || 0, inv.TotalAmount || 1);
    return `
      <tr>
        <td><strong>#${inv.InvoiceID}</strong></td>
        <td>${inv.ClientName || '—'}</td>
        <td>${fmt.date(inv.IssueDate)}</td>
        <td>${fmt.date(inv.DueDate)}</td>
        <td><strong>${fmt.currency(inv.TotalAmount, inv.CurrencyCode)}</strong></td>
        <td>
          ${fmt.currency(inv.PaidAmount || 0, inv.CurrencyCode)}
          <div class="progress-bar" style="margin-top:4px">
            <div class="progress-fill" style="width:${pct}%;background:${
              inv.InvoiceStatus_code === 'PAID' ? '#10b981' :
              inv.InvoiceStatus_code === 'OVER' ? '#ef4444' : '#3b82f6'
            }"></div>
          </div>
        </td>
        <td>${badgeHTML(inv.InvoiceStatus_code)}</td>
      </tr>
    `;
  }).join('');
}

// ── Data Fetching ────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const json = await res.json();
  return json.value || json;
}

async function loadData() {
  let orders   = DEMO.orders;
  let invoices = DEMO.invoices;
  let clients  = DEMO.clients;
  let usedDemo = false;

  try {
    const [ordersRes, invoicesRes, clientsRes] = await Promise.all([
      fetchJSON(`${ANALYTICS_BASE}/OrdersByStatus?$top=100`),
      fetchJSON(`${ANALYTICS_BASE}/RevenueByMonth?$top=100&$expand=*`),
      fetchJSON(`${ANALYTICS_BASE}/TopClients?$top=50`),
    ]);
    orders   = ordersRes;
    invoices = invoicesRes;
    clients  = clientsRes;
  } catch (err) {
    console.warn('API unavailable, using demo data:', err.message);
    usedDemo = true;
  }

  if (usedDemo) {
    document.getElementById('error-notice').style.display = 'block';
  }

  return { orders, invoices, clients };
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  startClock();

  const { orders, invoices, clients } = await loadData();

  renderKPIs(orders, invoices);
  buildRevenueChart(invoices);
  buildStatusChart(orders);
  renderClients(clients);
  renderActivity(orders);
  renderInvoices(invoices);
}

document.addEventListener('DOMContentLoaded', init);
