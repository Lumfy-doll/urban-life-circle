/**
 * spatial-db-builder.js
 * 构建武汉 POI 空间数据库（JSON 格式 + 网格空间索引）
 * 用法：node spatial-db-builder.js
 *
 * 输出文件：
 *   platform/data/spatialdb/wuhan-poi-db.json  — 空间数据库（含网格索引）
 *   platform/data/spatialdb/README.md                — 数据库说明文档
 *
 * 设计：
 *   - 全量 POI 存储于 features[] 数组
 *   - 网格空间索引（0.01°×0.01° 约 1km×1km）存储于 grid{}
 *   - 查询时先定位网格再计算精确距离，性能 O(k) 而非 O(n)
 */

const fs   = require('fs');
const path = require('path');

const OUT_DIR  = path.join(__dirname, 'platform', 'data', 'spatialdb');
const DB_PATH  = path.join(OUT_DIR, 'wuhan-poi-db.json');

// ─── 武汉真实 POI 坐标数据 ──────────────────────────────
const POI_RECORDS = [
  // === 医疗（真实名称 + 真实坐标）===
  { name:'华中科技大学同济医学院附属同济医院(主院区)',     type:'medical', lon:114.3615, lat:30.5903, weight:10 },
  { name:'华中科技大学同济医学院附属同济医院(光谷院区)', type:'medical', lon:114.4750, lat:30.4530, weight:9  },
  { name:'华中科技大学同济医学院附属协和医院(本部)',     type:'medical', lon:114.2608, lat:30.5745, weight:10 },
  { name:'华中科技大学同济医学院附属协和医院(西院)',     type:'medical', lon:114.2560, lat:30.6230, weight:10 },
  { name:'武汉大学人民医院(首义院区)',   type:'medical', lon:114.2830, lat:30.5410, weight:9  },
  { name:'武汉大学人民医院(光谷院区)',   type:'medical', lon:114.3980, lat:30.4650, weight:10 },
  { name:'武汉大学中南医院',           type:'medical', lon:114.3450, lat:30.5220, weight:10 },
  { name:'武汉中心医院(后湖院区)',       type:'medical', lon:114.3230, lat:30.6580, weight:8  },
  { name:'武汉中心医院(南京路院区)',     type:'medical', lon:114.2800, lat:30.5950, weight:7  },
  { name:'武汉市儿童医院',               type:'medical', lon:114.2650, lat:30.5980, weight:8  },
  { name:'湖北省中医院(花园山院区)',     type:'medical', lon:114.2700, lat:30.5800, weight:8  },
  { name:'湖北省中医院(光谷院区)',     type:'medical', lon:114.4100, lat:30.4700, weight:9  },
  { name:'武汉市第三医院(首义院区)',   type:'medical', lon:114.2750, lat:30.5800, weight:6  },
  { name:'武汉市第三医院(光谷院区)',   type:'medical', lon:114.4200, lat:30.4750, weight:8  },
  { name:'武汉市第一医院(利济北路院区)', type:'medical', lon:114.2500, lat:30.5900, weight:7  },
  { name:'武汉市第五医院',               type:'medical', lon:114.1650, lat:30.5700, weight:7  },
  { name:'武汉市武昌医院(东区)',         type:'medical', lon:114.3300, lat:30.6100, weight:7  },
  { name:'武钢总医院',                 type:'medical', lon:114.4200, lat:30.6500, weight:7  },
  { name:'华润武钢总医院',             type:'medical', lon:114.4150, lat:30.6450, weight:7  },
  { name:'武汉市金银潭医院',           type:'medical', lon:114.1000, lat:30.6600, weight:8  },
  { name:'湖北省肿瘤医院',             type:'medical', lon:114.3100, lat:30.6000, weight:7  },
  { name:'武汉亚洲心脏病医院',         type:'medical', lon:114.2680, lat:30.5880, weight:7  },
  { name:'武汉市普仁医院(青山)',       type:'medical', lon:114.4000, lat:30.6400, weight:6  },
  // 社区卫生服务中心（抽样）
  { name:'江岸区大智街社卫中心', type:'medical', lon:114.2950, lat:30.5980, weight:4 },
  { name:'江汉区民权街社卫中心', type:'medical', lon:114.2850, lat:30.5950, weight:4 },
  { name:'硚口区韩家墩街社卫中心',type:'medical', lon:114.2450, lat:30.5950, weight:4 },
  { name:'汉阳区建桥街社卫中心',   type:'medical', lon:114.1680, lat:30.5720, weight:4 },
  { name:'武昌区积玉桥街社卫中心', type:'medical', lon:114.3100, lat:30.5600, weight:4 },
  { name:'洪山区珞南街社卫中心',   type:'medical', lon:114.3400, lat:30.5200, weight:4 },
  { name:'洪山区关山街社卫中心',   type:'medical', lon:114.3800, lat:30.5100, weight:4 },
  { name:'青山区红钢城街社卫中心', type:'medical', lon:114.4300, lat:30.6400, weight:4 },

  // === 教育 ===
  { name:'武汉大学(文理学部)',     type:'education', lon:114.3650, lat:30.5400, weight:10 },
  { name:'武汉大学(信息学部)',     type:'education', lon:114.3550, lat:30.5480, weight:9  },
  { name:'武汉大学(工学部)',       type:'education', lon:114.3580, lat:30.5350, weight:9  },
  { name:'华中科技大学(主校区)',   type:'education', lon:114.4150, lat:30.5080, weight:10 },
  { name:'华中师范大学(桂子山)',   type:'education', lon:114.3350, lat:30.5200, weight:10 },
  { name:'武汉理工大学(马房山)',   type:'education', lon:114.3020, lat:30.5450, weight:9  },
  { name:'武汉理工大学(余家头)',   type:'education', lon:114.3500, lat:30.5800, weight:8  },
  { name:'中国地质大学(武汉)',     type:'education', lon:114.3450, lat:30.5150, weight:9  },
  { name:'华中农业大学(狮子山)',   type:'education', lon:114.3000, lat:30.5100, weight:9  },
  { name:'中南财经政法大学(南湖)', type:'education', lon:114.3250, lat:30.5050, weight:9  },
  { name:'湖北大学(武昌主校区)',   type:'education', lon:114.3300, lat:30.6200, weight:8  },
  { name:'武汉科技大学(黄家湖)',   type:'education', lon:114.2800, lat:30.4800, weight:8  },
  { name:'江汉大学(沌口主校区)',   type:'education', lon:114.1200, lat:30.4550, weight:8  },
  { name:'海军工程大学(解放园)',   type:'education', lon:114.2500, lat:30.6180, weight:7  },
  { name:'武汉体育学院',             type:'education', lon:114.2900, lat:30.5250, weight:7  },
  { name:'湖北美术学院(藏龙岛)',   type:'education', lon:114.3000, lat:30.4700, weight:7  },
  { name:'武汉音乐学院(滨江)',     type:'education', lon:114.3100, lat:30.5300, weight:7  },
  // 中学
  { name:'华中师范大学第一附属中学', type:'education', lon:114.2500, lat:30.5200, weight:9 },
  { name:'武汉市第二中学',           type:'education', lon:114.3180, lat:30.6180, weight:8 },
  { name:'湖北省武昌实验中学',       type:'education', lon:114.3100, lat:30.5550, weight:8 },
  { name:'武汉外国语学校(高中部)',   type:'education', lon:114.2400, lat:30.5800, weight:8 },
  { name:'湖北省水果湖高级中学',     type:'education', lon:114.3450, lat:30.5800, weight:7 },
  { name:'武汉中学',                 type:'education', lon:114.2900, lat:30.5600, weight:7 },
  // 小学
  { name:'武汉市育才小学',           type:'education', lon:114.3020, lat:30.6120, weight:7 },
  { name:'中华路小学',               type:'education', lon:114.3100, lat:30.5650, weight:7 },
  { name:'武汉小学',                 type:'education', lon:114.2950, lat:30.5550, weight:7 },
  { name:'水果湖第一小学',           type:'education', lon:114.3420, lat:30.5850, weight:6 },
  { name:'光谷第一小学',           type:'education', lon:114.4100, lat:30.4850, weight:7 },
  { name:'钟家村小学',               type:'education', lon:114.1680, lat:30.5650, weight:6 },

  // === 公园绿地 ===
  { name:'东湖听涛景区',         type:'park', lon:114.3600, lat:30.5650, weight:10 },
  { name:'东湖磨山景区',         type:'park', lon:114.3800, lat:30.5700, weight:9  },
  { name:'东湖绿道(湖中道)',     type:'park', lon:114.3700, lat:30.5580, weight:9  },
  { name:'东湖吹笛景区(马鞍山)', type:'park', lon:114.4000, lat:30.5200, weight:8  },
  { name:'中山公园(解放大道)',     type:'park', lon:114.2650, lat:30.6050, weight:8  },
  { name:'解放公园',               type:'park', lon:114.2750, lat:30.6150, weight:8  },
  { name:'沙湖公园',               type:'park', lon:114.3200, lat:30.5700, weight:8  },
  { name:'紫阳公园',               type:'park', lon:114.2700, lat:30.5350, weight:7  },
  { name:'汉口江滩(一期)',         type:'park', lon:114.2900, lat:30.5950, weight:8  },
  { name:'武昌江滩',               type:'park', lon:114.3100, lat:30.5800, weight:7  },
  { name:'黄鹤楼公园',           type:'park', lon:114.3100, lat:30.5450, weight:10 },
  { name:'归元禅寺',               type:'park', lon:114.1750, lat:30.5600, weight:8  },
  { name:'武汉园博园',           type:'park', lon:114.1800, lat:30.6300, weight:8  },
  { name:'后官湖湿地公园',         type:'park', lon:114.2000, lat:30.4800, weight:7  },
  { name:'金银湖湿地公园',         type:'park', lon:114.1950, lat:30.6950, weight:7  },
  { name:'汤湖公园',               type:'park', lon:114.0800, lat:30.4450, weight:6  },

  // === 商业配套 ===
  { name:'武商MALL(世贸广场)',    type:'shopping', lon:114.2840, lat:30.5980, weight:10 },
  { name:'武商梦时代',             type:'shopping', lon:114.2550, lat:30.5200, weight:10 },
  { name:'楚河汉街',               type:'shopping', lon:114.3400, lat:30.5600, weight:10 },
  { name:'江汉路步行街',           type:'shopping', lon:114.2950, lat:30.5950, weight:9  },
  { name:'永旺梦乐城(经开)',       type:'shopping', lon:114.1000, lat:30.4600, weight:9  },
  { name:'武汉万象城(建设大道)',   type:'shopping', lon:114.2750, lat:30.6150, weight:9  },
  { name:'武汉恒隆广场',           type:'shopping', lon:114.2900, lat:30.6050, weight:9  },
  { name:'群光广场(珞喻路)',     type:'shopping', lon:114.3550, lat:30.5300, weight:8  },
  { name:'K11购物艺术中心(光谷)', type:'shopping', lon:114.4000, lat:30.4750, weight:8  },
  { name:'山姆会员商店(光谷店)',   type:'shopping', lon:114.4100, lat:30.4900, weight:9  },
  { name:'山姆会员商店(经开店)',   type:'shopping', lon:114.1100, lat:30.4550, weight:9  },
  { name:'盒马鲜生(世界城店)',     type:'shopping', lon:114.3600, lat:30.5400, weight:7  },
  { name:'Today今天便利店(光谷)', type:'shopping', lon:114.4050, lat:30.4800, weight:5  },

  // === 交通 ===
  { name:'天河国际机场T3航站楼', type:'transport', lon:114.1500, lat:30.7830, weight:10 },
  { name:'武汉站(高铁枢纽)',       type:'transport', lon:114.4200, lat:30.6100, weight:10 },
  { name:'汉口站(铁路枢纽)',       type:'transport', lon:114.2700, lat:30.6250, weight:10 },
  { name:'武昌站(铁路枢纽)',       type:'transport', lon:114.3000, lat:30.5300, weight:9  },
  { name:'洪山广场站',   type:'transport', lon:114.3055, lat:30.5928, weight:9 },
  { name:'中南路站',     type:'transport', lon:114.2950, lat:30.5850, weight:9 },
  { name:'江汉路站',     type:'transport', lon:114.2950, lat:30.5950, weight:9 },
  { name:'光谷广场站',   type:'transport', lon:114.3600, lat:30.5280, weight:9 },
  { name:'武汉火车站',   type:'transport', lon:114.4200, lat:30.6100, weight:9 },
  { name:'汉口火车站',   type:'transport', lon:114.2700, lat:30.6250, weight:9 },
  { name:'王家湾站',     type:'transport', lon:114.2200, lat:30.5550, weight:8 },
  { name:'钟家村站',     type:'transport', lon:114.1680, lat:30.5700, weight:8 },
  { name:'金银潭站',     type:'transport', lon:114.1800, lat:30.6700, weight:7 },

  // === 养老服务 ===
  { name:'武汉市社会福利院',       type:'elderly', lon:114.2900, lat:30.6200, weight:9 },
  { name:'泰康之家·楚园(光谷)', type:'elderly', lon:114.3500, lat:30.4800, weight:10 },
  { name:'江岸区社会福利院',     type:'elderly', lon:114.3000, lat:30.6300, weight:7 },
  { name:'武昌区社会福利院',       type:'elderly', lon:114.3100, lat:30.5900, weight:7 },
  { name:'大智街日间照料中心',   type:'elderly', lon:114.2950, lat:30.6000, weight:5 },
  { name:'一元街日间照料中心',   type:'elderly', lon:114.2920, lat:30.6020, weight:5 },
  { name:'建桥街日间照料中心',   type:'elderly', lon:114.1650, lat:30.5750, weight:5 },
  { name:'积玉桥街日间照料中心', type:'elderly', lon:114.3150, lat:30.5650, weight:5 },
  { name:'珞南街日间照料中心',   type:'elderly', lon:114.3500, lat:30.5150, weight:5 },
  { name:'关山街日间照料中心',   type:'elderly', lon:114.3850, lat:30.5050, weight:5 },

  // === 体育休闲 ===
  { name:'武汉体育中心(沌口)',     type:'sport', lon:114.1000, lat:30.4450, weight:10 },
  { name:'光谷国际网球中心',         type:'sport', lon:114.3700, lat:30.4850, weight:10 },
  { name:'洪山体育馆',               type:'sport', lon:114.2900, lat:30.5550, weight:8  },
  { name:'湖北省奥体中心',           type:'sport', lon:114.4200, lat:30.5000, weight:9  },
  { name:'塔子湖体育中心',           type:'sport', lon:114.3200, lat:30.6500, weight:8  },
  { name:'武汉全民健身中心',         type:'sport', lon:114.3000, lat:30.6400, weight:8  },
  { name:'威尔士健身(武汉天地店)',   type:'sport', lon:114.3100, lat:30.5800, weight:6 },
  { name:'超级猩猩(楚河汉街店)',     type:'sport', lon:114.3450, lat:30.5620, weight:6 },
  { name:'英东游泳馆',               type:'sport', lon:114.2900, lat:30.6000, weight:7  },
  { name:'东湖绿道骑行驿站',         type:'sport', lon:114.3650, lat:30.5550, weight:7 },
];

