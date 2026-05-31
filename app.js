/**
 * AuraFinance // Core Application Controller (app.js)
 * Coordinates data state, UI routing, NLP parsing, Voice bindings, and charts.
 */

// Global Application State
let appState = {
  expenses: [],
  budget: 1000.00,
  currency: '$',
  theme: 'dark',
  cashBalance: 0.00,
  cashLog: [],
  recurringExpenses: []
};

// Available Category Icons map for list rendering
const CATEGORY_ICONS = {
  Food: 'utensils',
  Groceries: 'shopping-cart',
  Entertainment: 'tv',
  Transport: 'car',
  Utilities: 'droplet',
  Shopping: 'shopping-bag',
  Health: 'activity',
  Other: 'help-circle'
};

// Mock Sample Ledger Data
const DUMMY_DATA = [
  { id: "1", description: "Netflix Subscription", amount: 15.49, category: "Entertainment", date: "2026-05-28" },
  { id: "2", description: "Trader Joe's Groceries", amount: 84.20, category: "Groceries", date: "2026-05-29" },
  { id: "3", description: "Gasoline Fill Up", amount: 45.00, category: "Transport", date: "2026-05-30" },
  { id: "4", description: "Starbucks Coffee", amount: 6.75, category: "Food", date: "2026-05-31" },
  { id: "5", description: "Chipotle Lunch", amount: 14.50, category: "Food", date: "2026-05-31" },
  { id: "6", description: "Gym Membership", amount: 50.00, category: "Health", date: "2026-05-01" },
  { id: "7", description: "Comcast Internet Bill", amount: 79.99, category: "Utilities", date: "2026-05-15" },
  { id: "8", description: "Amazon Prime Keyboard", amount: 120.00, category: "Shopping", date: "2026-05-22" }
];

/* ==========================================================================
   State & Storage Handlers
   ========================================================================== */

function loadState() {
  const savedExpenses = localStorage.getItem('aura_expenses');
  const savedBudget = localStorage.getItem('aura_budget');
  const savedCurrency = localStorage.getItem('aura_currency');
  const savedTheme = localStorage.getItem('aura_theme');
  const savedCash = localStorage.getItem('aura_cash_balance');
  const savedCashLog = localStorage.getItem('aura_cash_log');
  const savedRecurring = localStorage.getItem('aura_recurring');

  if (savedExpenses) {
    appState.expenses = JSON.parse(savedExpenses);
  } else {
    appState.expenses = [...DUMMY_DATA];
    saveExpenses();
  }

  if (savedBudget) appState.budget = parseFloat(savedBudget);
  if (savedCurrency) appState.currency = savedCurrency;
  if (savedTheme) appState.theme = savedTheme;
  if (savedCash !== null) appState.cashBalance = parseFloat(savedCash);
  if (savedCashLog) appState.cashLog = JSON.parse(savedCashLog);
  if (savedRecurring) appState.recurringExpenses = JSON.parse(savedRecurring);

  const today = new Date();
  appState.targetMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  document.documentElement.setAttribute('data-theme', appState.theme);
  chartController.setCurrencySymbol(appState.currency);

  autoPostRecurringExpenses();
}

function saveExpenses() {
  localStorage.setItem('aura_expenses', JSON.stringify(appState.expenses));
}

function saveSettings() {
  localStorage.setItem('aura_budget', appState.budget.toString());
  localStorage.setItem('aura_currency', appState.currency);
}

function saveCashBalance() {
  localStorage.setItem('aura_cash_balance', appState.cashBalance.toString());
}

function saveCashLog() {
  localStorage.setItem('aura_cash_log', JSON.stringify(appState.cashLog));
}

function addCashLogEntry(type, amount, note) {
  // type: 'add' | 'payment' | 'reduce' | 'expense'
  const entry = {
    id: Date.now().toString(),
    type,
    amount,
    note: note || '',
    date: new Date().toISOString(),
    balanceAfter: appState.cashBalance
  };
  appState.cashLog.unshift(entry); // newest first
  saveCashLog();
}

