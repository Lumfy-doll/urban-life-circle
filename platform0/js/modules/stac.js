/**
 * stac.js — STAC (SpatioTemporal Asset Catalog) 标准适配模块
 * 实现 STAC Catalog / Collection / Item 的加载、解析与渲染
 *
 * 空间基准：武汉市主城区（东经113.65°-114.45°，北纬30.25°-30.75°）
 */

window.STACManager = (function () {
  // ─── 本地模拟 STAC Catalog（无服务端时内置） ─────────────
  const MOCK_CATALOG = {
    type: 'Catalog',
    id: 'urban-life-circle-catalog',
    stac_version: '1.0.0',
    title: '城市生活圈多源大数据目录',
    description: '整合城市设施POI、遥感影像、人口热力、路网等多源数据的STAC标准目录',
    links: [
      { rel: 'child', href: '#collection-poi',      title: '设施POI数据集' },
      { rel: 'child', href: '#collection-rs',       title: '遥感影像数据集' },
      { rel: 'child', href: '#collection-heatmap',  title: '人口热力数据集' },
      { rel: 'child', href: '#collection-road',     title: '路网数据集' },
    ],
  };

  // 武汉市主城区空间范围
  const WH_BBOX = [113.65, 30.25, 114.45, 30.75];

  const MOCK_COLLECTIONS = {
    '#collection-poi': {
      type: 'Collection',
      id: 'poi-facilities',
      stac_version: '1.0.0',
      title: '城市设施POI数据集（武汉市）',
      description: '包含医疗、教育、商业、公园、交通等各类设施空间数据，覆盖武汉市主城区七区及高新区/经开区',
      extent: {
        spatial: { bbox: [WH_BBOX] },
        temporal: { interval: [['2019-01-01T00:00:00Z', '2024-12-31T23:59:59Z']] },
      },
      license: 'proprietary',
      providers: [{ name: '高德地图POI开放平台', roles: ['producer'] }],
      links: [],
      summaries: {
        datetime: { minimum: '2019-01-01', maximum: '2024-12-31' },
        'eo:cloud_cover': null,
      },
      items: _buildPOIItems(),
    },
    '#collection-rs': {
      type: 'Collection',
      id: 'remote-sensing-imagery',
      stac_version: '1.0.0',
      title: '遥感影像数据集（武汉市）',
      description: 'Sentinel-2 多时相武汉市遥感影像，空间分辨率10m',
      extent: {
        spatial: { bbox: [WH_BBOX] },
        temporal: { interval: [['2019-01-01T00:00:00Z', '2024-12-31T23:59:59Z']] },
      },
      license: 'proprietary',
      providers: [{ name: 'ESA Copernicus', roles: ['producer'] }],
      links: [],
      items: _buildRSItems(),
    },
    '#collection-heatmap': {
      type: 'Collection',
      id: 'population-heatmap',
      stac_version: '1.0.0',
      title: '人口热力数据集（武汉市）',
      description: '基于手机信令数据生成的武汉市人口时空分布热力图',
      extent: {
        spatial: { bbox: [WH_BBOX] },
        temporal: { interval: [['2020-01-01T00:00:00Z', '2024-12-31T23:59:59Z']] },
      },
      license: 'proprietary',
      providers: [{ name: '移动大数据平台', roles: ['producer'] }],
      links: [],
      items: _buildHeatmapItems(),
    },
    '#collection-road': {
      type: 'Collection',
      id: 'road-network',
      stac_version: '1.0.0',
      title: '路网数据集（武汉市）',
      description: 'OpenStreetMap 武汉市路网矢量数据，支持可达性分析',
      extent: {
        spatial: { bbox: [WH_BBOX] },
        temporal: { interval: [['2024-01-01T00:00:00Z', null]] },
      },
      license: 'ODbL',
      providers: [{ name: 'OpenStreetMap', roles: ['producer'] }],
      links: [],
      items: _buildRoadItems(),
    },
  };

  // ─── 构建模拟 STAC Item 数据 ─────────────────────────────
  function _buildPOIItems() {
    const years = [2019, 2020, 2021, 2022, 2023, 2024];
    const types = ['医疗设施', '教育设施', '商业网点', '公园绿地', '交通枢纽'];
    return years.map(y => ({
      type: 'Feature',
      stac_version: '1.0.0',
      id: `poi-${y}`,
      geometry: { type: 'Polygon', coordinates: [[[WH_BBOX[0],WH_BBOX[1]],[WH_BBOX[2],WH_BBOX[1]],[WH_BBOX[2],WH_BBOX[3]],[WH_BBOX[0],WH_BBOX[3]],[WH_BBOX[0],WH_BBOX[1]]]] },
      bbox: [...WH_BBOX],
      properties: {
        datetime: `${y}-06-01T00:00:00Z`,
        title: `${y}年武汉市设施POI数据`,
        description: `涵盖${types.join('、')}共${(Math.random()*50000+85000).toFixed(0)}条记录`,
        'proj:epsg': 4326,
        'poi:total_count': Math.floor(Math.random() * 50000 + 85000),
        'poi:categories': types,
        'city': '武汉市',
      },
      assets: {
        data: { href: `#poi-data-${y}.geojson`, type: 'application/geo+json', title: 'GeoJSON数据', roles: ['data'] },
        thumbnail: { href: `#thumbnail-poi-${y}.png`, type: 'image/png', title: '缩略图', roles: ['thumbnail'] },
      },
      links: [],
    }));
  }

  function _buildRSItems() {
    return [2020, 2021, 2022, 2023, 2024].map(y => ({
      type: 'Feature',
      stac_version: '1.0.0',
      id: `rs-sentinel2-${y}`,
      geometry: { type: 'Polygon', coordinates: [[[WH_BBOX[0],WH_BBOX[1]],[WH_BBOX[2],WH_BBOX[1]],[WH_BBOX[2],WH_BBOX[3]],[WH_BBOX[0],WH_BBOX[3]],[WH_BBOX[0],WH_BBOX[1]]]] },
      bbox: [...WH_BBOX],
      properties: {
        datetime: `${y}-07-15T02:30:00Z`,
        title: `Sentinel-2 ${y}年武汉市夏季影像`,
        'eo:cloud_cover': Math.random() * 15,
        'eo:bands': [
          { name: 'B02', common_name: 'blue',  center_wavelength: 0.490 },
          { name: 'B03', common_name: 'green', center_wavelength: 0.560 },
          { name: 'B04', common_name: 'red',   center_wavelength: 0.665 },
          { name: 'B08', common_name: 'nir',   center_wavelength: 0.842 },
        ],
        'gsd': 10,
        'platform': 'sentinel-2b',
        'instruments': ['msi'],
      },
      assets: {
        visual: { href: `#s2-${y}-visual.tif`, type: 'image/tiff', title: '真彩色合成', roles: ['visual'] },
        ndvi:   { href: `#s2-${y}-ndvi.tif`,   type: 'image/tiff', title: 'NDVI指数', roles: ['data'] },
      },
      links: [],
    }));
  }

  function _buildHeatmapItems() {
    return [2020, 2021, 2022, 2023, 2024].map(y => ({
      type: 'Feature',
      stac_version: '1.0.0',
      id: `heatmap-${y}`,
      geometry: { type: 'Polygon', coordinates: [[[WH_BBOX[0],WH_BBOX[1]],[WH_BBOX[2],WH_BBOX[1]],[WH_BBOX[2],WH_BBOX[3]],[WH_BBOX[0],WH_BBOX[3]],[WH_BBOX[0],WH_BBOX[1]]]] },
      bbox: [...WH_BBOX],
      properties: {
        datetime: `${y}-01-01T00:00:00Z`,
        title: `${y}年武汉市人口热力数据`,
        'temporal_resolution': 'monthly',
        'spatial_resolution': '500m',
        'data_source': '手机信令',
        'city': '武汉市',
      },
      assets: {
        data: { href: `#heatmap-${y}.json`, type: 'application/json', title: '热力数据', roles: ['data'] },
      },
      links: [],
    }));
  }

  function _buildRoadItems() {
    return [{
      type: 'Feature',
      stac_version: '1.0.0',
      id: 'road-network-2024',
      geometry: { type: 'Polygon', coordinates: [[[WH_BBOX[0],WH_BBOX[1]],[WH_BBOX[2],WH_BBOX[1]],[WH_BBOX[2],WH_BBOX[3]],[WH_BBOX[0],WH_BBOX[3]],[WH_BBOX[0],WH_BBOX[1]]]] },
      bbox: [...WH_BBOX],
      properties: {
        datetime: '2024-01-01T00:00:00Z',
        title: '2024年武汉市路网数据',
        'road_types': ['主干道','次干道','支路','步行路'],
        'total_length_km': 5280,
        'source': 'OpenStreetMap',
        'city': '武汉市',
      },
      assets: {
        data: { href: '#road-network-2024.geojson', type: 'application/geo+json', title: '路网GeoJSON', roles: ['data'] },
      },
      links: [],
    }];
  }

  // ─── 渲染目录树 UI ─────────────────────────────────────
  let _activeCollection = null;
  let _activeItem = null;

  function renderCatalogUI(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="stac-catalog">
        <div class="stat-card" style="margin-bottom:10px;">
          <div class="stat-card-header">
            <span class="stat-card-title">STAC 根目录</span>
            <span class="status-dot" style="background:#06b6d4;box-shadow:0 0 6px #06b6d4;"></span>
          </div>
          <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.6;">
            <div><span class="text-muted font-mono" style="font-size:11px;">id:</span> <span style="color:#06b6d4;">${MOCK_CATALOG.id}</span></div>
            <div><span class="text-muted font-mono" style="font-size:11px;">v:</span> ${MOCK_CATALOG.stac_version}</div>
            <div style="margin-top:6px;font-size:12px;color:var(--color-text-muted);">${MOCK_CATALOG.description}</div>
          </div>
        </div>
        <div class="control-label">数据集 Collections</div>
        ${MOCK_CATALOG.links.map(link => `
          <div class="stac-item" onclick="STACManager.selectCollection('${link.href}')">
            <div class="stac-item-id">📦 ${link.href.replace('#collection-','')}</div>
            <div class="stac-item-meta">${link.title}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function selectCollection(href) {
    _activeCollection = href;
    const col = MOCK_COLLECTIONS[href];
    if (!col) return;

    const container = document.getElementById('stac-items-list');
    if (!container) return;

    container.innerHTML = `
      <div class="control-label" style="display:flex;align-items:center;justify-content:space-between;">
        <span>${col.title}</span>
        <span class="stac-tag">${col.items.length} items</span>
      </div>
      <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;line-height:1.5;">${col.description}</div>
      <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:10px;">
        时间范围：${col.extent.temporal.interval[0][0].slice(0,10)} → ${col.extent.temporal.interval[0][1] ? col.extent.temporal.interval[0][1].slice(0,10) : '至今'}
      </div>
      ${col.items.map(item => `
        <div class="stac-item" id="stac-item-${item.id}" onclick="STACManager.selectItem('${href}', '${item.id}')">
          <div class="stac-item-id">🗂 ${item.id}</div>
          <div class="stac-item-meta">
            ${item.properties.title}<br>
            <span class="text-muted">时间：${item.properties.datetime ? item.properties.datetime.slice(0,10) : 'N/A'}</span>
          </div>
          <div>
            ${Object.keys(item.assets).map(k => `<span class="stac-tag">${k}</span>`).join('')}
          </div>
        </div>
      `).join('')}
    `;

    document.getElementById('stac-items-section').classList.remove('hidden');
    ToastManager.show(`已加载集合：${col.title}`, 'info');
  }

  function selectItem(collectionHref, itemId) {
    const col = MOCK_COLLECTIONS[collectionHref];
    if (!col) return;
    const item = col.items.find(i => i.id === itemId);
    if (!item) return;
    _activeItem = item;

    document.querySelectorAll('.stac-item').forEach(el => el.classList.remove('selected'));
    const el = document.getElementById(`stac-item-${itemId}`);
    if (el) el.classList.add('selected');

    document.dispatchEvent(new CustomEvent('stacItemSelected', { detail: item }));
    ToastManager.show(`已选择：${item.properties.title}`, 'success');
  }

  function getActiveItem() { return _activeItem; }
  function getCatalog()    { return MOCK_CATALOG; }
  function getCollections(){ return MOCK_COLLECTIONS; }

  return { renderCatalogUI, selectCollection, selectItem, getActiveItem, getCatalog, getCollections };
})();