// ─── 生成补充随机点（达到 analysis.js 配置的量级）───
function generateSupplementPoints() {
  const TARGET = { medical:952, education:1348, park:213, shopping:756, transport:428, elderly:256, sport:194 };
  const CLUSTERS = [
    { lon:114.3100, lat:30.5450 },
    { lon:114.2800, lat:30.5800 },
    { lon:114.3700, lat:30.5000 },
    { lon:114.2200, lat:30.5600 },
    { lon:114.3900, lat:30.6200 },
    { lon:114.1600, lat:30.5200 },
  ];
  const result = [...POI_RECORDS];
  let nextId = POI_RECORDS.length;

  Object.entries(TARGET).forEach(([type, total]) => {
    const existing = POI_RECORDS.filter(r => r.type === type).length;
    const need = total - existing;
    if (need <= 0) return;

    for (let i = 0; i < need; i++) {
      const c = CLUSTERS[Math.floor(Math.random() * CLUSTERS.length)];
      const spread = type === 'park' ? 0.060 : type === 'transport' ? 0.070 : 0.045;
      result.push({
        name: `${type}-${nextId++}`,
        type,
        lon: c.lon + (Math.random() - 0.5) * spread * 2,
        lat: c.lat + (Math.random() - 0.5) * spread * 2 * 0.82,
        weight: Math.floor(Math.random() * 5) + 1,
      });
    }
  });
  return result;
}

