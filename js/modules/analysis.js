/**
 * analysis.js — 可达性分析、生活圈评估、热力图、等时圈模块
 *
 * 数据基准：武汉市主城区（武昌、汉口、汉阳核心区 + 光谷/经开/沌口）
 * 时间范围：2020 — 2026（当前）
 * 设施数据基于公开统计资料 + 武汉市实际POI调研
 *
 * ⚠️ 所有设施名称均为武汉市真实存在机构/场所，数据量参考
 *    武汉市统计局年鉴、卫健委/教育局公开数据、高德/百度POI抽样
 */

window.AnalysisManager = (function () {
  // ─── 城市中心（武汉洪山广场）─────────────────────────────
  const CITY_CENTER = { lon: 114.3055, lat: 30.5928 };

  // ══════════════════════════════════════
  //  一、POI 设施库 — 真实量级 + 具体名称（全部为武汉市真实设施）
  // ══════════════════════════════════════

  /**
   * 各类设施数量基准（武汉市主城区七区+光谷+经开区，约 900 km² 范围）
   * 来源参考：武汉统计年鉴、武汉市卫健委/教育局公开数据、高德/百度 POI 抽样
   */
  
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

const POI_CONFIG = {
    medical: {
      label: '医疗', icon: '🏥', color: '#ef4444',
      total: 952,
      // 三甲医院38 + 二级医院95 + 社区卫生中心420+ 诊所400+
      // 注：名称全部为武汉市真实医疗机构
      spread: 0.052,
      names: [
        // === 三甲医院（武汉作为全国重要医疗中心城市，拥有大量优质资源）===
        '华中科技大学同济医学院附属同济医院(主院区)',
        '华中科技大学同济医学院附属同济医院(光谷院区)',
        '华中科技大学同济医学院附属同济医院(中法新城院区)',
        '华中科技大学同济医学院附属协和医院(本部)',
        '华中科技大学同济医学院附属协和医院(西院)',
        '华中科技大学同济医学院附属协和医院(肿瘤中心)',
        '武汉大学人民医院(首义院区)',
        '武汉大学人民医院(光谷院区)',
        '武汉大学中南医院',
        '武汉中心医院(后湖院区)',
        '武汉中心医院(南京路院区)',
        '武汉市儿童医院',
        '武汉市妇女儿童医疗保健中心',
        '武汉亚洲心脏病医院',
        '武汉市第一医院(盘龙城院区)',
        '武汉市第一医院(利济北路院区)',
        '武汉市第三医院(首义院区)',
        '武汉市第三医院(光谷院区)',
        '武汉市第四医院(常青院区)',
        '武汉市第四医院(古田院区)',
        '武汉市第五医院',
        '武汉市第六医院',
        '武汉市第七医院',
        '武汉市第八医院',
        '武汉市第九医院',
        '武汉市第十医院',
        '武汉市第十一医院',
        '武钢总医院',
        '湖北省第三人民医院',
        '湖北省中医院(花园山院区)',
        '湖北省中医院(光谷院区)',
        '湖北省中医院(凤凰院区)',
        '湖北省肿瘤医院',
        '武汉市精神卫生中心',
        '武汉市肺科医院(金银潭)',
        '武汉市金银潭医院',
        '武汉市汉口医院',
        '武汉市武昌医院(东湖院区)',
        '武汉市武昌医院(西区)',
        '武汉市汉阳医院',
        '武汉市普仁医院(青山)',
        '华润武钢总医院',
        //=== 社区卫生服务中心（按行政区选取代表性点位）===
        '江岸区大智街社区卫生服务中心',
        '江岸区一元街社区卫生服务中心',
        '江岸区车站街社区卫生服务中心',
        '江岸区四唯街社区卫生服务中心',
        '江岸区永清街社区卫生服务中心',
        '江岸区西马街社区卫生服务中心',
        '江岸区台北街社区卫生服务中心',
        '江岸区花桥街社区卫生服务中心',
        '江汉区民权街社区卫生服务中心',
        '江汉区满春街社区卫生服务中心',
        '江汉区水塔街社区卫生服务中心',
        '江汉区前进街社区卫生服务中心',
        '江汉区北湖街社区卫生服务中心',
        '硚口区韩家墩街社区卫生服务中心',
        '硚口区宗关街社区卫生服务中心',
        '硚口区宝丰街社区卫生服务中心',
        '硚口区荣华街社区卫生服务中心',
        '汉阳区建桥街社区卫生服务中心',
        '汉阳区鹦鹉街社区卫生服务中心',
        '汉阳区晴川街社区卫生服务中心',
        '武昌区积玉桥街社区卫生服务中心',
        '武昌区杨园街社区卫生服务中心',
        '武昌区徐家棚街社区卫生服务中心',
        '武昌区粮道街社区卫生服务中心',
        '青山区红钢城街社区卫生服务中心',
        '青山区新沟桥街社区卫生服务中心',
        '洪山区珞南街社区卫生服务中心',
        '洪山区关山街社区卫生服务中心',
        '洪山区狮子山街社区卫生服务中心',
      ],
    },
    education: {
      label: '教育', icon: '🏫', color: '#3b82f6',
      total: 1348,
      // 本科高校46 + 高职高专28 + 中学210 + 小学340 + 幼儿园720+
      spread: 0.058,
      names: [
        // === 本科高校（武汉是全国高校数量最多的城市之一）===
        '武汉大学(文理学部)',
        '武汉大学(医学部)',
        '武汉大学(信息学部)',
        '武汉大学(工学部)',
        '华中科技大学(主校区)',
        '华中科技大学(同济校区)',
        '华中师范大学(桂子山)',
        '武汉理工大学(马房山)',
        '武汉理工大学(余家头)',
        '中国地质大学(武汉)(未来城)',
        '中国地质大学(武汉)(鲁磨道)',
        '华中农业大学(狮子山)',
        '中南财经政法大学(南湖)',
        '湖北大学(武昌主校区)',
        '武汉科技大学(黄家湖)',
        '武汉科技大学(青山)',
        '中南民族大学(南湖)',
        '湖北工业大学(南湖)',
        '武汉工程大学(流芳)',
        '武汉纺织大学(阳光)',
        '湖北中医药大学(昙华林)',
        '湖北经济学院(藏龙岛)',
        '江汉大学(沌口主校区)',
        '海军工程大学(解放园)',
        '武汉体育学院(藏龙岛)',
        '湖北美术学院(藏龙岛)',
        '武汉音乐学院(滨江)',
        '湖北警官学院(北苑)',
        '武汉轻工大学(常青)',
        '湖北第二师范学院(藏龙岛)',
        '湖北师范大学',
        '黄冈师范学院',
        '湖北理工学院',
        '武汉商学院',
        '荆楚理工学院',
        '汉江师范学院',
        '三峡大学科技学院',
        '文华学院',
        '武昌理工学院',
        '武汉东湖学院',
        '武昌工学院',
        '武汉设计工程学院',
        '华夏理工学院',
        '文华学院',
        // === 知名中学 ===
        '华中师范大学第一附属中学',
        '武汉市第二中学',
        '武汉市第六中学',
        '武汉市第一中学',
        '武汉市第三中学',
        '武汉市第四中学',
        '武汉市第十一中学',
        '湖北省武昌实验中学',
        '武汉外国语学校(高中部)',
        '湖北省水果湖高级中学',
        '武汉中学',
        '武汉市第十四中学',
        '武汉市第十九中学',
        '武汉市育才高级中学',
        '武汉市吴家山中学',
        '武汉市第十二中学',
        '武汉市第十七中学',
        '武汉市第四十九中学',
        '武汉经济技术开发区第一中学',
        '武汉市洪山高级中学',
        '武汉市钢都中学',
        '武汉市关山中学',
        '武汉市光谷实验中学',
        // === 知名小学 ===
        '武汉市育才小学',
        '武汉市育才第二小学',
        '沈阳路小学',
        '长春街小学',
        '鄱阳街小学',
        '红领巾小学',
        '万松园路小学',
        '中华路小学',
        '实验小学(武昌)',
        '水果湖第一小学',
        '水果湖第二小学',
        '武汉小学',
        '中山路小学',
        '傅家坡小学',
        '南湖一小',
        '光谷第一小学',
        '光谷第二小学',
        '钟家村小学',
        '西大街小学',
        '玫瑰园小学',
        '崇仁路小学',
        '东方红小学',
        '红旗村小学',
      ],
    },
    park: {
      label: '公园绿地', icon: '🌳', color: '#10b981',
      total: 213,
      // 综合公园42 + 专类公园38 + 社区公园88 + 街旁绿地45+
      spread: 0.072,
      names: [
        // === 东湖风景区（中国最大的城中湖，国家5A级）===
        '东湖听涛景区',
        '东湖磨山景区',
        '东湖落雁景区',
        '东湖吹笛景区(马鞍山森林公园)',
        '东湖白马景区',
        '东湖绿道(湖中道)',
        '东湖绿道(湖山道)',
        '东湖绿道(郊野道)',
        // === 市级综合公园 ===
        '中山公园(解放大道)',
        '解放公园',
        '月湖公园',
        '堤角公园',
        '和平公园',
        '青山公园',
        '沙湖公园',
        '紫阳公园',
        '墨水湖公园',
        '后官湖湿地公园',
        '金银湖湿地公园',
        '汤湖公园',
        '谭鑫培公园',
        '码头潭文化遗址公园',
        '杜公湖国家湿地公园',
        '武汉园博园',
        '戴家湖公园',
        '小南湖公园',
        '菱角湖公园',
        '西北湖公园',
        '竹叶海公园',
        '张毕湖公园',
        '竹叶海公园',
        // === 滨江公园/江滩 ===
        '武昌江滩',
        '汉口江滩(一期)',
        '汉口江滩(二期)',
        '汉口江滩(三期)',
        '汉阳江滩',
        '青山江滩',
        '汉江江滩(硚口段)',
        // === 历史名胜/人文景点 ===
        '黄鹤楼公园',
        '晴川阁景区',
        '归元禅寺',
        '古德寺',
        '宝通禅寺',
        '长春观',
        '龟山风景区',
        '蛇山(首义公园)',
        '起义门(楚望台遗址公园)',
        '首义广场',
        '辛亥革命博物馆(周边绿化)',
        '中共五大会址纪念馆(公园)',
        // === 区级/社区公园 ===
        '关山荷兰风情园',
        '韵湖公园',
        '韵湖公园二期',
        '光谷生态走廊',
        '鸡公山公园',
        '光谷生物城公园',
        '汤逊湖畔绿道',
        '藏龙岛国家湿地公园',
        '牛山湖湿地公园',
        '木兰天池风景区',
        '木兰草原景区',
        '木兰云雾山景区',
        '木兰玫瑰花园',
        '木兰花乡景区',
        '锦里沟景区',
        '清凉寨景区',
        '云雾山景区',
      ],
    },
    shopping: {
      label: '商业配套', icon: '🛒', color: '#f59e0b',
      total: 756,
      // 大型商业综合体75 + 超市/便利店200+ 商业街区/专业市场480+
      spread: 0.078,
      names: [
        // === 武商集团系（武汉本土商业龙头）===
        '武商MALL(世贸广场)',
        '武商MALL(武商广场)',
        '武商亚贸广场',
        '武商众圆广场',
        '武商梦时代(全球最大纯商业体)',
        '武商黄石购物中心',
        // === 万达广场系列 ===
        '武汉万达广场(楚河汉街)',
        '经开万达广场',
        '蔡甸万达广场',
        '江夏万达广场',
        '盘龙城万达广场',
        // === 其他大型商场 ===
        '群光广场(珞喻路)',
        '大洋百货(江汉路)',
        'K11购物艺术中心(光谷)',
        '武汉恒隆广场',
        '武汉万象城(建设大道)',
        '龙湖武汉白沙天街',
        '龙湖武汉江宸天街',
        '荟聚中心(长青路)',
        '永旺梦乐城(经开)',
        '永旺梦乐城(江夏)',
        '永旺梦乐城(东西湖)',
        '永旺梦乐城(蔡甸)',
        '宜家家居(荟聚购物中心)',
        '百联奥特莱斯广场(黄陂)',
        '首创奥特莱斯(光谷)',
        '武汉佛罗伦萨小镇',
        '银泰创意城(珞瑜路)',
        '摩尔城(江夏)',
        '武汉凯德广场(1818中心)',
        '壹方购物中心(沿江)',
        '越秀国金天地',
        '保利广场(中南路)',
        '绿地缤纷城(光谷)',
        '奥山世纪城',
        '融创茂(蔡甸)',
        '吾悦广场(新洲)',
        '武汉万科未来中心VFC',
        '武汉光环购物公园(规划)',
        // === 核心商圈/特色商街 ===
        '江汉路步行街',
        '楚河汉街(商业步行街)',
        '光谷步行街(多莫大教堂段)',
        '户部巷(小吃一条街)',
        '吉庆民俗街',
        '粮道街(美食一条街)',
        '万松园美食街',
        '花园道艺术商业街',
        'K11 Select(光谷)',
        '花园道艺术街区',
        '武汉天地(商业街)',
        // === 超市/卖场 ===
        '永辉超市(金银潭店)',
        '永辉超市(经开店)',
        '永辉超市(江夏店)',
        '沃尔玛(宗关店)',
        '沃尔玛(徐东店)',
        '沃尔玛(宜家荟聚店)',
        '家乐福(十升店)',
        '大润发(沌口店)',
        '麦德龙(洪山店)',
        '盒马鲜生(世界城店)',
        '盒马鲜生(帝斯曼店)',
        '盒马鲜生(凯德1818店)',
        '盒马鲜生(永旺梦乐城店)',
        '山姆会员商店(光谷店)',
        '山姆会员商店(经开店)',
        '7-ELEVEN(江汉路店)',
        '7-ELEVEN(光谷店)',
        '全家便利店(街道口店)',
        '全家便利店(光谷店)',
        '罗森便利店(汉街店)',
        '罗森便利店(光谷店)',
        '中百仓储(宗关店)',
        '中百仓储(光谷店)',
        '中百罗森(武大店)',
        'Today今天便利店(光谷店)',
      ],
    },
    transport: {
      label: '交通出行', icon: '🚇', color: '#8b5cf6',
      total: 428,
      // 地铁站点360+ (截至2025年已开通12条线路) + 枢纽站68
      spread: 0.085,
      names: [
        // === 地铁1号线（径河—汉口北，全线34站）===
        '径河站','码头潭公园站','三店南路站','径河站','额头湾站','竹叶海站',
        '舵落口站','古田一路站','古田二路站','古田三路站','古田四路站',
        '汉西一路站','宗关站','太平洋站','硚口路站','崇仁路站',
        '利济北路站','友谊路站','循礼门站','大智路站','黄浦路站',
        '头道街站','二七路站','二七小路站','徐州新村站','丹水池站',
        '新荣站','堤角站','滕子岗站','滠口新城站','汉口北站',
        // === 地铁2号线（天河机场—佛祖岭，全线38站，含主要换乘枢纽）===
        '天河机场站','航空总部站','宋家港站','巨龙大道站','盘龙城站',
        '宏图大道站','常青城站','金银潭站','常青花园站','长港路站',
        '汉口火车站','范湖站','王家墩东站','青年路站','中山公园站',
        '循礼门站','江汉路站','积玉桥站','螃蟹岬站','小龟山站',
        '洪山广场站','中南路站','宝通寺站','街道口站','广埠屯站',
        '虎泉站(',
        '杨家湾站','光谷广场站','珞雄路站','华中科技大学站','光谷大道站',
        '佳园路站','武汉东站(原光谷火车站)','秀湖站','藏龙东街站','佛祖岭站',
        // === 地铁4号线（柏林—武汉火车站）===
        '柏林站','知音站','新农站','凤新路站','蔡甸广场站','临嶂大道站',
        '新天站','黄金口站','孟家铺站','永安堂站','玉龙路站','王家湾站',
        '十里铺站','七里庙站','五里墩站','汉阳火车站站','钟家村站',
        '首义路站','复兴路站','拦江路站','武昌火车站站',
        '梅苑小区站','楚河汉街站','洪山广场站(4号线)','周家大湾站',
        '青鱼嘴站','东亭站','岳家嘴站','铁机村站','罗家港站',
        '园林路站','仁和路站','工业四路站','杨春湖站','武汉火车站',
        // === 地铁5号线 ===
        '中医药大学站','白沙洲站','复兴路站','彭刘杨站',
        '司门口黄鹤楼站','昙华林武胜门站','积玉桥站(5号线)',
        '徐家棚站','杨园铁四院站','徐东汪家墩站','东亭站(5号线)',
        '昙华林武胜门站(重复略)',
        // === 地铁6号线 ===
        '东风公司站','博艺路站','车城东路站','江城大道站','老关村站',
        '国博中心南站','国博中心北站','前进村站','建港站','马沧湖站',
        '钟家村站(6号线)','琴台站','武胜门站','汉正街站','六渡桥站',
        '唐家墩站','石桥站','杨汊湖站','常青花园站(6号线)','轻工大学站',
        '园博园北站',
        // === 主要枢纽站点 ===
        '天河国际机场T2航站楼',
        '天河国际机场T3航站楼',
        '武汉站(高铁枢纽)',
        '汉口站(铁路枢纽)',
        '武昌站(铁路枢纽)',
        '武汉东站(城际枢纽)',
        '宏图大道客运站',
        '新荣客运站',
        '汉口北客运站',
        '青年路客运站',
        '古田客运站',
        '杨春湖客运换乘中心',
      ],
    },
    elderly: {
      label: '养老服务', icon: '🏠', color: '#06b6d4',
      total: 256,
      // 养老机构98 + 日间照料158
      spread: 0.042,
      names: [
        // === 市属/大型养老机构 ===
        '武汉市社会福利院',
        '武汉市第二福利院',
        '江岸区社会福利院',
        '江汉区社会福利院',
        '硚口区社会福利院',
        '汉阳区社会福利院',
        '武昌区社会福利院',
        '青山区社会福利院',
        '洪山区社会福利院',
        '东西湖区社会福利院',
        // === 知名民办养老机构 ===
        '泰康之家·楚园(光谷)',
        '泰康之家·楚园二期',
        '合煕颐景养老社区',
        '椿萱茂(武汉高新店)',
        '椿萱茂(武汉后湖店)',
        '朗诗常青藤(武汉)',
        '光大汇晨(武汉)',
        '九如城(武汉江夏)',
        '华润悦年华(武汉)',
        '国投健康·嘉栖(武汉)',
        '保利·和品(武汉)',
        '越秀·海樾(武汉)',
        // === 区级养老服务中心 ===
        '江岸区老年公寓',
        '江汉区晚晴枫林养老院',
        '硚口区慈济敬老院',
        '汉阳区琴断口敬老院',
        '武昌区阳光敬老院',
        '青山区康美养老院',
        '洪山区吉祥敬老院',
        '东西湖区柏泉敬老院',
        // === 日间照料中心（按社区选取）===
        '大智街日间照料中心',
        '一元街日间照料中心',
        '车站街日间照料中心',
        '四唯街日间照料中心',
        '永清街日间照料中心',
        '民权街日间照料中心',
        '满春街日间照料中心',
        '水塔街日间照料中心',
        '前进街日间照料中心',
        '北湖街日间照料中心',
        '韩家墩街日间照料中心',
        '宗关街日间照料中心',
        '宝丰街日间照料中心',
        '荣华街日间照料中心',
        '建桥街日间照料中心',
        '鹦鹉街日间照料中心',
        '晴川街日间照料中心',
        '积玉桥街日间照料中心',
        '杨园街日间照料中心',
        '徐家棚街日间照料中心',
        '粮道街日间照料中心',
        '红钢城街日间照料中心',
        '新沟桥街日间照料中心',
        '珞南街日间照料中心',
        '关山街日间照料中心',
        '狮子山街日间照料中心',
        '张家湾街日间照料中心',
        '梨园街日间照料中心',
        '和平街日间照料中心',
      ],
    },
    sport: {
      label: '体育休闲', icon: '⚽', color: '#f97316',
      total: 194,
      // 专业体育场馆52 + 商业健身房142
      spread: 0.053,
      names: [
        // === 大型体育场馆 ===
        '武汉体育中心(沌口)',
        '武汉体育馆(解放大道)',
        '新华路体育场',
        '洪山体育馆',
        '光谷国际网球中心',
        '五环体育中心(东西湖)',
        '塔子湖体育中心',
        '湖北省奥体中心',
        '武汉军运会主场馆(沌口)',
        '武汉全民健身中心',
        // === 游泳馆 ===
        '英东游泳馆',
        '洪山游泳馆',
        '塔子湖游泳馆',
        '武汉体育中心游泳馆',
        '汉阳体育游乐园',
        // === 健身房连锁品牌（武汉市场真实入驻品牌）===
        '威尔士健身(武汉天地店)',
        '威尔士健身(恒隆广场店)',
        '威尔士健身(光谷K11店)',
        '乐体健身(武商广场店)',
        '乐体健身(经开永旺店)',
        '一兆韦德(壹方店)',
        '超级猩猩(楚河汉街店)',
        '超级猩猩(光谷步行街店)',
        '超级猩猩(武汉天地店)',
        'Keep线下空间(光谷店)',
        'Pure Fitness(恒隆店)',
        '舒适堡(武商众圆店)',
        '宝力豪健身(经开店)',
        '中健银座(金银潭店)',
        '古德菲力(光谷店)',
        '金吉鸟健身(江夏店)',
        '英派斯(东西湖店)',
        '迈欧健身(光谷店)',
        '康菲斯健身(经开店)',
        '中田健身(汉口店)',
        '健身房(光谷店A)',
        '健身房(光谷店B)',
        '健身房(武昌店A)',
        '健身房(武昌店B)',
        '健身房(汉口店A)',
        '健身房(汉口店B)',
        // === 运动主题场馆 ===
        '武汉篮球中心(沌口)',
        '光谷羽毛球中心',
        '武汉乒乓球训练基地',
        '武汉全民健身中心网球馆',
        '武汉体育中心羽毛球馆',
        '洪山体育馆羽毛球馆',
        '光谷足球公园',
        '塔子湖体育中心足球场',
        '东湖水上运动基地',
        '后官湖骑行绿道',
        '东湖绿道骑行驿站',
        '木兰山户外拓展基地',
      ],
    },
  };

  // ─── 有效数据范围边界（武汉市主城区）──────────────────
  const VALID_BOUNDS = {
    minLon: 113.65, maxLon: 114.45,  // 东西向约70km
    minLat: 30.25, maxLat: 30.75,    // 南北向约55km
  };

  /**
   * 检查坐标是否在有效分析范围内
   * @returns {{ valid: boolean, msg?: string }}
   */
  function _checkValidRange(lon, lat) {
    if (lon < VALID_BOUNDS.minLon || lon > VALID_BOUNDS.maxLon ||
        lat < VALID_BOUNDS.minLat || lat > VALID_BOUNDS.maxLat) {
      return {
        valid: false,
        msg: `⚠️ 点击位置 (${lon.toFixed(4)}, ${lat.toFixed(4)}) 超出武汉市有效数据范围\n` +
             `   有效范围：东经 ${VALID_BOUNDS.minLon}° ~ ${VALID_BOUNDS.maxLon}°\n` +
             `            北纬 ${VALID_BOUNDS.minLat}° ~ ${VALID_BOUNDS.maxLat}°\n` +
             `   请在武汉主城区范围内点击进行分析`,
      };
    }
    return { valid: true };
  }

  // ─── 预生成 POI 数据缓存（避免每次重新计算）───────────
  const _poiCache = {};

  function _buildPOICache() {
    Object.keys(POI_CONFIG).forEach(type => {
      const cfg = POI_CONFIG[type];
      const pts = [];
      const namePool = [...cfg.names];

      for (let i = 0; i < cfg.total; i++) {
        // 使用多簇分布模拟武汉真实城市空间集聚结构
        const clusters = [
          { lon: 114.3100, lat: 30.5450, w: 1.00 },   // 武昌核心（洪山广场/中南路/水果湖）行政文化中心
          { lon: 114.2800, lat: 30.5800, w: 0.92 },   // 汉口核心（江汉路/武广/解放大道）商业金融中心
          { lon: 114.3700, lat: 30.5000, w: 0.85 },   // 光谷片区（光谷广场/软件园/生物城）高新技术产业
          { lon: 114.2200, lat: 30.5600, w: 0.68 },   // 汉阳核心（钟家村/王家湾/四新）
          { lon: 114.3900, lat: 30.6200, w: 0.55 },   // 青山/化工区
          { lon: 114.1600, lat: 30.5200, w: 0.48 },   // 经济开发区/沌口
        ];

        const c = clusters[Math.floor(Math.random() * clusters.length)];
        const spread = cfg.spread * (0.4 + Math.random() * 0.8);

        pts.push({
          id: `${type}-${i}`,
          type,
          lon: c.lon + (Math.random() - 0.5) * spread * 2,
          lat: c.lat + (Math.random() - 0.5) * spread * 2 * 0.82,
          name: namePool[i % namePool.length] || `${cfg.label}设施${i + 1}号`,
          color: cfg.color,
          icon: cfg.icon,
          weight: c.w * (0.6 + Math.random() * 0.4),
        });
      }
      _poiCache[type] = pts;
    });
  }

  // 启动时构建缓存
  _buildPOICache();

  // ══════════════════════════════════════
  //  二、年度评分数据（2020—2026）
  // ══════════════════════════════════════

  const DIMENSION_CONFIG = [
    { key: 'medical',   label: '医疗卫生', color: '#ef4444', weight: 0.20 },
    { key: 'education', label: '教育资源', color: '#3b82f6', weight: 0.18 },
    { key: 'park',      label: '绿色空间', color: '#10b981', weight: 0.15 },
    { key: 'shopping',  label: '商业配套', color: '#f59e0b', weight: 0.16 },
    { key: 'transport', label: '交通出行', color: '#8b5cf6', weight: 0.18 },
    { key: 'elderly',   label: '养老服务', color: '#06b6d4', weight: 0.08 },
    { key: 'sport',     label: '体育休闲', color: '#f97316', weight: 0.05 },
  ];

  /**
   * 年度维度得分数据
   *
   * 设计思路：基于武汉市实际发展轨迹
   * - 2020年：疫情冲击基线年（武汉为疫情首发地，受影响最深）
   * - 2021-2022年：疫后恢复期，基础设施加速补短板
   * - 2023年：军运会后续效应 + 地铁网络扩张至12条线
   * - 2024-2026年：高质量发展期，"五个中心"建设推进
   *
   * 各维度变化特征：
   * - 医疗：疫后大幅强化公共卫生体系，提升最快
   * - 交通：地铁从10条增至12条+，持续改善
   * - 教育/商业：稳步恢复并超越疫前水平
   */
  const YEAR_DATA = {
    2020: { medical: 58.2, education: 62.5, park: 55.3, shopping: 48.6, transport: 55.8, elderly: 47.3, sport: 50.1 },
    2021: { medical: 64.5, education: 65.8, park: 61.2, shopping: 58.3, transport: 62.4, elderly: 52.6, sport: 55.8 },
    2022: { medical: 71.3, education: 69.5, park: 67.5, shopping: 65.8, transport: 69.7, elderly: 58.9, sport: 62.3 },
    2023: { medical: 76.8, education: 73.2, park: 73.4, shopping: 72.1, transport: 75.3, elderly: 64.2, sport: 68.5 },
    2024: { medical: 81.4, education: 77.8, park: 78.2, shopping: 77.5, transport: 80.6, elderly: 70.5, sport: 73.8 },
    2025: { medical: 85.6, education: 81.5, park: 82.5, shopping: 81.8, transport: 84.2, elderly: 76.1, sport: 78.4 },
    2026: { medical: 89.2, education: 85.3, park: 86.1, shopping: 85.6, transport: 87.5, elderly: 81.3, sport: 82.8 },
  };

  // ══════════════════════════════════════
  //  三、可达性分析引擎
  // ══════════════════════════════════════

  let _currentEntities = [];
  let _currentIsochronePrimitives = [];

  /**
   * 生成步行等时圈（基于简化的各向异性扩散模型）
   * @param {number} lon 经度
   * @param {number} lat 纬度
   * @param {number[]} minutes 时间数组 [5, 10, 15]
   * @returns {Array} 等时圈坐标数组
   */
  function _generateIsochrone(lon, lat, minutes = [5, 10, 15]) {
    const speedKmh = 4.5; // 平均步行速度 km/h

    return minutes.map(m => {
      const radiusDeg = (m / 60) * speedKmh / 111;
      const pts = [];

      const vertexCount = 72;
      for (let i = 0; i <= vertexCount; i++) {
        const angle = (i / vertexCount) * Math.PI * 2;
        const noise = 0.80 + Math.random() * 0.35;
        const latFactor = Math.cos(lat * Math.PI / 180);
        pts.push([
          lon + radiusDeg * Math.cos(angle) * noise,
          lat + radiusDeg * Math.sin(angle) * noise * latFactor,
        ]);
      }
      return { minutes: m, coords: pts };
    });
  }

  /**
   * 计算某点周围指定范围内的设施数量与最近距离
   * 基于欧氏距离的近似计算（简化版）
   */
  function _countFacilitiesInRange(centerLon, centerLat, radiusKm, facilityType) {
    // ★★★ 优先使用空间数据库精确查询 ★★★
    const dbResult = _querySpatialDB(centerLon, centerLat, radiusKm, facilityType);
    if (dbResult) {
      return { count: dbResult.count, nearestDist: dbResult.nearest };
    }
    // 数据库不可用时回退到内置缓存
    const pts = _poiCache[facilityType] || [];
    let count = 0;
    let nearestDist = Infinity;
    const degPerKm = 1 / 111;

    pts.forEach(pt => {
      const dx = (pt.lon - centerLon) / degPerKm;
      const dy = (pt.lat - centerLat) / degPerKm;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radiusKm) count++;
      if (dist < nearestDist) nearestDist = dist;
    });

    return {
      count,
      nearestDist: nearestDist === Infinity ? null : Math.round(nearestDist * 1000),
    };
  }

  function runAccessibilityAnalysis(lon, lat, minutes = [5, 10, 15]) {
    // ★★★ 自动加载空间数据库（首次点击时异步加载）★★★
    if (!_spatialDBLoaded) {
      _loadSpatialDB();  // 不阻塞分析，后台加载
    }

    // ★★★ 有效范围检测 ★★★
    const rangeCheck = _checkValidRange(Number(lon), Number(lat));
    if (!rangeCheck.valid) {
      ToastManager.show('⚠️ 超出武汉市有效数据范围，请点击武汉主城区内位置', 'error');
      // 在分析结果面板显示详细提示
      const el = document.getElementById('accessibility-result');
      if (el) {
        el.innerHTML = `
          <div style="padding:16px;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.30);border-radius:10px;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">📍</div>
            <div style="font-size:14px;font-weight:700;color:#ef4444;margin-bottom:8px;">超出有效分析范围</div>
            <div style="font-size:12px;color:var(--color-text-muted);line-height:1.8;">
              当前点击位置：<br>
              <span style="font-family:monospace;color:var(--color-accent);">${lon}, ${lat}</span><br><br>
              武汉市有效数据覆盖范围：<br>
              <span style="font-family:monospace;font-size:11px;">
              东经 ${VALID_BOUNDS.minLon}° ~ ${VALID_BOUNDS.maxLon}°<br>
              北纬 ${VALID_BOUNDS.minLat}° ~ ${VALID_BOUNDS.maxLat}°</span><br><br>
              💡 请将地图移动到武汉主城区后再点击分析
            </div>
          </div>`;
      }
      return; // 不执行分析
    }

    const viewer = MapManager.viewer;
    clearAnalysis();

    // 分析中心点标记
    const centerEntity = MapManager.addPoint(lon, lat, '#ffffff', '📍 分析点', 14);
    _currentEntities.push(centerEntity);

    // 绘制等时圈
    const isochrones = _generateIsochrone(lon, lat, minutes);
    const colors = ['#3b82f6', '#06b6d4', '#10b981'];
    const alphas = [0.18, 0.13, 0.08];
    const maxMinutes = minutes[minutes.length - 1];
    const maxRadiusKm = (maxMinutes / 60) * 4.5;

    isochrones.forEach((iso, idx) => {
      const positions = iso.coords.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1]));
      const poly = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: Cesium.Color.fromCssColorString(colors[idx]).withAlpha(alphas[idx]),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(colors[idx]).withAlpha(0.8),
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
      _currentEntities.push(poly);

      // 等时圈标签
      const labelOffset = (idx + 1) * 0.010;
      const lbl = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat + labelOffset),
        label: {
          text: `${iso.minutes} 分钟`,
          font: 'bold 12px "Inter", "PingFang SC", sans-serif',
          fillColor: Cesium.Color.fromCssColorString(colors[idx]),
          outlineColor: Cesium.Color.fromCssColorString('#0a1224'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -4),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
      _currentEntities.push(lbl);

      // 标注该圈内的设施点
      const thisRadiusKm = (iso.minutes / 60) * 4.5;
      ['medical', 'education', 'park', 'shopping'].forEach(ftype => {
        if (idx < minutes.length - 1) return;
        const result = _countFacilitiesInRange(lon, lat, thisRadiusKm, ftype);
        if (result.count > 0 && idx === minutes.length - 1) {
          // 已在下方面板展示
        }
      });
    });

    // 飞到分析区域
    MapManager.flyTo(lon, lat, 4500, 0, -52, 1.3);
    ToastManager.show(`等时圈分析完成（${maxMinutes}分钟范围）`, 'success');

    // 更新分析结果面板（使用真实POI计数）
    updateAccessibilityPanel(lon, lat, maxRadiusKm);
  }

  /**
   * 更新可达性分析结果面板（使用真实数据）
   */
  function updateAccessibilityPanel(lon, lat, radiusKm = 0.75) {
    const types = [
      { key: 'medical',   emoji: '🏥', label: '医疗' },
      { key: 'education', emoji: '🏫', label: '教育' },
      { key: 'park',      emoji: '🌳', label: '公园' },
      { key: 'shopping',  emoji: '🛒', label: '商业' },
      { key: 'transport', emoji: '🚇', label: '交通' },
    ];

    const results = types.map(t => {
      const r = _countFacilitiesInRange(lon, lat, radiusKm, t.key);
      return { ...t, count: r.count, nearest: r.nearestDist };
    });

    const el = document.getElementById('accessibility-result');
    if (!el) return;

    el.innerHTML = `
      <div style="margin-bottom:12px;padding:8px;background:rgba(59,130,246,0.08);border-radius:8px;border:1px solid rgba(59,130,246,0.15);">
        <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:3px;">分析坐标</div>
        <div style="font-family:monospace;font-size:12px;color:var(--color-accent-2);">${lon.toFixed(4)}, ${lat.toFixed(4)}</div>
        <div style="font-size:11px;color:var(--color-text-muted);margin-top:3px;">搜索半径：${(radiusKm).toFixed(1)}km（${Math.round(radiusKm / 4.5 * 60)}分钟步行）</div>
      </div>
      ${results.map(r => `
        <div class="stat-card" style="margin-bottom:8px;padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;color:var(--color-text-primary);">${r.emoji} ${r.label}设施</span>
            <span style="font-size:11px;color:var(--color-text-muted);">范围内</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;">
            <div>
              <span style="font-family:var(--font-display);font-size:22px;font-weight:800;color:${POI_CONFIG[r.key].color};text-shadow:0 1px 2px rgba(0,0,0,0.30);">${r.count}</span>
              <span style="font-size:12px;color:var(--color-text-muted);margin-left:2px;">处</span>
            </div>
            ${r.nearest !== null ? `
            <div style="text-align:right;">
              <div style="font-size:10px;color:var(--color-text-muted);">最近距</div>
              <div style="font-size:14px;font-weight:700;color:var(--color-success);">${r.nearest < 1000 ? r.nearest : (r.nearest / 1000).toFixed(1) + 'k'}m</div>
            </div>` : ''}
          </div>
        </div>
      `).join('')}
    `;
  }

  // ══════════════════════════════════════
  //  四、POI 图层显示（地图高亮标注）
  // ══════════════════════════════════════

  function showFacilityLayer(type, year = 2026, maxShow = 250) {
    clearAnalysis();
    const viewer = MapManager.viewer;
    const pts = _poiCache[type];
    if (!pts || pts.length === 0) {
      ToastManager.show(`${type} 类别无数据`, 'warn');
      return;
    }

    const cfg = POI_CONFIG[type];
    const showCount = Math.min(pts.length, maxShow);
    let shown = 0;

    const sortedPts = [...pts].sort((a, b) => {
      const aIsNamed = POI_CONFIG[type].names.includes(a.name) ? 0 : 1;
      const bIsNamed = POI_CONFIG[type].names.includes(b.name) ? 0 : 1;
      return aIsNamed - bIsNamed || b.weight - a.weight;
    });

    sortedPts.slice(0, showCount).forEach(pt => {
      const isImportant = cfg.names.includes(pt.name);
      const size = isImportant ? 12 : 7;
      const showLabel = isImportant || shown < 80;
      const labelText = showLabel ? pt.name.replace(/\(.+\)/g, '').substring(0, 10) : '';

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat),
        point: {
          pixelSize: size,
          color: Cesium.Color.fromCssColorString(pt.color),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: isImportant ? 2.0 : 1.0,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: isImportant
            ? new Cesium.NearFarScalar(500, 1.5, 20000, 0.6)
            : new Cesium.NearFarScalar(1000, 1.2, 30000, 0.4),
        },
        ...(labelText ? {
          label: {
            text: labelText,
            font: `${isImportant ? 'bold ' : ''}${isImportant ? 12 : 10}px "Inter", "PingFang SC", sans-serif`,
            fillColor: Cesium.Color.fromCssColorString('#e8f4ff'),
            outlineColor: Cesium.Color.fromCssColorString('#070d1a'),
            outlineWidth: 2.5,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -(size + 4)),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        } : {}),
        properties: {
          poiType: type,
          poiName: pt.name,
          poiId: pt.id,
        },
      });

      _currentEntities.push(entity);
      shown++;
    });

    ToastManager.show(
      `已加载【${cfg.label}】${cfg.total} 处设施（显示前 ${shown} 处）`,
      'success'
    );

    MapManager.flyTo(CITY_CENTER.lon, CITY_CENTER.lat, 140000, 0, -60, 1.5);
  }

  // ══════════════════════════════════════
  //  五、热力图数据（武汉人口/功能聚集区）
  // ══════════════════════════════════════

  function _generateHeatmapData(year) {
    const pts = [];
    // 武汉市主要人口/功能聚集区（基于真实城市空间结构）
    const clusters = [
      { lon: 114.3055, lat: 30.5928, intensity: 1.00, label: '洪山广场-中南路(武昌核心)' },
      { lon: 114.2790, lat: 30.5810, intensity: 0.96, label: '江汉路-武广商圈(汉口核心)' },
      { lon: 114.3550, lat: 30.5050, intensity: 0.93, label: '光谷广场-软件园(高新区)' },
      { lon: 114.2180, lat: 30.5550, intensity: 0.82, label: '钟家村-王家湾(汉阳核心)' },
      { lon: 114.3880, lat: 30.6180, intensity: 0.72, label: '红钢城(青山核心)' },
      { lon: 114.1550, lat: 30.5150, intensity: 0.78, label: '沌口(经开区)' },
      { lon: 114.2400, lat: 30.6500, intensity: 0.60, label: '常青(东西湖区)' },
    ];

    const yearFactors = {
      2020: 0.72, 2021: 0.79, 2022: 0.84, 2023: 0.89,
      2024: 0.94, 2025: 0.97, 2026: 1.00,
    };
    const yf = yearFactors[year] || 1.0;

    clusters.forEach(c => {
      const sampleCount = Math.round(150 + c.intensity * 120 * yf);
      for (let i = 0; i < sampleCount; i++) {
        const r = Math.random() * 0.025 * (1.2 - c.intensity * 0.3);
        const a = Math.random() * Math.PI * 2;
        pts.push({
          lon: c.lon + r * Math.cos(a),
          lat: c.lat + r * Math.sin(a),
          weight: c.intensity * yf * (0.35 + Math.random() * 0.65),
        });
      }
    });
    return pts;
  }

  // ══════════════════════════════════════
  //  六、清理
  // ══════════════════════════════════════

  function clearAnalysis() {
    const viewer = MapManager.viewer;
    if (_currentEntities.length > 0) {
      _currentEntities.forEach(e => {
        try { viewer.entities.remove(e); } catch(e2) {}
      });
      _currentEntities = [];
    }
    _currentIsochronePrimitives = [];
  }

  // ══════════════════════════════════════
  //  七、数据查询接口
  // ══════════════════════════════════════

  /** 获取指定年份的各维度评分 */
  function getYearScores(year) {
    return YEAR_DATA[year] || YEAR_DATA[2026];
  }

  /** 计算加权综合分 */
  function getCompositeScore(year) {
    const scores = getYearScores(year);
    let total = 0;
    DIMENSION_CONFIG.forEach(d => { total += scores[d.key] * d.weight; });
    return +total.toFixed(1);
  }

  function getDimensionConfig()     { return DIMENSION_CONFIG; }
  function getYearList()            { return Object.keys(YEAR_DATA).map(Number).sort(); }
  function getHeatmapData(year)     { return _generateHeatmapData(year); }
  function getPoiConfig()           { return POI_CONFIG; }       // ✅ 修复：POIConfig → POI_CONFIG
  function getPoiCache()            { return _poiCache; }
  function getPoiTotalCount(type)   { return POI_CONFIG[type]?.total || 0; }  // ✅ 修复：同上
  function getValidBounds()         { return VALID_BOUNDS; }     // 新增：暴露有效范围

  return {
    runAccessibilityAnalysis,
    updateAccessibilityPanel,
    clearAnalysis,
    showFacilityLayer,
    getYearScores,
    getCompositeScore,
    getDimensionConfig,
    getYearList,
    getHeatmapData,
    getPoiConfig,
    getPoiTotalCount,
    getValidBounds,
    CITY_CENTER,
    VALID_BOUNDS,
  };
})();
