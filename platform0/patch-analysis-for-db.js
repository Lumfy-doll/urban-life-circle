/**
 * patch-analysis-for-db.js
 * 给 02_武汉版_空间数据库 的 analysis.js 打补丁：
 *   1. 在 CITY_CENTER 后插入空间数据库加载与网格查询函数
 *   2. 修改 _countFacilitiesInRange 优先走空间数据库
 *   3. 在 runAccessibilityAnalysis 首次执行时自动加载数据库
 *
 * 用法：node patch-analysis-for-db.js
 */

const fs   = require('fs');
const path = require('path');

const TARGET = path.join(
  'D:','桌面','城市可达性','02_武汉版_空间数据库',
  'platform','js','modules','analysis.js'
);

let c = fs.readFileSync(TARGET, 'utf8');

// ─── 1. 在 CITY_CENTER 那行后插入空间数据库代码 ──────────────────
const insertBlock = `
  // ─── 空间数据库（wuahn-poi-db.json）─────────────────────────────
  let _spatialDB = null;
  let _spatialDBLoaded = false;

  /**
   * 加载空间数据库（含网格空间索引）
   * 首次调用时自动 fetch，之后直接返回缓存
   */
  async function _loadSpatialDB() {
    if (_spatialDBLoaded) return _spatialDB;
    try {
      const resp = await fetch('/data/spatialdb/wuhan-poi-db.json');
      _spatialDB = await resp.json();
      _spatialDBLoaded = true;
      console.log('[空间数据库] ✅ 已加载：' + _spatialDB.meta.total + ' 条 POI，' + Object.keys(_spatialDB.grid).length + ' 个网格');
    } catch (e) {
      console.warn('[空间数据库] ⚠️ 加载失败，使用内置缓存：', e.message);
      _spatialDB = null;
    }
    return _spatialDB;
  }

  /**
   * 基于网格空间索引的范围查询
   * 时间复杂度 O(k)（k<<n），而非遍历全量 O(n)
   *
   * @param {number} lon         查询点经度
   * @param {number} lat         查询点纬度
   * @param {number} radiusKm   搜索半径（km）
   * @param {string|null} type  设施类型过滤（null=不过滤）
   * @returns {{count:number, nearest:number|null, features:Array}}
   */
  function _querySpatialDB(lon, lat, radiusKm, type) {
    if (!_spatialDB) return null;
    const GRID_SIZE = _spatialDB.meta.gridSize;
    const degPerKm  = 1 / 111;
    const radiusDeg = radiusKm * degPerKm;

    const minLon = lon - radiusDeg;
    const maxLon = lon + radiusDeg;
    const minLat = lat - radiusDeg;
    const maxLat = lat + radiusDeg;

    const minGX = Math.floor(minLon / GRID_SIZE);
    const maxGX = Math.floor(maxLon / GRID_SIZE);
    const minGY = Math.floor(minLat / GRID_SIZE);
    const maxGY = Math.floor(maxLat / GRID_SIZE);

    const candIds = new Set();
    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gy = minGY; gy <= maxGY; gy++) {
        const key = gx + ',' + gy;
        if (_spatialDB.grid[key]) {
          _spatialDB.grid[key].forEach(function (id) { candIds.add(id); });
        }
      }
    }

    let count = 0;
    let nearest = Infinity;
    const matched = [];

    candIds.forEach(function (id) {
      const f = _spatialDB.features[id];
      if (type && f.type !== type) return;
      const dx = (f.lon - lon) / degPerKm;
      const dy = (f.lat - lat) / degPerKm;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radiusKm) {
        count++;
        if (dist < nearest) nearest = dist;
        matched.push(f);
      }
    });

    return {
      count:    count,
      nearest:  nearest === Infinity ? null : Math.round(nearest * 1000),
      features: matched,
    };
  }
`;

const marker = 'const POI_CONFIG';
const pos = c.indexOf(marker);
if (pos === -1) { console.error('❌ 找不到插入点'); process.exit(1); }

c = c.slice(0, pos) + insertBlock + '\n' + c.slice(pos);
console.log('✅ 空间数据库函数已插入');

// ─── 2. 修改 _countFacilitiesInRange 优先走空间数据库 ─────────────
const oldFunc = 'function _countFacilitiesInRange(centerLon, centerLat, radiusKm, facilityType) {\n' +
  '    const pts = _poiCache[facilityType] || [];\n' +
  '    let count = 0;\n' +
  '    let nearestDist = Infinity;\n' +
  '    const degPerKm = 1 / 111;\n\n' +
  '    pts.forEach(pt => {\n';

const newFunc = 'function _countFacilitiesInRange(centerLon, centerLat, radiusKm, facilityType) {\n' +
  '    // ★★★ 优先使用空间数据库精确查询 ★★★\n' +
  '    const dbResult = _querySpatialDB(centerLon, centerLat, radiusKm, facilityType);\n' +
  '    if (dbResult) {\n' +
  '      return { count: dbResult.count, nearestDist: dbResult.nearest };\n' +
  '    }\n' +
  '    // 数据库不可用时回退到内置缓存\n' +
  '    const pts = _poiCache[facilityType] || [];\n' +
  '    let count = 0;\n' +
  '    let nearestDist = Infinity;\n' +
  '    const degPerKm = 1 / 111;\n\n' +
  '    pts.forEach(pt => {\n';

if (c.indexOf(oldFunc) !== -1) {
  c = c.split(oldFunc).join(newFunc);
  console.log('✅ _countFacilitiesInRange 已改为优先走空间数据库');
} else {
  console.log('⚠️  _countFacilitiesInRange 函数签名未找到（可能已改动），请手动检查');
}

// ─── 3. 在 runAccessibilityAnalysis 开头加入自动加载数据库 ───
const oldRun = 'function runAccessibilityAnalysis(lon, lat, minutes = [5, 10, 15]) {\n' +
  '    // ★★★ 有效范围检测 ★★★\n' +
  '    const rangeCheck = _checkValidRange(Number(lon), Number(lat));';

const newRun = 'function runAccessibilityAnalysis(lon, lat, minutes = [5, 10, 15]) {\n' +
  '    // ★★★ 自动加载空间数据库（首次点击时异步加载）★★★\n' +
  '    if (!_spatialDBLoaded) {\n' +
  '      _loadSpatialDB();  // 不阻塞分析，后台加载\n' +
  '    }\n\n' +
  '    // ★★★ 有效范围检测 ★★★\n' +
  '    const rangeCheck = _checkValidRange(Number(lon), Number(lat));';

if (c.indexOf(oldRun) !== -1) {
  c = c.split(oldRun).join(newRun);
  console.log('✅ runAccessibilityAnalysis 已加入自动加载数据库');
} else {
  console.log('⚠️  runAccessibilityAnalysis 签名未找到，请手动检查');
}

// ─── 4. 语法检查 ─────────────────────────────────────────────────
try {
  new Function(c);
  console.log('✅ 语法检查通过');
} catch (e) {
  console.error('❌ 语法错误：', e.message);
  process.exit(1);
}

// ─── 5. 写入文件 ───────────────────────────────────────────────────
fs.writeFileSync(TARGET, c, 'utf8');
console.log('✅  ' + TARGET + '  已更新');
console.log('');
console.log('改动摘要：');
console.log('  1. 新增 _loadSpatialDB()  — 加载 wuhan-poi-db.json');
console.log('  2. 新增 _querySpatialDB()  — 网格索引精确查询');
console.log('  3. _countFacilitiesInRange 优先走数据库，回退到缓存');
console.log('  4. runAccessibilityAnalysis 首次执行时自动加载数据库');