function renderCashAuditLog() {
  const container = document.getElementById('cash-audit-log');
  if (!container) return;

  if (appState.cashLog.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 24px 0;">
        <i data-lucide="file-text"></i>
        <p>No cash movements logged yet. Add cash or log a payment to get started.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const typeConfig = {
    add:     { icon: 'plus-circle',      label: 'Cash Added',       color: 'text-emerald', sign: '+' },
    payment: { icon: 'arrow-down-circle', label: 'Payment Received', color: 'text-emerald', sign: '+' },
    reduce:  { icon: 'minus-circle',      label: 'Cash Removed',     color: 'text-rose',    sign: '-' },
    expense: { icon: 'shopping-bag',      label: 'Expense Deducted', color: 'text-rose',    sign: '-' }
  };

  container.innerHTML = appState.cashLog.map(entry => {
    const cfg = typeConfig[entry.type] || typeConfig.expense;
    const dateObj = new Date(entry.date);
    const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeLabel = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="cash-log-item">
        <div class="trans-left">
          <div class="cash-log-icon ${cfg.color}">
            <i data-lucide="${cfg.icon}"></i>
          </div>
          <div class="trans-meta">
            <span class="trans-desc">${cfg.label}${entry.note ? ' — ' + escapeHTML(entry.note) : ''}</span>
            <span class="trans-date">${dateLabel} at ${timeLabel} &bull; Balance after: ${formatCurrency(entry.balanceAfter)}</span>
          </div>
        </div>
        <div class="trans-right">
          <span class="trans-amount ${cfg.color}">${cfg.sign}${formatCurrency(entry.amount)}</span>
          <button class="icon-btn delete-row-btn" onclick="deleteCashLogEntry('${entry.id}')" title="Remove entry">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

window.deleteCashLogEntry = function(id) {
  if (confirm('Remove this cash log entry? Note: this does not adjust your current balance.')) {
    appState.cashLog = appState.cashLog.filter(e => e.id !== id);
    saveCashLog();
    renderCashAuditLog();
  }
};

function saveRecurring() {
  localStorage.setItem('aura_recurring', JSON.stringify(appState.recurringExpenses));
}

/* ==========================================================================
   Cash Balance Management
   ========================================================================== */

function updateCashBalanceDisplay() {
  const el = document.getElementById('kpi-cash-balance');
  const statusEl = document.getElementById('kpi-cash-status');
  const auditEl = document.getElementById('cash-audit-balance');

  const formatted = formatCurrency(appState.cashBalance);
  if (el) el.textContent = formatted;
  if (auditEl) auditEl.textContent = formatted;

  if (appState.cashBalance < 0) {
    if (el) el.className = 'metric-value text-rose';
    if (auditEl) auditEl.className = 'metric-value text-rose';
    if (statusEl) statusEl.textContent = 'Balance overdrawn';
  } else if (appState.cashBalance === 0) {
    if (el) el.className = 'metric-value text-muted';
    if (auditEl) auditEl.className = 'metric-value text-muted';
    if (statusEl) statusEl.textContent = 'No cash on hand';
  } else {
    if (el) el.className = 'metric-value text-emerald';
    if (auditEl) auditEl.className = 'metric-value text-emerald';
    if (statusEl) statusEl.textContent = 'Available cash';
  }
}

function openCashModal(mode) {
  // mode: 'add' = top up, 'payment' = cash received, 'reduce' = manual reduction
  const modal = document.getElementById('cash-modal');
  const title = document.getElementById('cash-modal-title');
  const label = document.getElementById('cash-amount-label');
  const hint = document.getElementById('cash-modal-hint');
  const modeInput = document.getElementById('cash-modal-mode');

  if (mode === 'add') {
    title.textContent = 'Add Cash';
    label.textContent = 'Amount to Add';
    hint.textContent = 'Enter the amount of cash you are adding to your wallet (e.g. ATM withdrawal).';
  } else if (mode === 'payment') {
    title.textContent = 'Log Cash Payment Received';
    label.textContent = 'Payment Amount';
    hint.textContent = 'Enter a cash payment you received. This will increase your cash balance.';
  } else if (mode === 'reduce') {
    title.textContent = 'Reduce Cash Balance';
    label.textContent = 'Amount to Remove';
    hint.textContent = 'Manually reduce your cash balance (e.g. cash lost, given away, or correcting a mistake).';
  }

  modeInput.value = mode;
  document.getElementById('cash-amount-input').value = '';
  document.getElementById('cash-note-input').value = '';
  modal.classList.add('active');
}

function closeCashModal() {
  document.getElementById('cash-modal').classList.remove('active');
}

function handleCashFormSubmit(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('cash-amount-input').value);
  const note = document.getElementById('cash-note-input').value.trim();
  const mode = document.getElementById('cash-modal-mode').value;

  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid positive amount.');
    return;
  }

  if (mode === 'reduce') {
    appState.cashBalance -= amount;
  } else {
    // 'add' and 'payment' both increase balance
    appState.cashBalance += amount;
  }

  saveCashBalance();
  addCashLogEntry(mode, amount, note || (mode === 'add' ? 'Cash top-up' : mode === 'payment' ? 'Payment received' : 'Manual reduction'));
  updateCashBalanceDisplay();
  renderCashAuditLog();
  closeCashModal();

  const verbMap = { add: 'Added', payment: 'Logged payment of', reduce: 'Removed' };
  speechController.speak(`${verbMap[mode] || 'Updated'} ${formatCurrency(amount)} ${mode === 'reduce' ? 'from' : 'to'} your cash balance.`);
}

/* ==========================================================================
   Recurring Expenses
   ========================================================================== */

/**
 * Auto-post recurring expenses for the current month if not yet posted
 */
function autoPostRecurringExpenses() {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  let posted = 0;
  appState.recurringExpenses.forEach(rec => {
    if (!rec.active) return;

    // Build the date this recurring item should fire this month
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const day = Math.min(rec.dayOfMonth, daysInMonth);
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;

    // Check if already posted this month
    const alreadyPosted = appState.expenses.some(
      e => e.recurringId === rec.id && e.date.startsWith(currentMonth)
    );

    if (!alreadyPosted) {
      const newRecord = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        description: rec.description,
        amount: rec.amount,
        category: rec.category,
        date: dateStr,
        recurringId: rec.id,
        isRecurring: true
      };
      appState.expenses.push(newRecord);
      posted++;
    }
  });

  if (posted > 0) {
    saveExpenses();
  }
}

function renderRecurringList() {
  const container = document.getElementById('recurring-list');
  if (!container) return;

  if (appState.recurringExpenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 24px 0;">
        <i data-lucide="repeat"></i>
        <p>No recurring expenses set up yet. Add one below.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = appState.recurringExpenses.map(rec => {
    const icon = CATEGORY_ICONS[rec.category] || 'help-circle';
    const statusClass = rec.active ? 'text-emerald' : 'text-muted';
    const statusLabel = rec.active ? 'Active' : 'Paused';
    return `
      <div class="recurring-item" id="rec-row-${rec.id}">
        <div class="trans-left">
          <div class="category-icon-wrapper category-${rec.category}">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="trans-meta">
            <span class="trans-desc">${escapeHTML(rec.description)}</span>
            <span class="trans-date">Every month on day ${rec.dayOfMonth} &bull; ${rec.category}</span>
          </div>
        </div>
        <div class="trans-right" style="gap: 10px;">
          <span class="trans-amount text-rose">-${formatCurrency(rec.amount)}</span>
          <span class="trans-badge ${statusClass}">${statusLabel}</span>
          <button class="icon-btn" onclick="toggleRecurring('${rec.id}')" title="Toggle active">
            <i data-lucide="${rec.active ? 'pause-circle' : 'play-circle'}"></i>
          </button>
          <button class="icon-btn delete-row-btn" onclick="deleteRecurring('${rec.id}')" title="Remove">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

window.toggleRecurring = function(id) {
  const idx = appState.recurringExpenses.findIndex(r => r.id === id);
  if (idx !== -1) {
    appState.recurringExpenses[idx].active = !appState.recurringExpenses[idx].active;
    saveRecurring();
    renderRecurringList();
  }
};

window.deleteRecurring = function(id) {
  if (confirm('Remove this recurring expense? Future months will not be auto-posted.')) {
    appState.recurringExpenses = appState.recurringExpenses.filter(r => r.id !== id);
    saveRecurring();
    renderRecurringList();
  }
};

function handleRecurringFormSubmit(e) {
  e.preventDefault();
  const description = document.getElementById('rec-description').value.trim();
  const amount = parseFloat(document.getElementById('rec-amount').value);
  const category = document.getElementById('rec-category').value;
  const dayOfMonth = parseInt(document.getElementById('rec-day').value);

  if (!description || isNaN(amount) || amount <= 0 || isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    alert('Please fill in all fields correctly. Day must be between 1 and 31.');
    return;
  }

  const newRec = {
    id: Date.now().toString(),
    description,
    amount,
    category,
    dayOfMonth,
    active: true
  };

  appState.recurringExpenses.push(newRec);
  saveRecurring();

  // Immediately post for current month if not yet posted
  autoPostRecurringExpenses();
  saveExpenses();
  updateDashboardMetrics();
  renderLedgerTable();
  renderRecurringList();

  // Reset form
  document.getElementById('recurring-form').reset();
}

/* ==========================================================================
   Dashboard KPIs & UI Builders
   ========================================================================== */

function populateMonthSelector() {
  const selectEl = document.getElementById('dashboard-month-select');
  if (!selectEl) return;

  const months = new Set();
  appState.expenses.forEach(e => {
    if (e.date && e.date.length >= 7) {
      months.add(e.date.substring(0, 7));
    }
  });

  // Always ensure current month is in options
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  months.add(currentMonthStr);

  // Sort descending
  const sortedMonths = Array.from(months).sort().reverse();

  // Re-build select options
  const optionsHtml = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    const d = new Date(year, month - 1, 1);
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return `<option value="${m}">${label}</option>`;
  }).join('');

  if (selectEl.innerHTML !== optionsHtml) {
    selectEl.innerHTML = optionsHtml;
  }
  
  if (sortedMonths.includes(appState.targetMonth)) {
    selectEl.value = appState.targetMonth;
  } else {
    appState.targetMonth = currentMonthStr;
    selectEl.value = currentMonthStr;
  }
}

function updateDashboardMetrics() {
  // Populate selector options
  populateMonthSelector();

  // Filter current targeted month expenses
  const targetExpenses = appState.expenses.filter(e => e.date && e.date.startsWith(appState.targetMonth));
  const totalSpent = targetExpenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  const remaining = appState.budget - totalSpent;
  
  // 1. Total Spent KPI
  document.getElementById('kpi-total-expenses').textContent = formatCurrency(totalSpent);
  
  const [year, month] = appState.targetMonth.split('-');
  const labelMonth = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('kpi-expense-count').textContent = `${targetExpenses.length} transaction${targetExpenses.length === 1 ? '' : 's'} logged in ${labelMonth}`;

  // 2. Budget Details KPI
  document.getElementById('kpi-budget-amount').textContent = formatCurrency(appState.budget);
  const spentPercentage = appState.budget > 0 ? Math.min(Math.round((totalSpent / appState.budget) * 100), 100) : 0;
  
  const fillBar = document.getElementById('budget-progress-bar');
  fillBar.style.width = `${spentPercentage}%`;
  
  // Progress bar styling thresholds
  if (spentPercentage >= 90) {
    fillBar.className = 'progress-fill bg-rose';
  } else {
    fillBar.className = 'progress-fill bg-emerald';
  }
  document.getElementById('budget-progress-text').textContent = `${spentPercentage}% spent`;

  // 3. Remaining Budget KPI
  const remainingKpi = document.getElementById('kpi-remaining-budget');
  remainingKpi.textContent = formatCurrency(remaining);
  
  const remainingStatus = document.getElementById('kpi-remaining-status');
  if (remaining < 0) {
    remainingKpi.className = 'metric-value text-rose';
    remainingStatus.textContent = `Overspent by ${formatCurrency(Math.abs(remaining))}`;
    remainingStatus.className = 'text-rose';
  } else if (remaining === 0) {
    remainingKpi.className = 'metric-value text-muted';
    remainingStatus.textContent = 'Budget fully exhausted';
    remainingStatus.className = 'text-muted';
  } else {
    remainingKpi.className = 'metric-value';
    remainingStatus.textContent = `${formatCurrency(remaining)} available`;
    remainingStatus.className = 'text-emerald';
  }

  // 4. Daily Average KPI: Target Month total spent / total days in that month
  let dailyAvg = 0;
  if (targetExpenses.length > 0) {
    const daysInMonth = new Date(year, month, 0).getDate();
    dailyAvg = totalSpent / daysInMonth;
  }
  document.getElementById('kpi-daily-average').textContent = formatCurrency(dailyAvg);

  // Redraw charts using targeted items and targeted month config
  chartController.updateCharts(targetExpenses, appState.targetMonth);

  // Re-build Recent List & Insights
  buildRecentList(targetExpenses);
  buildSmartInsights(targetExpenses, totalSpent, spentPercentage);

  // Update cash balance display
  updateCashBalanceDisplay();
}

function buildRecentList(targetExpenses) {
  const container = document.getElementById('recent-transactions-list');
  if (!container) return;

  // Sort by date descending, grab top 4
  const sorted = [...targetExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox"></i>
        <p>No expenses logged for this month. Try using the AI Assistant or clicking "Add Expense"!</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = sorted.map(item => {
    const icon = CATEGORY_ICONS[item.category] || 'help-circle';
    return `
      <div class="transaction-item">
        <div class="trans-left">
          <div class="category-icon-wrapper category-${item.category}">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="trans-meta">
            <span class="trans-desc">${escapeHTML(item.description)}</span>
            <span class="trans-date">${formatDisplayDate(item.date)}</span>
          </div>
        </div>
        <div class="trans-right">
          <span class="trans-amount text-rose">-${formatCurrency(item.amount)}</span>
          <span class="trans-badge">${item.category}</span>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

/**
 * Procedural offline logic to build dynamic AI financial insights
 */
function buildSmartInsights(targetExpenses, totalSpent, spentPercentage) {
  const container = document.getElementById('ai-insights-panel');
  if (!container) return;

  if (targetExpenses.length === 0) {
    container.innerHTML = `
      <p class="insight-text">No transaction logs for this period yet. Add expenses to receive reports.</p>
      <div class="insight-tip">
        <i data-lucide="lightbulb" class="text-orange"></i>
        <span>Tip: You can use voice commands like "Spent fifteen dollars on lunch today" in the chat assistant.</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // 1. Group by category to find highest spender
  const categoryTotals = {};
  targetExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + parseFloat(e.amount);
  });

  let topCategory = 'Other';
  let topAmount = 0;
  for (const [cat, sum] of Object.entries(categoryTotals)) {
    if (sum > topAmount) {
      topAmount = sum;
      topCategory = cat;
    }
  }

  // 2. Draft intelligence feedback depending on budget thresholds
  let reportText = "";
  if (spentPercentage >= 95) {
    reportText = `🚨 **Critical Alert:** You have exhausted **${spentPercentage}%** of your monthly budget of ${formatCurrency(appState.budget)}. Hold back on non-essential purchases.`;
  } else if (spentPercentage >= 75) {
    reportText = `⚠️ **Warning:** Budget usage is high. You have spent **${spentPercentage}%** of your limit. Your top expenditure category is **${topCategory}** (${formatCurrency(topAmount)}).`;
  } else {
    reportText = `📈 **Healthy Standing:** Your total expenses for this month are **${formatCurrency(totalSpent)}** (${spentPercentage}% of budget). You have a comfortable **${formatCurrency(appState.budget - totalSpent)}** remaining.`;
  }

  // 3. Category specific smart tip
  let tipText = "Your budget is looking balanced. Keep up the disciplined logging!";
  if (topCategory === 'Entertainment') {
    tipText = `Subscriptions can quietly add up. Check if there are any idle memberships in ${topCategory} you can cancel.`;
  } else if (topCategory === 'Food' || topCategory === 'Groceries') {
    tipText = `Dining out at restaurants makes up a key portion of your ${topCategory} costs. Preparing meals at home can save up to 40%.`;
  } else if (topCategory === 'Shopping') {
    tipText = `Try using a 24-hour waiting rule for items in your shopping cart to limit impulse purchases.`;
  } else if (topCategory === 'Transport') {
    tipText = `Commute expenses look high. Consolidate trips or review rideshare usage to trim costs.`;
  }

  container.innerHTML = `
    <div class="insight-text">${markdownToHTML(reportText)}</div>
    <div class="insight-tip">
      <i data-lucide="lightbulb" class="text-orange"></i>
      <span>${tipText}</span>
    </div>
  `;
  lucide.createIcons();
}

/* ==========================================================================
   Ledger Feed Builders & Filtering
   ========================================================================== */

function renderLedgerTable() {
  const tbody = document.getElementById('ledger-tbody');
  const emptyState = document.getElementById('ledger-empty-state');
  if (!tbody) return;

  const searchQuery = document.getElementById('ledger-search').value.toLowerCase().trim();
  const filterCat = document.getElementById('ledger-filter-category').value;
  const sortBy = document.getElementById('ledger-sort-by').value;

  // Filter records
  let filtered = appState.expenses.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchQuery) || 
                          item.category.toLowerCase().includes(searchQuery) ||
                          item.amount.toString().includes(searchQuery);
    const matchesCategory = filterCat === "" || item.category === filterCat;
    return matchesSearch && matchesCategory;
  });

  // Sort records
  filtered.sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
    if (sortBy === 'amount-desc') return b.amount - a.amount;
    if (sortBy === 'amount-asc') return a.amount - b.amount;
    return 0;
  });

  // Render
  if (filtered.length === 0) {
    tbody.innerHTML = "";
    emptyState.style.display = "flex";
    document.getElementById('ledger-total-count').textContent = `Showing 0 transactions`;
    document.getElementById('ledger-total-sum').textContent = `Total Filtered: ${formatCurrency(0)}`;
    return;
  }

  emptyState.style.display = "none";
  tbody.innerHTML = filtered.map(item => {
    const icon = CATEGORY_ICONS[item.category] || 'help-circle';
    return `
      <tr id="ledger-row-${item.id}">
        <td>${formatDisplayDate(item.date)}</td>
        <td>
          <div style="font-weight: 600;">${escapeHTML(item.description)}</div>
        </td>
        <td>
          <span class="category-badge badge-${item.category}">
            <i data-lucide="${icon}" style="width: 12px; height: 12px;"></i>
            <span>${item.category}</span>
          </span>
        </td>
        <td class="text-right text-rose" style="font-weight: 700;">-${formatCurrency(item.amount)}</td>
        <td class="text-center">
          <div class="action-row-btns">
            <button class="icon-btn edit-row-btn" onclick="openEditModal('${item.id}')" title="Edit row">
              <i data-lucide="edit-2"></i>
            </button>
            <button class="icon-btn delete-row-btn" onclick="deleteExpenseRecord('${item.id}')" title="Delete row">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();

  // Update summary numbers
  const sumFiltered = filtered.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  document.getElementById('ledger-total-count').textContent = `Showing ${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`;
  document.getElementById('ledger-total-sum').textContent = `Total Filtered: ${formatCurrency(sumFiltered)}`;
}

/* ==========================================================================
   Chat Dialogue Manager & Command Interpreter
   ========================================================================== */

function addChatMessage(sender, text, isHtml = false, parseReport = null) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = `message ${sender}-message`;
  
  let contentHtml = `<div class="message-content">`;
  
  if (isHtml) {
    contentHtml += text;
  } else {
    contentHtml += `<p>${escapeHTML(text).replace(/\n/g, '<br>')}</p>`;
  }

  // Inject structural extraction feedback card
  if (parseReport) {
    contentHtml += `
      <div class="parse-report-card">
        <div class="parse-report-row">
          <span class="parse-report-label">Merchant:</span>
          <span class="parse-report-value">${escapeHTML(parseReport.description)}</span>
        </div>
        <div class="parse-report-row">
          <span class="parse-report-label">Category:</span>
          <span class="parse-report-value">${parseReport.category}</span>
        </div>
        <div class="parse-report-row">
          <span class="parse-report-label">Date:</span>
          <span class="parse-report-value">${parseReport.date}</span>
        </div>
        <div class="parse-report-row">
          <span class="parse-report-label">Amount:</span>
          <span class="parse-report-value text-rose">${formatCurrency(parseReport.amount)}</span>
        </div>
        <div class="parse-report-row" style="font-size: 0.72rem; color: var(--text-muted);">
          <span>Parsed By:</span>
          <span>${parseReport.parsedBy}</span>
        </div>
      </div>
    `;
  }
  
  contentHtml += `</div>`;
  bubble.innerHTML = contentHtml;
  container.appendChild(bubble);

  // Scroll bottom
  container.scrollTop = container.scrollHeight;
}

function showChatTypingIndicator() {
  const container = document.getElementById('chat-messages-container');
  const indicator = document.createElement('div');
  indicator.className = 'message bot-message typing-indicator-wrapper';
  indicator.id = 'chat-typing-indicator';
  indicator.innerHTML = `
    <div class="message-content">
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

function removeChatTypingIndicator() {
  const element = document.getElementById('chat-typing-indicator');
  if (element) element.remove();
}

/**
 * Main parser entry point coordinating local patterns or Gemini key bindings
 */
async function processUserCommand(command) {
  if (!command.trim()) return;

  // Render user text bubble
  addChatMessage('user', command);

  // Analyze query type: is it an analytical command or a ledger add request?
  const normalized = command.toLowerCase().trim();
  
  if (normalized.includes('budget left') || normalized.includes('remaining budget') || normalized.includes('how much can i spend')) {
    showChatTypingIndicator();
    setTimeout(() => {
      removeChatTypingIndicator();
      const totalSpent = appState.expenses.reduce((sum, item) => sum + item.amount, 0);
      const remaining = appState.budget - totalSpent;
      let reply = "";
      if (remaining > 0) {
        reply = `You have spent ${formatCurrency(totalSpent)} out of your ${formatCurrency(appState.budget)} budget. You have **${formatCurrency(remaining)}** remaining to spend this month.`;
      } else {
        reply = `You have exceeded your monthly limit! You spent ${formatCurrency(totalSpent)} which is **${formatCurrency(Math.abs(remaining))}** over your ${formatCurrency(appState.budget)} budget limit.`;
      }
      addChatMessage('bot', reply);
      speechController.speak(reply.replace(/\*\*/g, ''));
    }, 600);
    return;
  }
  
  if (normalized.includes('how much did i spend') || normalized.includes('total spend') || normalized.includes('show spending')) {
    showChatTypingIndicator();
    setTimeout(() => {
      removeChatTypingIndicator();
      const totalSpent = appState.expenses.reduce((sum, item) => sum + item.amount, 0);
      const reply = `Your total expenditures are currently **${formatCurrency(totalSpent)}** across ${appState.expenses.length} transactions.`;
      addChatMessage('bot', reply);
      speechController.speak(reply.replace(/\*\*/g, ''));
    }, 600);
    return;
  }

  // Default behavior: Parse and log transaction
  showChatTypingIndicator();
  
  try {
    const result = await parseExpense(command);
    removeChatTypingIndicator();

    if (result.amount <= 0) {
      const errorMsg = "Hmm, I couldn't extract an expense amount. Could you please specify how much you spent? For example: 'Lunch for $15' or '$8 on coffee'.";
      addChatMessage('bot', errorMsg);
      speechController.speak(errorMsg);
      return;
    }

    // Save record to state
    const newRecord = {
      id: Date.now().toString(),
      description: result.description,
      amount: result.amount,
      category: result.category,
      date: result.date
    };

    appState.expenses.push(newRecord);
    saveExpenses();
    
    // Deduct from cash balance
    appState.cashBalance -= result.amount;
    saveCashBalance();
    addCashLogEntry('expense', result.amount, result.description);
    updateCashBalanceDisplay();
    renderCashAuditLog();

    // Auto-switch targeted month to the newly logged item's month
    appState.targetMonth = result.date.substring(0, 7);
    
    updateDashboardMetrics();
    renderLedgerTable();

    // Confirmation dialogues
    let botReply = `Got it! I've logged **${formatCurrency(result.amount)}** for **${result.description}** under **${result.category}**.`;
    
    // Append warnings if any API fallbacks occurred
    if (result.fallbackNotice) {
      botReply += `\n\n*(Note: ${result.fallbackNotice})*`;
    }
    
    addChatMessage('bot', botReply, false, result);
    
    // Voice audio speakout
    const voiceConfirmation = `Logged ${result.amount} dollars for ${result.description} to ${result.category}.`;
    speechController.speak(voiceConfirmation);

  } catch (error) {
    removeChatTypingIndicator();
    console.error("Command processing failure:", error);
    const errMsg = "Apologies, I encountered an issue parsing that request. Please try adding it manually or formatting the text clearly.";
    addChatMessage('bot', errMsg);
    speechController.speak(errMsg);
  }
}

/* ==========================================================================
   Voice Engine Listeners
   ========================================================================== */

let voiceTargetCallback = null;

function activateSpeechInput(onCapture) {
  const overlay = document.getElementById('voice-overlay');
  if (!overlay) return;

  // Show voice overlay panel
  overlay.style.display = "flex";
  
  // Highlight system header indicators
  const headerIndicator = document.getElementById('voice-indicator');
  if (headerIndicator) headerIndicator.style.display = "flex";

  speechController.startListening(
    // Success capture callback
    (text) => {
      overlay.style.display = "none";
      if (headerIndicator) headerIndicator.style.display = "none";
      if (text) {
        onCapture(text);
      }
    },
    // End callback
    () => {
      overlay.style.display = "none";
      if (headerIndicator) headerIndicator.style.display = "none";
    },
    // Error callback
    (err) => {
      overlay.style.display = "none";
      if (headerIndicator) headerIndicator.style.display = "none";
      alert(`Voice recognition error: ${err}. Make sure microphone permissions are allowed.`);
    }
  );
}

/* ==========================================================================
   CRUD / Modal Actions (Edit & Manual Forms)
   ========================================================================== */

function openManualAddModal() {
  document.getElementById('modal-title').textContent = "Log Expense";
  document.getElementById('edit-expense-id').value = "";
  document.getElementById('expense-form').reset();
  
  // Default date selector to today's local date
  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('expense-date').value = todayStr;

  document.getElementById('modal-currency-addon').textContent = appState.currency;
  document.getElementById('expense-modal').classList.add('active');
}

window.openEditModal = function(id) {
  const record = appState.expenses.find(e => e.id === id);
  if (!record) return;

  document.getElementById('modal-title').textContent = "Modify Expense";
  document.getElementById('edit-expense-id').value = record.id;
  document.getElementById('expense-description').value = record.description;
  document.getElementById('expense-amount').value = record.amount;
  document.getElementById('expense-category').value = record.category;
  document.getElementById('expense-date').value = record.date;

  document.getElementById('modal-currency-addon').textContent = appState.currency;
  document.getElementById('expense-modal').classList.add('active');
};

function closeModal() {
  document.getElementById('expense-modal').classList.remove('active');
}

function handleExpenseFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('edit-expense-id').value;
  const description = document.getElementById('expense-description').value.trim();
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const category = document.getElementById('expense-category').value;
  const date = document.getElementById('expense-date').value;

  if (!description || isNaN(amount) || amount <= 0 || !category || !date) {
    alert("Please fill in all required fields accurately.");
    return;
  }

  if (id) {
    // Edit existing
    const idx = appState.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      const oldAmount = parseFloat(appState.expenses[idx].amount) || 0;
      appState.expenses[idx] = { id, description, amount, category, date };
      // Adjust cash balance by the difference
      appState.cashBalance += oldAmount - amount;
      saveCashBalance();
      updateCashBalanceDisplay();
      appState.targetMonth = date.substring(0, 7);
    }
  } else {
    // Add new
    const newRecord = {
      id: Date.now().toString(),
      description,
      amount,
      category,
      date
    };
    appState.expenses.push(newRecord);
    // Deduct from cash balance
    appState.cashBalance -= amount;
    saveCashBalance();
    addCashLogEntry('expense', amount, description);
    updateCashBalanceDisplay();
    renderCashAuditLog();
    appState.targetMonth = date.substring(0, 7);
  }

  saveExpenses();
  updateDashboardMetrics();
  renderLedgerTable();
  closeModal();
}

window.deleteExpenseRecord = function(id) {
  if (confirm("Are you sure you want to remove this transaction record?")) {
    const record = appState.expenses.find(e => e.id === id);
    if (record) {
      appState.cashBalance += parseFloat(record.amount) || 0;
      saveCashBalance();
      updateCashBalanceDisplay();
    }
    appState.expenses = appState.expenses.filter(e => e.id !== id);
    saveExpenses();
    updateDashboardMetrics();
    renderLedgerTable();
  }
};

/* ==========================================================================
   Navigation Router
   ========================================================================== */

function handleNavigation(tabId) {
  // Update nav class
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('data-tab') === tabId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update visible pane
  document.querySelectorAll('.view-pane').forEach(el => {
    if (el.id === `view-${tabId}`) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Custom page header title bindings
  const titleEl = document.getElementById('page-title');
  const subEl = document.getElementById('page-subtitle');

  if (tabId === 'dashboard') {
    titleEl.textContent = "Dashboard";
    subEl.textContent = "Welcome back! Here's your financial overview.";
    // Ensure charts adapt sizing to screen on tab toggle
    setTimeout(() => chartController.adaptThemes(), 50);
  } else if (tabId === 'ledger') {
    titleEl.textContent = "Ledger Book";
    subEl.textContent = "Full records of logs, expenditures, and filters.";
    renderLedgerTable();
  } else if (tabId === 'assistant') {
    titleEl.textContent = "AI Financial Copilot";
    subEl.textContent = "Log transactions and request stats with simple language.";
  } else if (tabId === 'settings') {
    titleEl.textContent = "Settings Dashboard";
    subEl.textContent = "Manage API interfaces, backup ledgers, and configurations.";
    loadSettingsInputs();
  } else if (tabId === 'recurring') {
    titleEl.textContent = "Recurring Expenses";
    subEl.textContent = "Manage monthly auto-posted subscriptions and bills.";
    renderRecurringList();
  } else if (tabId === 'cash') {
    titleEl.textContent = "Cash Audit Log";
    subEl.textContent = "Full history of cash movements, payments, and adjustments.";
    renderCashAuditLog();
  }
}

/* ==========================================================================
   Import / Export & Administration Handlers
   ========================================================================== */

function loadSettingsInputs() {
  document.getElementById('settings-monthly-budget').value = appState.budget;
  document.getElementById('settings-currency').value = appState.currency;
  
  const savedKey = localStorage.getItem('aura_gemini_key') || "";
  document.getElementById('settings-gemini-key').value = savedKey;
  updateGeminiStatusLabel(savedKey);
}

function updateGeminiStatusLabel(key) {
  const statusEl = document.getElementById('api-status-text');
  if (key && key.trim() !== '') {
    statusEl.textContent = "Using: Active Gemini 2.5 AI Mode";
    statusEl.className = "api-status-badge text-emerald";
  } else {
    statusEl.textContent = "Using: Local Offline Rules Engine";
    statusEl.className = "api-status-badge text-muted";
  }
}

async function testGeminiConnection() {
  const inputKey = document.getElementById('settings-gemini-key').value.trim();
  if (!inputKey) {
    alert("Please input a Gemini API Key first.");
    return;
  }

  const statusEl = document.getElementById('api-status-text');
  statusEl.textContent = "Connecting to Gemini APIs...";
  statusEl.className = "api-status-badge text-orange";

  const testPhrase = "$12 burritos for lunch yesterday";
  
  try {
    const response = await parseWithGemini(testPhrase, inputKey);
    if (response && response.amount === 12) {
      alert("Success! Gemini API Connection verified. Key saved.");
      localStorage.setItem('aura_gemini_key', inputKey);
      updateGeminiStatusLabel(inputKey);
    } else {
      throw new Error("Invalid response format received from model endpoint.");
    }
  } catch (err) {
    alert(`Gemini connection test failed: ${err.message}. Double check key configuration.`);
    updateGeminiStatusLabel(localStorage.getItem('aura_gemini_key') || "");
  }
}

function handleJSONExport() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState.expenses, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `AuraFinance_ledger_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function handleJSONImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (Array.isArray(parsed)) {
        // Simple structure validation
        const isValid = parsed.every(item => item.description && item.amount && item.category && item.date);
        if (isValid) {
          appState.expenses = parsed;
          saveExpenses();
          updateDashboardMetrics();
          renderLedgerTable();
          alert(`Success! Successfully imported ${parsed.length} records.`);
        } else {
          alert("Import failed. The JSON file structure doesn't match the required ledger schema.");
        }
      } else {
        alert("Import failed. The JSON file must represent a collection array.");
      }
    } catch (err) {
      alert(`Failed to parse file: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function handleCSVExport() {
  if (appState.expenses.length === 0) {
    alert("Nothing in ledger to export.");
    return;
  }

  const csvRows = [
    ['ID', 'Date', 'Description', 'Category', 'Amount']
  ];

  appState.expenses.forEach(e => {
    csvRows.push([
      e.id,
      e.date,
      `"${e.description.replace(/"/g, '""')}"`,
      e.category,
      e.amount
    ]);
  });

  const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(r => r.join(",")).join("\n");
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", encodeURI(csvContent));
  downloadAnchor.setAttribute("download", `AuraFinance_ledger_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/* ==========================================================================
   Helper Utilities
   ========================================================================== */

function formatCurrency(val) {
  const amt = parseFloat(val) || 0;
  return `${appState.currency}${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDisplayDate(dateStr) {
  const parts = dateStr.split('-');
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function markdownToHTML(text) {
  // Simple subset parser for bold syntax in insights
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

/* ==========================================================================
   Event Bindings & Initialization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Register Service Worker for PWA installation support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('ServiceWorker registered with scope:', reg.scope))
      .catch(err => console.error('ServiceWorker registration failed:', err));
  }

  // Load State
  loadState();

  // Initialize UI Chart structures
  chartController.initCharts();
  updateDashboardMetrics();

  // Check voice icon states
  const voiceIcon = document.getElementById('speech-voice-icon');
  if (voiceIcon) {
    if (speechController.isVoiceEnabled) {
      voiceIcon.setAttribute('data-lucide', 'volume-2');
    } else {
      voiceIcon.setAttribute('data-lucide', 'volume-x');
    }
  }

  // 1. Navigation Tab Switches
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      handleNavigation(tabId);
      window.location.hash = tabId;
    });
  });

  // Switch to correct tab based on hash on load
  const hash = window.location.hash.substring(1);
  if (['dashboard', 'ledger', 'assistant', 'settings', 'recurring', 'cash'].includes(hash)) {
    handleNavigation(hash);
  } else {
    handleNavigation('dashboard');
  }

  // Dashboard Month Filter change trigger
  const monthSelect = document.getElementById('dashboard-month-select');
  if (monthSelect) {
    monthSelect.addEventListener('change', (e) => {
      appState.targetMonth = e.target.value;
      updateDashboardMetrics();
    });
  }

  // 2. Modals events
  document.getElementById('btn-quick-add').addEventListener('click', openManualAddModal);
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
  document.getElementById('expense-form').addEventListener('submit', handleExpenseFormSubmit);

  // Close modal when clicking outside contents
  document.getElementById('expense-modal').addEventListener('click', (e) => {
    if (e.target.id === 'expense-modal') closeModal();
  });

  // 3. Theme Toggle Trigger
  document.getElementById('theme-toggle').addEventListener('click', () => {
    appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', appState.theme);
    localStorage.setItem('aura_theme', appState.theme);
    chartController.adaptThemes();
  });

  // 4. Ledger Filters Listeners
  document.getElementById('ledger-search').addEventListener('input', renderLedgerTable);
  document.getElementById('ledger-filter-category').addEventListener('change', renderLedgerTable);
  document.getElementById('ledger-sort-by').addEventListener('change', renderLedgerTable);
  document.getElementById('btn-export-csv').addEventListener('click', handleCSVExport);
  document.getElementById('btn-see-all').addEventListener('click', () => handleNavigation('ledger'));

  // 5. Chat & NLP Command Form submission
  document.getElementById('chat-input-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('chat-text-input');
    const cmd = inputEl.value;
    if (!cmd.trim()) return;

    inputEl.value = "";
    await processUserCommand(cmd);
  });

  // Listeners for Chip suggestions
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      processUserCommand(chip.textContent.replace(/"/g, ''));
    });
  });

  // Toggle Vocal Confirmations
  document.getElementById('btn-toggle-speech-synthesis').addEventListener('click', () => {
    const isEnabled = speechController.toggleVoiceFeedback();
    const voiceIcon = document.getElementById('speech-voice-icon');
    if (isEnabled) {
      voiceIcon.setAttribute('data-lucide', 'volume-2');
    } else {
      voiceIcon.setAttribute('data-lucide', 'volume-x');
    }
    lucide.createIcons();
  });

  // Clear chat dialogues
  document.getElementById('btn-clear-chat').addEventListener('click', () => {
    const container = document.getElementById('chat-messages-container');
    container.innerHTML = `
      <div class="message system-message">
        <div class="message-content">
          <p>👋 Chat history cleared. Aura is ready to listen. Try saying or typing:</p>
          <div class="chat-suggestions">
            <button class="suggestion-chip">"$10 Netflix subscription"</button>
            <button class="suggestion-chip">"Bought $45 of groceries at Costco yesterday"</button>
            <button class="suggestion-chip">"Spent $60 on fuel"</button>
            <button class="suggestion-chip">"How much budget is left?"</button>
          </div>
        </div>
      </div>
    `;
    // Bind new chips
    container.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        processUserCommand(chip.textContent.replace(/"/g, ''));
      });
    });
  });

  // 6. Voice Inputs (Chat mic button & Global floating action button)
  const micButtonHandler = () => {
    activateSpeechInput((voiceText) => {
      processUserCommand(voiceText);
    });
  };

  document.getElementById('btn-chat-mic').addEventListener('click', micButtonHandler);
  document.getElementById('global-mic-btn').addEventListener('click', micButtonHandler);
  document.getElementById('btn-cancel-voice').addEventListener('click', () => {
    speechController.stopListening();
  });

  // 7. Settings Config Forms Actions
  document.getElementById('settings-monthly-budget').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      appState.budget = val;
      saveSettings();
      updateDashboardMetrics();
    }
  });

  document.getElementById('settings-currency').addEventListener('change', (e) => {
    appState.currency = e.target.value;
    document.getElementById('currency-addon').textContent = appState.currency;
    chartController.setCurrencySymbol(appState.currency);
    saveSettings();
    updateDashboardMetrics();
  });

  // Test Gemini credentials
  document.getElementById('btn-test-gemini-key').addEventListener('click', testGeminiConnection);
  
  // Gemini key input changes
  document.getElementById('settings-gemini-key').addEventListener('change', (e) => {
    const val = e.target.value.trim();
    localStorage.setItem('aura_gemini_key', val);
    updateGeminiStatusLabel(val);
  });

  // Data Administration actions
  document.getElementById('btn-seed-data').addEventListener('click', () => {
    if (confirm("Reset ledger and reload default mock items?")) {
      appState.expenses = [...DUMMY_DATA];
      saveExpenses();
      updateDashboardMetrics();
      renderLedgerTable();
      alert("Sample ledger data successfully loaded!");
    }
  });

  document.getElementById('btn-export-json').addEventListener('click', handleJSONExport);
  document.getElementById('btn-import-json-file').addEventListener('change', handleJSONImport);
  
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (confirm("🚨 WARNING: Are you sure you want to delete ALL transaction records? This action cannot be undone.")) {
      appState.expenses = [];
      saveExpenses();
      updateDashboardMetrics();
      renderLedgerTable();
      alert("Ledger database purged.");
    }
  });

  // Load Lucide Icons initial pass
  lucide.createIcons();

  // 8. Cash Balance Controls
  document.getElementById('btn-add-cash').addEventListener('click', () => openCashModal('add'));
  document.getElementById('btn-log-cash-payment').addEventListener('click', () => openCashModal('payment'));
  document.getElementById('btn-reduce-cash').addEventListener('click', () => openCashModal('reduce'));
  document.getElementById('btn-close-cash-modal').addEventListener('click', closeCashModal);
  document.getElementById('btn-cancel-cash-modal').addEventListener('click', closeCashModal);
  document.getElementById('cash-modal').addEventListener('click', (e) => {
    if (e.target.id === 'cash-modal') closeCashModal();
  });
  document.getElementById('cash-form').addEventListener('submit', handleCashFormSubmit);

  // 9. Recurring Expense Form
  document.getElementById('recurring-form').addEventListener('submit', handleRecurringFormSubmit);

  updateCashBalanceDisplay();
});