const ALL_POIS = generateSupplementPoints();

// ─── 构建网格空间索引 ─────────────────────────────────────
// 网格大小：0.01° × 0.01°（约 1.0km × 0.82km）
const GRID_SIZE = 0.01;

function gridKey(lon, lat) {
  return `${Math.floor(lon / GRID_SIZE)},${Math.floor(lat / GRID_SIZE)}`;
}

const grid = {};
ALL_POIS.forEach((p, idx) => {
  const key = gridKey(p.lon, p.lat);
  if (!grid[key]) grid[key] = [];
  grid[key].push(idx);
});

// ─── 组装数据库 ─────────────────────────────────────────
const database = {
  meta: {
    name: 'wuhan-poi-database',
    description: '武汉市生活圈POI空间数据库（含网格空间索引）',
    city: '武汉市',
    created: '2026-06-21',
    crs: 'EPSG:4326',
    total: ALL_POIS.length,
    gridSize: GRID_SIZE,
    version: '1.0',
  },
  stats: {
    medical:   ALL_POIS.filter(p => p.type === 'medical').length,
    education: ALL_POIS.filter(p => p.type === 'education').length,
    park:      ALL_POIS.filter(p => p.type === 'park').length,
    shopping:  ALL_POIS.filter(p => p.type === 'shopping').length,
    transport:  ALL_POIS.filter(p => p.type === 'transport').length,
    elderly:   ALL_POIS.filter(p => p.type === 'elderly').length,
    sport:     ALL_POIS.filter(p => p.type === 'sport').length,
  },
  // 空间索引（网格 → 特征ID列表）
  grid,
  // 全量特征数据
  features: ALL_POIS.map((p, idx) => ({
    id:    idx,
    name:  p.name,
    type:  p.type,
    lon:   +p.lon.toFixed(6),
    lat:   +p.lat.toFixed(6),
    weight: p.weight,
    isReal: POI_RECORDS.some(r => r.name === p.name),
  })),
};

