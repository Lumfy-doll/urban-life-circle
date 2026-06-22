/**
 * ui.js — UI 交互管理：导航切换、面板折叠、吐司、时间轴等
 */

window.UIManager = (function () {
  let _currentModule = 'overview';
  let _currentYear   = 2026;
  let _playInterval  = null;
  const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

  // ─── 初始化 ─────────────────────────────────────────
  function init() {
    _bindNavButtons();
    _bindPanelCollapse();
    _initTimeline();
    _initClock();
    _bindMapClickForAnalysis();
    _bindYearNodes();
    ToastManager.show('平台初始化成功，欢迎使用！', 'success');
  }

  // ─── 导航切换 ────────────────────────────────────────
  function _bindNavButtons() {
    document.querySelectorAll('.nav-btn[data-module]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mod = btn.dataset.module;
        switchModule(mod);
      });
    });
  }

  function switchModule(mod) {
    _currentModule = mod;

    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn[data-module]').forEach(b => {
      b.classList.toggle('active', b.dataset.module === mod);
    });

    // 隐藏所有模块面板
    document.querySelectorAll('.module-panel').forEach(p => p.classList.add('hidden'));

    // 显示当前模块
    const panel = document.getElementById(`panel-${mod}`);
    if (panel) panel.classList.remove('hidden');

    // 模块切换后触发特定逻辑
    switch (mod) {
      case 'overview':
        ChartManager.updateYear(_currentYear);
        break;
      case 'stac':
        STACManager.renderCatalogUI('stac-catalog-container');
        break;
      case 'analysis':
        ToastManager.show('点击地图任意位置进行可达性分析', 'info');
        break;
      case 'monitor':
        _updateMonitorPanel();
        break;
    }
  }

  // ─── 面板折叠 ────────────────────────────────────────
  function _bindPanelCollapse() {
    document.querySelectorAll('.panel-header[data-target]').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const target = document.getElementById(hdr.dataset.target);
        if (!target) return;
        const isCollapsed = target.classList.toggle('hidden');
        hdr.classList.toggle('collapsed', isCollapsed);
      });
    });
  }

  // ─── 时钟 ────────────────────────────────────────────
  function _initClock() {
    const el = document.getElementById('realtime-clock');
    if (!el) return;
    function tick() {
      const now = new Date();
      el.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
    }
    tick();
    setInterval(tick, 1000);
  }

  // ─── 时间轴 ──────────────────────────────────────────
  function _initTimeline() {
    const track = document.getElementById('timeline-track');
    if (!track) return;

    track.addEventListener('click', e => {
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const idx = Math.round(ratio * (YEARS.length - 1));
      selectYear(YEARS[idx]);
    });
  }

  function _bindYearNodes() {
    document.querySelectorAll('.year-node[data-year]').forEach(node => {
      node.addEventListener('click', () => selectYear(+node.dataset.year));
    });
  }

  function selectYear(year) {
    if (!YEARS.includes(year)) return;
    _currentYear = year;

    // 底部年份节点高亮
    document.querySelectorAll('.year-node').forEach(n => {
      n.classList.toggle('active', +n.dataset.year === year);
    });

    // 通知图表更新
    ChartManager.updateYear(year);

    // 更新时间轴进度
    const ratio = YEARS.indexOf(year) / (YEARS.length - 1);
    const progress = document.getElementById('timeline-progress');
    const thumb    = document.getElementById('timeline-thumb');
    if (progress) progress.style.width = `${ratio * 100}%`;
    if (thumb)    thumb.style.left    = `${ratio * 100}%`;
    const curLabel = document.getElementById('timeline-current-label');
    if (curLabel) curLabel.textContent = `${year} 年`;

    ToastManager.show(`当前年份：${year}`, 'info');
  }

  // ─── 播放/暂停 ────────────────────────────────────────
  function togglePlay() {
    const btn = document.getElementById('play-btn');
    if (_playInterval) {
      clearInterval(_playInterval);
      _playInterval = null;
      if (btn) btn.innerHTML = '▶';
    } else {
      if (btn) btn.innerHTML = '⏸';
      let idx = YEARS.indexOf(_currentYear);
      _playInterval = setInterval(() => {
        idx = (idx + 1) % YEARS.length;
        selectYear(YEARS[idx]);
        if (idx === YEARS.length - 1) {
          clearInterval(_playInterval);
          _playInterval = null;
          if (btn) btn.innerHTML = '▶';
        }
      }, 1200);
    }
  }

  // ─── 地图点击触发可达性分析 ─────────────────────────
  function _bindMapClickForAnalysis() {
    document.addEventListener('mapClick', e => {
      const { lon, lat } = e.detail;
      if (_currentModule === 'analysis') {
        const minutes = _getSelectedMinutes();
        AnalysisManager.runAccessibilityAnalysis(+lon, +lat, minutes);
      }
    });
  }

  function _getSelectedMinutes() {
    const el = document.getElementById('iso-minutes-select');
    if (!el) return [5, 10, 15];
    const val = el.value;
    if (val === '10') return [5, 10];
    if (val === '20') return [5, 10, 20];
    if (val === '30') return [5, 15, 30];
    return [5, 10, 15];
  }

  // ─── 监测面板数据更新 ────────────────────────────────
  function _updateMonitorPanel() {
    const dims   = AnalysisManager.getDimensionConfig();
    const scores = AnalysisManager.getYearScores(_currentYear);
    const composite = AnalysisManager.getCompositeScore(_currentYear);

    // 综合指数
    const compEl = document.getElementById('monitor-composite');
    if (compEl) compEl.textContent = composite;

    // 各维度趋势
    const container = document.getElementById('monitor-dimension-list');
    if (!container) return;
    container.innerHTML = dims.map(d => {
      const score = scores[d.key];
      const prevScore = AnalysisManager.getYearScores(Math.max(2020, _currentYear - 1))[d.key];
      const delta = score - prevScore;
      const arrow = delta >= 0 ? '▲' : '▼';
      const cls   = delta >= 0 ? 'up' : 'down';
      return `
        <div class="stat-card" style="padding:10px 12px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:12px;color:var(--color-text-secondary);">${d.label}</span>
            <span style="font-size:11px;" class="${cls}">${arrow} ${Math.abs(delta).toFixed(1)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill fill-blue" style="width:${score}%;background:${d.color};"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;">
            <span style="font-size:11px;color:var(--color-text-muted);">评分</span>
            <span style="font-size:12px;font-weight:700;font-family:var(--font-display);color:var(--color-text-primary);">${score.toFixed(1)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function getCurrentYear()   { return _currentYear; }
  function getCurrentModule() { return _currentModule; }

  return { init, switchModule, selectYear, togglePlay, getCurrentYear, getCurrentModule };
})();

// ═══ 吐司管理器 ═══════════════════════════════════════════
window.ToastManager = (function () {
  const icons = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };

  function show(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${msg}</span>`;
    toast.addEventListener('click', () => remove(toast));
    container.appendChild(toast);

    setTimeout(() => remove(toast), duration);
  }

  function remove(el) {
    if (!el.parentNode) return;
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = '0.3s ease';
    setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 300);
  }

  return { show };
})();
