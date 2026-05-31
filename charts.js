/**
 * AuraFinance // Charting Engine (charts.js)
 * Controls Chart.js configuration, data generation, and theme shifts.
 */

class ChartingEngine {
  constructor() {
    this.trendChart = null;
    this.categoryChart = null;
    this.currencySymbol = '$';
  }

  /**
   * Set the active currency symbol for tooltips
   */
  setCurrencySymbol(symbol) {
    this.currencySymbol = symbol;
  }

  /**
   * Get theme specific styling variables
   */
  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: isDark ? '#9CA3AF' : '#6B7280',
      grid: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      tooltipText: isDark ? '#F3F4F6' : '#1F2937'
    };
  }

  /**
   * Core initialization of charts
   */
  initCharts() {
    if (typeof Chart === 'undefined') {
      console.warn("Chart.js library is not loaded. Analytics charts will be disabled.");
      return;
    }
    const theme = this.getThemeColors();
    const fontSettings = {
      family: "'Plus Jakarta Sans', sans-serif",
      size: 11
    };

    // 1. Trend Chart (Area Line)
    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
      // Create gradients for lines
      const gradient = trendCtx.getContext('2d').createLinearGradient(0, 0, 0, 250);
      gradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
      gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

      this.trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Cumulative Spent',
            data: [],
            borderColor: '#6366F1',
            borderWidth: 3,
            backgroundColor: gradient,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#6366F1',
            pointHoverRadius: 6,
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: theme.tooltipBg,
              titleColor: theme.tooltipText,
              bodyColor: theme.tooltipText,
              borderColor: theme.tooltipBorder,
              borderWidth: 1,
              titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' },
              bodyFont: { family: "'Plus Jakarta Sans', sans-serif" },
              padding: 10,
              displayColors: false,
              callbacks: {
                label: (context) => {
                  return ` Total Spent: ${this.currencySymbol}${context.parsed.y.toFixed(2)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: theme.grid },
              ticks: { color: theme.text, font: fontSettings }
            },
            y: {
              grid: { color: theme.grid },
              ticks: {
                color: theme.text,
                font: fontSettings,
                callback: (value) => `${this.currencySymbol}${value}`
              }
            }
          }
        }
      });
    }

    // 2. Category Distribution Chart (Donut)
    const catCtx = document.getElementById('categoryChart');
    if (catCtx) {
      this.categoryChart = new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: [
              '#F59E0B', // Food
              '#10B981', // Groceries
              '#8B5CF6', // Entertainment
              '#3B82F6', // Transport
              '#06B6D4', // Utilities
              '#EC4899', // Shopping
              '#EF4444', // Health
              '#6B7280'  // Other
            ],
            borderWidth: 2,
            borderColor: 'rgba(0, 0, 0, 0.05)',
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: theme.text,
                font: fontSettings,
                padding: 12,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              backgroundColor: theme.tooltipBg,
              titleColor: theme.tooltipText,
              bodyColor: theme.tooltipText,
              borderColor: theme.tooltipBorder,
              borderWidth: 1,
              titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' },
              bodyFont: { family: "'Plus Jakarta Sans', sans-serif" },
              padding: 10,
              displayColors: true,
              callbacks: {
                label: (context) => {
                  const val = context.raw;
                  return ` Spent: ${this.currencySymbol}${val.toFixed(2)}`;
                }
              }
            }
          }
        }
      });
    }
  }

  /**
   * Regroup expense details and redraw graphs
   */
  updateCharts(expenses, targetMonth) {
    if (!this.trendChart || !this.categoryChart) return;

    // 1. Process Category Share (Donut)
    const categoryTotals = {
      Food: 0,
      Groceries: 0,
      Entertainment: 0,
      Transport: 0,
      Utilities: 0,
      Shopping: 0,
      Health: 0,
      Other: 0
    };

    expenses.forEach(exp => {
      const cat = exp.category || 'Other';
      if (categoryTotals.hasOwnProperty(cat)) {
        categoryTotals[cat] += parseFloat(exp.amount) || 0;
      } else {
        categoryTotals['Other'] += parseFloat(exp.amount) || 0;
      }
    });

    const categories = Object.keys(categoryTotals);
    const categoryValues = Object.values(categoryTotals);

    // Keep categories with positive spends, or show empty placeholders
    const activeCategories = [];
    const activeValues = [];
    const activeColors = [];
    
    const colorMap = {
      Food: '#F59E0B',
      Groceries: '#10B981',
      Entertainment: '#8B5CF6',
      Transport: '#3B82F6',
      Utilities: '#06B6D4',
      Shopping: '#EC4899',
      Health: '#EF4444',
      Other: '#6B7280'
    };

    categories.forEach((cat, idx) => {
      if (categoryValues[idx] > 0) {
        activeCategories.push(cat);
        activeValues.push(categoryValues[idx]);
        activeColors.push(colorMap[cat]);
      }
    });

    // If completely empty, show placeholders
    if (activeValues.length === 0) {
      this.categoryChart.data.labels = ['No Data'];
      this.categoryChart.data.datasets[0].data = [1];
      this.categoryChart.data.datasets[0].backgroundColor = ['#1F2937'];
    } else {
      this.categoryChart.data.labels = activeCategories;
      this.categoryChart.data.datasets[0].data = activeValues;
      this.categoryChart.data.datasets[0].backgroundColor = activeColors;
    }
    
    this.categoryChart.update();

    // 2. Process Daily Cumulative Spending Trend (Line)
    // Sort expenses by date ascending
    const sortedExpenses = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Group totals by date
    const dailySpends = {};
    let dates = [];

    if (targetMonth) {
      // Generate days for target month
      const [year, month] = targetMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dates.push(dStr);
      }
    } else {
      // Generate date array for last 30 days or based on dataset dates
      if (sortedExpenses.length === 0) {
        // Load current week dates as placeholders
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split('T')[0]);
        }
      } else {
        // Find min date and max date in records, fill intervals
        const firstDate = new Date(sortedExpenses[0].date);
        const lastDate = new Date(); // up to today
        const dateIter = new Date(firstDate);
        
        // Safety limits (max 60 days to prevent chart overflow)
        const diffTime = Math.abs(lastDate - firstDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 60) {
          dateIter.setDate(lastDate.getDate() - 30); // scale window to last 30 days
        }

        while (dateIter <= lastDate) {
          dates.push(dateIter.toISOString().split('T')[0]);
          dateIter.setDate(dateIter.getDate() + 1);
        }
      }
    }

    dates.forEach(d => {
      dailySpends[d] = 0;
    });

    sortedExpenses.forEach(exp => {
      if (dailySpends.hasOwnProperty(exp.date)) {
        dailySpends[exp.date] += parseFloat(exp.amount) || 0;
      }
    });

    // Build cumulative array
    let cumulative = 0;
    const dataPoints = dates.map(d => {
      cumulative += dailySpends[d];
      return cumulative;
    });

    // Formatting date labels (e.g. "May 25")
    const formattedLabels = dates.map(d => {
      const parts = d.split('-');
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    });

    this.trendChart.data.labels = formattedLabels;
    this.trendChart.data.datasets[0].data = dataPoints;
    this.trendChart.update();
  }

  /**
   * Dynamically adjust chart settings for light/dark triggers
   */
  adaptThemes() {
    if (!this.trendChart || !this.categoryChart) return;
    
    const theme = this.getThemeColors();

    // Adapt Trend Chart elements
    this.trendChart.options.scales.x.grid.color = theme.grid;
    this.trendChart.options.scales.x.ticks.color = theme.text;
    this.trendChart.options.scales.y.grid.color = theme.grid;
    this.trendChart.options.scales.y.ticks.color = theme.text;
    this.trendChart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
    this.trendChart.options.plugins.tooltip.titleColor = theme.tooltipText;
    this.trendChart.options.plugins.tooltip.bodyColor = theme.tooltipText;
    this.trendChart.options.plugins.tooltip.borderColor = theme.tooltipBorder;
    this.trendChart.update();

    // Adapt Category Chart elements
    this.categoryChart.options.plugins.legend.labels.color = theme.text;
    this.categoryChart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
    this.categoryChart.options.plugins.tooltip.titleColor = theme.tooltipText;
    this.categoryChart.options.plugins.tooltip.bodyColor = theme.tooltipText;
    this.categoryChart.options.plugins.tooltip.borderColor = theme.tooltipBorder;
    this.categoryChart.update();
  }
}

// Instantiate global chart controller
const chartController = new ChartingEngine();
