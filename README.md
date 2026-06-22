# 武汉市 POI 空间数据库

## 文件说明

- `wuhan-poi-db.json` — 主数据库文件

## 数据结构

```json
{
  "meta": { "name","description","city","created","crs","total","gridSize" },
  "stats": { "medical": 952, "education": 1348, ... },
  "grid": { "11430,3054": [0,1,2,...], ... },          // 网格空间索引
  "features": [ { "id":0,"name":"...","type":"medical","lon":114.36,"lat":30.59,"weight":10,"isReal":true }, ... ]
}
````

## 空间查询算法

1. 根据查询点 (lon, lat) 和半径计算边界框
2. 枚举边界框内所有网格
3. 从 `grid` 中取出候选特征 ID
4. 计算精确距离，筛选在半径内的特征
5. 返回结果

时间复杂度：O(k) 其中 k 为候选网格内的特征数（远小于总量 n）

## 使用方法（浏览器端）

```javascript
const db = await fetch('/data/spatialdb/wuhan-poi-db.json').then(r => r.json());

// 查询 (114.3055, 30.5928) 周围 1km 内的所有医疗设施
const results = queryByRadius(db, 114.3055, 30.5928, 1.0, 'medical');
````

## 数据来源

- 真实设施名称与坐标：基于公开资料与地图服务抽样
- 补充数据：基于武汉城市空间结构随机生成（用于演示）
- `isReal: true` 的记录为真实设施
