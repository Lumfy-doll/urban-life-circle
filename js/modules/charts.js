/**
 * charts.js — Chart.js 图表渲染模块
 * 雷达图、折线图、柱状图、评分环
 */

window.ChartManager = (function () {
  const charts = {};

  // Chart.js 全局默认配置
  function _globalDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#94afd0';
    Chart.defaults.font.family = "Inter, 'PingFang SC', sans-serif";
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyleWidth = 8;
  }

  // ─── 雷达图：生活圈六维评分 ───────────────────────────
  function renderRadarChart(canvasId, year = 2024) {
    _globalDefaults();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const scores = AnalysisManager.getYearScores(year);
    const dims = AnalysisManager.getDimensionConfig();
    const labels = dims.map(d => d.label);
    const data   = dims.map(d => +scores[d.key].toFixed(1));

    if (charts[canvasId]) charts[canvasId].destroy();

    charts[canvasId] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: `${year}年`,
          data,
          backgroundColor: 'rgba(59,130,246,0.12)',
          borderColor:     'rgba(59,130,246,0.8)',
          pointBackgroundColor: '#3b82f6',
          pointBorderColor:    '#1d4ed8',
          pointRadius: 4,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        scales: {
          r: {
            min: 0, max: 100,
            grid:      { color: 'rgba(59,130,246,0.12)' },
            angleLines:{ color: 'rgba(59,130,246,0.10)' },
            pointLabels: {
              font: { size: 11, weight: '500' },
              color: '#94afd0',
            },
            ticks: {
              display: false,
              stepSize: 20,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10,18,35,0.95)',
            borderColor: 'rgba(59,130,246,0.4)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw.toFixed(1)} 分`,
            },
          },
        },
      },
    });
  }

  // ─── 折线图：多年趋势 ──────────────────────────────────
  function renderTrendChart(canvasId) {
    _globalDefaults();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const years = AnalysisManager.getYearList();
    const dims  = AnalysisManager.getDimensionConfig();

    // 只显示主要维度（前4个）
    const datasets = dims.slice(0, 4).map(d => ({
      label: d.label,
      data: years.map(y => +AnalysisManager.getYearScores(y)[d.key].toFixed(1)),
      borderColor: d.color,
      backgroundColor: d.color + '18',
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.4,
    }));

    if (charts[canvasId]) charts[canvasId].destroy();

    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: years.map(String), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { color: 'rgba(59,130,246,0.08)' },
            ticks: { color: '#546280', font: { size: 11 } },
          },
          y: {
            min: 40, max: 100,
            grid: { color: 'rgba(59,130,246,0.08)' },
            ticks: { color: '#546280', font: { size: 11 }, stepSize: 10 },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 12, font: { size: 11 }, color: '#94afd0' },
          },
          tooltip: {
            backgroundColor: 'rgba(10,18,35,0.95)',
            borderColor: 'rgba(59,130,246,0.4)',
            borderWidth: 1,
            padding: 10,
          },
        },
      },
    });
  }

  // ─── 柱状图：各维度对比 ────────────────────────────────
  function renderBarChart(canvasId, year1 = 2020, year2 = 2026) {
    _globalDefaults();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const dims   = AnalysisManager.getDimensionConfig();
    const labels = dims.map(d => d.label);
    const data1  = dims.map(d => +AnalysisManager.getYearScores(year1)[d.key].toFixed(1));
    const data2  = dims.map(d => +AnalysisManager.getYearScores(year2)[d.key].toFixed(1));

    if (charts[canvasId]) charts[canvasId].destroy();

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: `${year1}年`,
            data: data1,
            backgroundColor: 'rgba(139,92,246,0.55)',
            borderColor: 'rgba(139,92,246,0.9)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: `${year2}年`,
            data: data2,
            backgroundColor: 'rgba(59,130,246,0.55)',
            borderColor: 'rgba(59,130,246,0.9)',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        scales: {
          x: {
            grid: { color: 'rgba(59,130,246,0.06)' },
            ticks: { color: '#546280', font: { size: 10 } },
          },
          y: {
            min: 0, max: 100,
            grid: { color: 'rgba(59,130,246,0.06)' },
            ticks: { color: '#546280', font: { size: 10 }, stepSize: 20 },
          },
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { padding: 14, font: { size: 11 }, color: '#94afd0' },
          },
          tooltip: {
            backgroundColor: 'rgba(10,18,35,0.95)',
            borderColor: 'rgba(59,130,246,0.4)',
            borderWidth: 1,
            padding: 10,
          },
        },
      },
    });
  }

  // ─── 评分环动画 ────────────────────────────────────────
  function animateScoreRing(ringId, score, color = '#3b82f6') {
    const fill = document.querySelector(`#${ringId} .score-ring-fill`);
    const numEl = document.querySelector(`#${ringId} .score-num`);
    if (!fill || !numEl) return;

    const circumference = 283; // 2π × r(45)
    const offset = circumference * (1 - score / 100);

    fill.style.stroke = color;
    fill.style.strokeDashoffset = offset;

    // 数字滚动动画
    const start = +numEl.textContent || 0;
    const end   = score;
    const duration = 1000;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      numEl.textContent = Math.round(start + (end - start) * ease);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ─── 更新所有图表（换年份） ───────────────────────────
  function updateYear(year) {
    if (charts['radar-chart']) renderRadarChart('radar-chart', year);
    const score = AnalysisManager.getCompositeScore(year);
    animateScoreRing('score-ring-main', score, '#3b82f6');

    // 更新评分列表
    _updateScoreList(year);
  }

  function _updateScoreList(year) {
    const container = document.getElementById('score-list-container');
    if (!container) return;
    const dims   = AnalysisManager.getDimensionConfig();
    const scores = AnalysisManager.getYearScores(year);

    container.innerHTML = dims.map(d => {
      const v = +scores[d.key].toFixed(0);
      return `
        <div class="score-row">
          <div class="score-row-label">${d.label}</div>
          <div class="score-row-bar">
            <div class="score-row-fill" style="width:${v}%;background:${d.color};"></div>
          </div>
          <div class="score-row-val">${v}</div>
        </div>
      `;
    }).join('');
  }

  // 初始化所有图表
  function init(year = 2026) {
    renderRadarChart('radar-chart', year);
    renderTrendChart('trend-chart');
    renderBarChart('bar-chart', 2020, year);
    const score = AnalysisManager.getCompositeScore(year);
    setTimeout(() => {
      animateScoreRing('score-ring-main', score, '#3b82f6');
      _updateScoreList(year);
    }, 500);
  }

  return { init, updateYear, renderRadarChart, renderTrendChart, renderBarChart, animateScoreRing };
})();