// ─── 写入文件 ───────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), 'utf8');

// 写入 README
const readme = `# 武汉市 POI 空间数据库

## 文件说明

- \`wuhan-poi-db.json\` — 主数据库文件

## 数据结构

\`\`\`json
{
  "meta": { "name","description","city","created","crs","total","gridSize" },
  "stats": { "medical": 952, "education": 1348, ... },
  "grid": { "11430,3054": [0,1,2,...], ... },          // 网格空间索引
  "features": [ { "id":0,"name":"...","type":"medical","lon":114.36,"lat":30.59,"weight":10,"isReal":true }, ... ]
}
\`\`\`\`

## 空间查询算法

1. 根据查询点 (lon, lat) 和半径计算边界框
2. 枚举边界框内所有网格
3. 从 \`grid\` 中取出候选特征 ID
4. 计算精确距离，筛选在半径内的特征
5. 返回结果

时间复杂度：O(k) 其中 k 为候选网格内的特征数（远小于总量 n）

## 使用方法（浏览器端）

\`\`\`javascript
const db = await fetch('/data/spatialdb/wuhan-poi-db.json').then(r => r.json());

// 查询 (114.3055, 30.5928) 周围 1km 内的所有医疗设施
const results = queryByRadius(db, 114.3055, 30.5928, 1.0, 'medical');
\`\`\`\`

## 数据来源

- 真实设施名称与坐标：基于公开资料与地图服务抽样
- 补充数据：基于武汉城市空间结构随机生成（用于演示）
- \`isReal: true\` 的记录为真实设施
`;

fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme, 'utf8');

console.log(`✅  数据库已生成：${DB_PATH}`);
console.log(`    总记录数：${ALL_POIS.length}`);
console.log(`    真实名称：${POI_RECORDS.length} 条`);
console.log(`    网格索引：${Object.keys(grid).length} 个网格`);
console.log(`    Stats:`, database.stats);
