/**
 * map.js — Cesium 地图初始化与基础图层管理
 * 城市"生活圈"品质动态监测与评估平台
 */

// Cesium Ion token
const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1OGY1ZjAyYi0xNDdhLTQ1Y2QtYjk1NS01NDdjZDUzMWExM2IiLCJpZCI6NDM0NTI5LCJpc3MiOiJodHRwczovL2lvbi5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3NzkzNTE1OTh9.CCOboyy-pUFTImvQxAd5ROLBQ7_P35p28CaHVJlep7g';
const TIANDITU_TOKEN = 'cd7568bc46491ac1839ba864331e0e09';

window.MapManager = (function () {
  let viewer = null;

  // ─── 初始化 Cesium Viewer ───────────────────────────────
  function init(containerId) {
    Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;

    viewer = new Cesium.Viewer(containerId, {
      // 关闭默认控件，使用自定义 UI
      animation:             false,
      baseLayerPicker:       false,
      fullscreenButton:      false,
      geocoder:              false,
      homeButton:            false,
      infoBox:               false,
      sceneModePicker:       false,
      selectionIndicator:    false,
      timeline:              false,
      navigationHelpButton:  false,
      navigationInstructionsInitiallyVisible: false,
      // 基础图像提供者（先用空白，随后叠加天地图）
      imageryProvider: false,
      // 默认 2D 场景模式
      sceneMode: Cesium.SceneMode.SCENE2D,
      // 开启深度检测提升可视效果
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      // 性能优化
      requestRenderMode: false,
      maximumRenderTimeChange: Infinity,
      // 背景色
      backgroundColor: Cesium.Color.fromCssColorString('#070d1a'),
    });

    // 隐藏 Cesium logo
    viewer.cesiumWidget.creditContainer.style.display = 'none';

    // 大气 & 光照
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1423');
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#070d1a');
    viewer.scene.skyBox.show = false;
    viewer.scene.fog.enabled = false;

    // 加载天地图底图
    _addTiandituLayers();

    // 飞行到中国城市区域（以武汉理工大学马房山校区为中心）
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(114.3567, 30.5164, 120000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch:   Cesium.Math.toRadians(-55),
        roll:    0.0,
      },
      duration: 2,
    });

    // 监听点击事件
    _bindClickHandler();

    console.log('[MapManager] Cesium viewer initialized.');
    return viewer;
  }

  // ─── 加载天地图图层（默认矢量底图） ────────────────────
  function _addTiandituLayers() {
    const TDT = TIANDITU_TOKEN;
    const host = 'https://t{s}.tianditu.gov.cn';

    // 矢量底图
    viewer.imageryLayers.addImageryProvider(
      new Cesium.WebMapTileServiceImageryProvider({
        url: `${host}/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TDT}`,
        layer: 'vec',
        style: 'default',
        format: 'tiles',
        tileMatrixSetID: 'w',
        subdomains: ['0','1','2','3','4','5','6','7'],
        maximumLevel: 18,
        credit: new Cesium.Credit('天地图矢量'),
      })
    );

    // 矢量注记
    viewer.imageryLayers.addImageryProvider(
      new Cesium.WebMapTileServiceImageryProvider({
        url: `${host}/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TDT}`,
        layer: 'cva',
        style: 'default',
        format: 'tiles',
        tileMatrixSetID: 'w',
        subdomains: ['0','1','2','3','4','5','6','7'],
        maximumLevel: 18,
        credit: new Cesium.Credit('天地图注记'),
      })
    );
  }

  // ─── 切换底图模式 ──────────────────────────────────────
  function switchBaseMap(mode) {
    const TDT = TIANDITU_TOKEN;
    const host = 'https://t{s}.tianditu.gov.cn';

    // 清除所有图层
    viewer.imageryLayers.removeAll();

    if (mode === 'satellite') {
      // 影像
      viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapTileServiceImageryProvider({
          url: `${host}/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TDT}`,
          layer: 'img', style: 'default', format: 'tiles', tileMatrixSetID: 'w',
          subdomains: ['0','1','2','3','4','5','6','7'], maximumLevel: 18,
        })
      );
      viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapTileServiceImageryProvider({
          url: `${host}/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TDT}`,
          layer: 'cia', style: 'default', format: 'tiles', tileMatrixSetID: 'w',
          subdomains: ['0','1','2','3','4','5','6','7'], maximumLevel: 18,
        })
      );
    } else if (mode === 'vector') {
      // 矢量
      viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapTileServiceImageryProvider({
          url: `${host}/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TDT}`,
          layer: 'vec', style: 'default', format: 'tiles', tileMatrixSetID: 'w',
          subdomains: ['0','1','2','3','4','5','6','7'], maximumLevel: 18,
        })
      );
      viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapTileServiceImageryProvider({
          url: `${host}/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TDT}`,
          layer: 'cva', style: 'default', format: 'tiles', tileMatrixSetID: 'w',
          subdomains: ['0','1','2','3','4','5','6','7'], maximumLevel: 18,
        })
      );
    } else if (mode === 'dark') {
      // 深色矢量（Cesium Ion 暗色底图）
      viewer.imageryLayers.addImageryProvider(
        new Cesium.IonImageryProvider({ assetId: 3954 }) // Earth at Night
      );
      viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapTileServiceImageryProvider({
          url: `${host}/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TDT}`,
          layer: 'cva', style: 'default', format: 'tiles', tileMatrixSetID: 'w',
          subdomains: ['0','1','2','3','4','5','6','7'], maximumLevel: 18,
        })
      );
    }

    ToastManager.show(`底图切换：${mode}`, 'info');
  }

  // ─── 飞行到指定位置 ────────────────────────────────────
  function flyTo(lon, lat, alt = 80000, heading = 0, pitch = -50, duration = 1.5) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
      orientation: {
        heading: Cesium.Math.toRadians(heading),
        pitch:   Cesium.Math.toRadians(pitch),
        roll: 0,
      },
      duration,
    });
  }

  // ─── 获取当前视图范围 ───────────────────────────────────
  function getCurrentExtent() {
    try {
      const rect = viewer.camera.computeViewRectangle();
      if (!rect) return null;
      return {
        west:  Cesium.Math.toDegrees(rect.west),
        south: Cesium.Math.toDegrees(rect.south),
        east:  Cesium.Math.toDegrees(rect.east),
        north: Cesium.Math.toDegrees(rect.north),
      };
    } catch { return null; }
  }

  // ─── 点击拾取 ──────────────────────────────────────────
  function _bindClickHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (!cartesian) return;
      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(6);
      const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(6);
      // 触发全局事件
      document.dispatchEvent(new CustomEvent('mapClick', { detail: { lon, lat } }));
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // ─── 添加点实体 ────────────────────────────────────────
  function addPoint(lon, lat, color = '#3b82f6', label = '', size = 10) {
    return viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: size,
        color: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1.5,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: label ? {
        text: label,
        font: '12px Inter, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#e8f0fe'),
        outlineColor: Cesium.Color.fromCssColorString('#070d1a'),
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -14),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      } : undefined,
    });
  }

  // ─── 清除所有实体 ──────────────────────────────────────
  function clearEntities() {
    viewer.entities.removeAll();
  }

  // ─── 公开接口 ──────────────────────────────────────────
  return { init, switchBaseMap, flyTo, getCurrentExtent, addPoint, clearEntities,
           get viewer() { return viewer; } };
})();
