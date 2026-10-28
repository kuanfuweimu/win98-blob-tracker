/* UI, state, source loading, main loop, export. */
(function () {
  const BT = window.BT;
  const $ = s => document.querySelector(s);
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    for (const k of kids) if (k != null) e.append(k);
    return e;
  };

  const FONT_OPTS = [
    ['"SimSun","宋体",monospace', '宋体 SimSun'],
    ['"Courier New",monospace', 'Courier New'],
    ['"Fixedsys","Terminal","Consolas",monospace', 'Fixedsys / Terminal'],
    ['"Microsoft Sans Serif","MS Sans Serif",Tahoma,sans-serif', 'MS Sans Serif'],
    ['"Lucida Console",monospace', 'Lucida Console'],
    ['"Small Fonts","MS Gothic",monospace', 'Small Fonts'],
  ];

  const D = BT.DEFAULTS = {
    mode: 'luma', color: '#ff8c00', threshold: 150, invert: false, blur: 1, morph: 1, conn8: true,
    minArea: 0.12, maxArea: 40, maxBlobs: 24, sort: 'area', noBorder: false, detRes: 240,
    showMask: false, maskColor: '#00ffff', showContour: false, contourColor: '#ffff00',
    trackDist: 30, trackSmooth: 0.5, detEvery: 1,

    bxOn: true, bxStyle: 'window', bxColor: '#00ff00', bxWidth: 1, bxPad: 2, bxCorner: 0.25, bxAnim: true,
    bxTitleA: '#000080', bxTitleB: '#1084d0', bxIcon: true,
    bxFill: 'none', bxFillColor: '#000080', bxFillAlpha: 0.35,
    asciiCell: 8, asciiColorMode: 'fixed', asciiColor: '#00ff00', asciiInvert: false, asciiBg: true, asciiBgColor: '#000000',
    jitter: 0,

    lbOn: true, titleTpl: '{label}_{id:2}.EXE', textTpl: 'ID {id:3}  {hex}\\nX{cx} Y{cy}  {w}x{h}\\nCONF {conf} {chars:4}',
    labels: 'ORANGE,BUBBLE,BEER,DROP,FOAM,TRIPO', charset: ' .:-=+*#%@', scramble: true, scrambleSpeed: 6,
    font: FONT_OPTS[0][0], fontSize: 12, lbPos: 'bottom', lbBg: 'face', lbColor: '#00ff00', lbBgColor: '#000000', lbLeader: false,
    hud: true, hudTpl: 'BLOBTRK.EXE  {t}\\nTRACKING {n} BLOBS / FRAME {frame:5}', overlayScale: 0,

    lnOn: true, lnMode: 'mst', lnShape: 'curve', lnBend: 0.25, lnAlt: true, lnK: 2, lnRadius: 25, lnLoop: false,
    lnAnchor: 'center', lnColor: '#ffffff', lnWidth: 1, lnDash: 'dash', lnDashLen: 4, lnPixel: true, lnAnim: true, lnFlow: 1,
    lnEnd: 'square', lnPacket: true, lnPacketColor: '#ffff00', lnLabel: 'none', lnLabelTpl: '{label}',

    pixelScale: 2,
    ripOn: true, ripRain: 1.5, ripPulse: 0.4, ripSize: 3, ripAmp: 300, ripDamp: 0.97, ripRefr: 1, ripLight: 1,
    lakeOn: false, lakeY: 0.62, lakeScale: 1, lakeAmp: 3, lakeFreq: 1, lakeSpeed: 1, lakeTint: '#000080', lakeTintAmt: 0.3, lakeLine: false,
    palOn: false, palName: 'beer', palRegion: 'blobs', palFlow: 'luma', palBands: 2, palSpeed: 1, palMix: 0.85,
    mbOn: false, mbStyle: 'flat3', mbColor: '#ff8c00', mbSize: 0.6, mbSat: 3, mbFree: 0, mbSpeed: 1, mbThr: 1, mbCell: 2, mbMix: 1,
    dithOn: false, dithPal: 'win16', dithMatrix: '4', dithSpread: 48, dithRegion: 'all', dithA: '#000080', dithB: '#00ffff',
    bubOn: true, bubSource: 'blobs', bubStyle: 'classic', bubRate: 8, bubSpeed: 1, bubWobble: 1.5, bubMin: 1, bubMax: 5, bubGrow: 0.6, bubPop: 0.3,
    bubColor: '#ffffff', bubChars: 'o°Oo0',

    workMax: 1280, recSec: 6, recFps: 30, recMbps: 8,
    vidFormat: 'auto', vidAudio: true, vidSound: false, vidLoop: true, vidSpeed: 1,
  };

  const PRESETS = {
    'Win98 窗口追踪': { bxStyle: 'window', lbBg: 'face', lbPos: 'bottom', lnShape: 'elbow', lnMode: 'mst', lnDash: 'solid', lnColor: '#ffffff', ripOn: true, bubOn: true, palOn: false, mbOn: false, dithOn: false, lakeOn: false, bxFill: 'none' },
    '监控 CCTV': { bxStyle: 'corners', bxColor: '#00ff00', bxWidth: 2, lbBg: 'solid', lbBgColor: '#000000', lbColor: '#00ff00', lbPos: 'top', lnShape: 'line', lnMode: 'nearest', lnK: 1, lnColor: '#00ff00', lnDash: 'dot', lnEnd: 'none', lnPacket: false, ripOn: false, bubOn: false, palOn: false, mbOn: false, dithOn: true, dithPal: 'duo', dithA: '#001800', dithB: '#40ff40', dithSpread: 64, lakeOn: false, bxFill: 'none', jitter: 1, textTpl: 'TGT-{id:3} {conf}\\n{cx},{cy}' },
    '水下 Underwater': { bxStyle: 'focus', bxColor: '#ffffff', lbBg: 'tip', lbPos: 'right', lbLeader: true, lnShape: 'wave', lnBend: 0.2, lnMode: 'chain', lnColor: '#80e0ff', ripOn: true, ripRain: 3, bubOn: true, bubSource: 'bottom', bubRate: 14, bubMax: 6, palOn: true, palName: 'water', palRegion: 'outside', palFlow: 'y', palBands: 3, palMix: 0.45, dithOn: true, dithPal: 'water', dithRegion: 'all', mbOn: false, lakeOn: false, bxFill: 'none' },
    '橙啤液体 Beer Sea': { bxStyle: 'window', bxTitleA: '#a03c00', bxTitleB: '#ffb000', lbBg: 'navy', lnShape: 'scurve', lnColor: '#fff4c0', lnMode: 'mst', palOn: true, palName: 'beer', palRegion: 'blobs', palMix: 0.8, mbOn: true, mbStyle: 'flat3', mbColor: '#ff8c00', mbSat: 3, mbMix: 0.85, bubOn: true, bubSource: 'blobs', bubStyle: 'classic', bubColor: '#fff4c0', ripOn: true, dithOn: false, lakeOn: false, bxFill: 'none' },
    'ASCII 字符': { bxStyle: 'single', bxColor: '#00ff00', bxFill: 'ascii', asciiColorMode: 'src', asciiCell: 8, charset: ' .:-=+*#%@', lbBg: 'solid', lbBgColor: '#000000', lbColor: '#00ff00', lnShape: 'scurve', lnColor: '#00ff00', lnDash: 'dash', bubOn: true, bubStyle: 'ascii', bubColor: '#00ff00', ripOn: false, palOn: false, mbOn: false, dithOn: false, lakeOn: false },
    '熔岩灯 Lava': { bxStyle: 'xor', lbBg: 'shadow', lbColor: '#ffffff', lnShape: 'curve', lnColor: '#ffff40', mbOn: true, mbStyle: 'cycle', palName: 'lava', mbFree: 6, mbSat: 2, mbSize: 0.7, palOn: true, palRegion: 'outside', palFlow: 'radial', palMix: 0.35, ripOn: false, bubOn: false, dithOn: true, dithPal: 'win16', lakeOn: false, bxFill: 'none' },
    'Anfy 湖面': { lakeOn: true, lakeY: 0.6, lakeAmp: 4, lakeTintAmt: 0.35, ripOn: true, ripRain: 1, bubOn: false, palOn: false, mbOn: false, dithOn: false, bxStyle: 'raised', lbBg: 'face', lnShape: 'line', lnDash: 'solid', bxFill: 'none' },
  };

  BT.PRESETS = PRESETS;

  /* ---------- control schema ---------- */
  const rg = (k, label, min, max, step) => ({ t: 'range', k, label, min, max, step });
  const sel = (k, label, opts) => ({ t: 'select', k, label, opts });
  const chk = (k, label) => ({ t: 'check', k, label });
  const col = (k, label) => ({ t: 'color', k, label });
  const txt = (k, label) => ({ t: 'text', k, label });
  const area = (k, label) => ({ t: 'area', k, label });
  const hint = text => ({ t: 'hint', text });
  const fill = (k, label, opts) => ({ t: 'fill', k, label, opts });
  const fs = (legend, ...items) => ({ legend, items });

  const REGION = [['all', '整幅画面'], ['blobs', '仅 blob 内'], ['outside', '仅 blob 外']];
  const TABS = [
    ['det', '检测', [
      fs('阈值方式',
        sel('mode', '依据', [['luma', '亮部'], ['dark', '暗部'], ['sat', '饱和度'], ['hue', '色相 (取色)'], ['color', '颜色距离 (取色)'], ['edge', '边缘 Sobel'], ['motion', '运动 (视频)']]),
        col('color', '目标颜色'),
        rg('threshold', '阈值', 0, 255, 1), chk('invert', '反转遮罩'),
        rg('blur', '预模糊', 0, 8, 1), rg('morph', '形态学', -4, 4, 1),
        hint('形态学 >0 = 闭运算 (合并相邻碎块)，<0 = 开运算 (去掉细小噪点)。')),
      fs('筛选',
        rg('minArea', '最小面积 %', 0, 5, 0.01), rg('maxArea', '最大面积 %', 1, 100, 1),
        rg('maxBlobs', '最多数量', 1, 80, 1),
        sel('sort', '编号顺序', [['area', '面积大→小'], ['x', '从左到右'], ['y', '从上到下'], ['luma', '亮→暗']]),
        chk('conn8', '8 邻域连通'), chk('noBorder', '忽略贴边的 blob'),
        rg('detRes', '分析分辨率', 80, 480, 10)),
      fs('显示',
        chk('showMask', '显示遮罩 (棋盘点)'), col('maskColor', '遮罩颜色'),
        chk('showContour', '显示像素轮廓'), col('contourColor', '轮廓颜色')),
      fs('视频追踪',
        rg('trackDist', '匹配距离', 2, 120, 1), rg('trackSmooth', '平滑', 0, 0.95, 0.05), rg('detEvery', '每 N 帧检测', 1, 10, 1)),
    ]],
    ['box', '方框', [
      fs('方框样式',
        chk('bxOn', '显示方框'),
        sel('bxStyle', '样式', [['window', 'Win98 窗口'], ['raised', '凸起斜面'], ['sunken', '凹陷斜面'], ['single', '单线'], ['double', '双线'], ['focus', '焦点虚线 (蚂蚁线)'], ['corners', '四角括号'], ['cross', '十字准星'], ['xor', 'XOR 反色线']]),
        col('bxColor', '线条颜色'), rg('bxWidth', '线宽 (像素)', 1, 6, 1), rg('bxPad', '外扩', -10, 30, 1),
        rg('bxCorner', '角长比例', 0.05, 0.5, 0.01), chk('bxAnim', '蚂蚁线动画'), rg('jitter', '追踪抖动', 0, 8, 0.5)),
      fs('Win98 窗口标题栏',
        col('bxTitleA', '渐变起'), col('bxTitleB', '渐变止'), chk('bxIcon', '显示图标'),
        txt('titleTpl', '标题模板')),
      fs('方框填充',
        sel('bxFill', '填充', [['none', '无'], ['tint', '半透明色'], ['checker', '50% 棋盘点 (Win98 选中)'], ['scan', '扫描线'], ['invert', '反色'], ['ascii', '字符画 (用字符集)']]),
        col('bxFillColor', '填充颜色'), rg('bxFillAlpha', '不透明度', 0, 1, 0.05),
        rg('asciiCell', '字符格大小', 4, 24, 1), sel('asciiColorMode', '字符颜色', [['fixed', '固定颜色'], ['src', '取原图颜色']]),
        col('asciiColor', '固定颜色'), chk('asciiInvert', '亮暗反转'), chk('asciiBg', '字符底色'), col('asciiBgColor', '底色')),
    ]],
    ['txt', '文字', [
      fs('标签',
        chk('lbOn', '显示标签'),
        area('textTpl', '标签模板'),
        hint('可用变量: {id} {id:3} {label} {x} {y} {w} {h} {cx} {cy} {area} {pct} {hex} {r} {g} {b} {luma} {conf} {char} {chars:6} {bar:8} {n} {t} {frame}。\\n = 换行。'),
        txt('labels', '名称列表'), hint('逗号分隔，{label} 按编号循环取用。'),
        sel('lbPos', '位置', [['bottom', '框下方'], ['top', '框上方'], ['right', '框右侧'], ['inside', '框内左上'], ['center', '中心']]),
        sel('lbBg', '底板', [['face', 'Win98 灰色凸起'], ['sunken', '白底凹陷'], ['tip', '黄色 ToolTip'], ['navy', '藏青选中'], ['solid', '纯色'], ['shadow', '无底 + 投影'], ['none', '无底']]),
        col('lbColor', '文字颜色'), col('lbBgColor', '纯色底板'), chk('lbLeader', '引线')),
      fs('字符集',
        txt('charset', '字符集'),
        fill('charset', '常用字符集', [[' .:-=+*#%@', 'ASCII 灰阶'], [' ░▒▓█', '方块 ░▒▓█'], ['01', '二进制 01'], ['0123456789ABCDEF', '十六进制'], ['ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ', '半角片假名'], ['☺☻♥♦♣♠•◘○◙♂♀♪♫☼', 'DOS 符号'], [' ·∙•○◎●', '圆点气泡'], ['~≈≋∿', '波浪']]),
        chk('scramble', '字符随机跳动'), rg('scrambleSpeed', '跳动速度', 0.5, 30, 0.5)),
      fs('字体',
        sel('font', '字体', FONT_OPTS), rg('fontSize', '字号', 8, 32, 1),
        rg('overlayScale', '像素倍数', 0, 6, 1), hint('像素倍数 0 = 按画面尺寸自动；所有线和字按整数倍放大，保持 Win98 硬边。')),
      fs('角标 HUD', chk('hud', '显示左上角信息'), area('hudTpl', 'HUD 模板')),
    ]],
    ['ln', '连线', [
      fs('连接方式',
        chk('lnOn', '显示连线'),
        sel('lnMode', '规则', [['mst', '最小生成树'], ['chain', '按编号串联'], ['nearest', '最近 K 个'], ['radius', '距离内全部'], ['star', '全部连到 #1'], ['all', '两两全连']]),
        rg('lnK', 'K 值', 1, 6, 1), rg('lnRadius', '距离 % 对角线', 2, 100, 1), chk('lnLoop', '串联首尾闭合'),
        sel('lnAnchor', '端点', [['center', '中心点'], ['edge', '框边缘']])),
      fs('线型',
        sel('lnShape', '形状', [['line', '直线'], ['curve', '弧线 (二次贝塞尔)'], ['scurve', 'S 形曲线 (三次)'], ['elbow', '直角折线'], ['wave', '波浪线']]),
        rg('lnBend', '弯曲度', -1, 1, 0.01), chk('lnAlt', '交替弯曲方向'),
        col('lnColor', '颜色'), rg('lnWidth', '线宽', 1, 6, 1),
        sel('lnDash', '虚实', [['solid', '实线'], ['dash', '虚线'], ['dot', '点线']]), rg('lnDashLen', '虚线长度', 1, 20, 1),
        chk('lnPixel', '像素线 (无抗锯齿)'), chk('lnAnim', '虚线流动'), rg('lnFlow', '流动速度', 0, 6, 0.1)),
      fs('端点与标注',
        sel('lnEnd', '端点', [['square', '方形节点'], ['dot', '实心点'], ['arrow', '箭头'], ['none', '无']]),
        chk('lnPacket', '数据包沿线移动'), col('lnPacketColor', '数据包颜色'),
        sel('lnLabel', '线上文字', [['none', '无'], ['dist', '距离 px'], ['ids', '编号 a→b'], ['tpl', '模板']]), txt('lnLabelTpl', '线上模板')),
    ]],
    ['fx', '液体', [
      fs('像素', rg('pixelScale', '效果像素尺寸', 1, 8, 1), hint('效果在低分辨率缓冲上计算再整数放大，值越大越“90 年代”。')),
      fs('2D 水波 (Hugo Elias)',
        chk('ripOn', '开启'), rg('ripRain', '雨滴 / 秒', 0, 20, 0.5), rg('ripPulse', 'blob 脉冲 / 秒', 0, 4, 0.1),
        rg('ripSize', '水滴半径', 1, 10, 1), rg('ripAmp', '水滴强度', 50, 1000, 10), rg('ripDamp', '阻尼', 0.9, 0.995, 0.001),
        rg('ripRefr', '折射', 0, 4, 0.1), rg('ripLight', '高光', 0, 3, 0.1), hint('在画面上按住拖动可以手动搅水。')),
      fs('湖面倒影 (Anfy Lake)',
        chk('lakeOn', '开启'), rg('lakeY', '水平线', 0.1, 0.95, 0.01), rg('lakeScale', '倒影压缩', 0.3, 2, 0.05),
        rg('lakeAmp', '波幅', 0, 12, 0.5), rg('lakeFreq', '波频', 0.2, 4, 0.1), rg('lakeSpeed', '速度', 0, 4, 0.1),
        col('lakeTint', '水色'), rg('lakeTintAmt', '水色强度', 0, 1, 0.05), chk('lakeLine', '水平线虚线')),
      fs('调色板循环 (Color Cycling)',
        chk('palOn', '开启'),
        sel('palName', '调色板', [['beer', '橙啤'], ['water', '海水'], ['lava', '熔岩'], ['acid', '酸性彩虹'], ['vapor', '蒸汽波']]),
        sel('palRegion', '作用范围', REGION), sel('palFlow', '流向', [['luma', '按亮度'], ['y', '垂直流动'], ['radial', '从 blob 中心扩散']]),
        rg('palBands', '色带数', 0.5, 8, 0.5), rg('palSpeed', '循环速度', -4, 4, 0.1), rg('palMix', '混合', 0, 1, 0.05)),
      fs('元球液体 (Metaballs)',
        chk('mbOn', '开启'),
        sel('mbStyle', '着色', [['flat3', '三段色 + 黑描边'], ['dither', '抖动渐变'], ['cycle', '调色板循环'], ['outline', '仅轮廓']]),
        col('mbColor', '液体颜色'), rg('mbSize', '球大小', 0.1, 2, 0.05), rg('mbSat', '卫星球数', 0, 8, 1),
        rg('mbFree', '自由漂浮球', 0, 16, 1), rg('mbSpeed', '速度', 0, 4, 0.1), rg('mbThr', '阈值', 0.3, 3, 0.05),
        rg('mbCell', '网格', 1, 6, 1), rg('mbMix', '不透明度', 0, 1, 0.05)),
      fs('有序抖动 (Bayer)',
        chk('dithOn', '开启'),
        sel('dithPal', '调色板', [['win16', 'Win 16 色'], ['web', 'Web 216 色'], ['water', '海水 8 色'], ['orange', '橙色 8 色'], ['cga', 'CGA 4 色'], ['gray4', '灰阶 4 色'], ['duo', '双色 (自定)']]),
        sel('dithMatrix', '矩阵', [['4', 'Bayer 4×4'], ['8', 'Bayer 8×8']]), rg('dithSpread', '扩散', 0, 128, 1),
        sel('dithRegion', '作用范围', REGION), col('dithA', '双色 暗'), col('dithB', '双色 亮')),
      fs('像素气泡',
        chk('bubOn', '开启'),
        sel('bubSource', '产生位置', [['blobs', '从 blob 冒出'], ['bottom', '从底部升起'], ['all', '随机']]),
        sel('bubStyle', '样式', [['classic', '描边 + 高光 (Win98)'], ['filled', '实心'], ['ring', '仅圆环'], ['ascii', '字符 (o°O)']]),
        rg('bubRate', '数量 / 秒', 0, 60, 1), rg('bubSpeed', '上升速度', 0.1, 4, 0.1), rg('bubWobble', '摆动', 0, 6, 0.1),
        rg('bubMin', '最小半径', 0, 10, 1), rg('bubMax', '最大半径', 1, 20, 1), rg('bubGrow', '上升变大', 0, 4, 0.1),
        rg('bubPop', '破裂几率', 0, 3, 0.1), col('bubColor', '颜色'), txt('bubChars', '字符气泡')),
    ]],
    ['out', '输出', [
      fs('分辨率', rg('workMax', '工作分辨率 (长边)', 480, 4096, 16), hint('导出 PNG 就是这个尺寸。原图更大时会等比缩小。')),
      fs('视频输入',
        hint('打开 / 拖入视频文件 (mp4 / webm / mov)，或使用摄像头。视频会逐帧检测并按编号持续追踪。'),
        { t: 'buttons', list: [['打开视频...', 'open'], ['摄像头', 'camera']] }),
      fs('视频导出',
        sel('vidFormat', '格式', [['auto', '自动 (MP4 优先)'], ['mp4', 'MP4 (H.264)'], ['webm', 'WebM (VP9)']]),
        chk('vidAudio', '包含原视频声音'),
        rg('recFps', '帧率', 10, 60, 1), rg('recMbps', '码率 Mbps', 1, 40, 1),
        hint('导出整段：从头把输入视频完整播放一遍，边处理边录制，耗时约等于视频时长。'),
        { t: 'buttons', list: [['导出整段视频', 'vexport']] }),
      fs('定时录制',
        rg('recSec', '时长 (秒)', 1, 120, 1),
        hint('图片或摄像头：录制当前画面 N 秒；再点一次提前结束。'),
        { t: 'buttons', list: [['录制 N 秒', 'rec']] }),
      { legend: '操作', items: [{ t: 'buttons', list: [['导出 PNG', 'png'], ['恢复默认', 'reset']] }] },
    ]],
  ];

  const DET_KEYS = new Set(['mode', 'color', 'threshold', 'invert', 'blur', 'morph', 'conn8', 'minArea', 'maxArea', 'maxBlobs', 'sort', 'noBorder']);
  const SETUP_KEYS = new Set(['detRes', 'pixelScale', 'workMax']);

  /* ---------- state ---------- */
  let S = Object.assign({}, D);
  try { Object.assign(S, JSON.parse(localStorage.getItem('blobtrack98') || '{}')); } catch (e) { }
  BT.S = () => S;
  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => localStorage.setItem('blobtrack98', JSON.stringify(S)), 400); };

  /* ---------- UI build ---------- */
  const ctl = {};
  function fmt(v, step) { return step >= 1 ? String(Math.round(v)) : Number(v).toFixed(step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3); }
  function buildUI() {
    const tabs = $('#tabs'), body = $('#tabBody');
    TABS.forEach(([id, name, sets], ti) => {
      const page = el('div', { class: 'page' + (ti === 0 ? ' on' : ''), id: 'pg-' + id });
      const tab = el('button', { class: 'tab' + (ti === 0 ? ' on' : ''), text: name, onclick: () => {
        tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
        body.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
        tab.classList.add('on'); page.classList.add('on');
      } });
      tabs.append(tab);
      for (const set of sets) {
        const f = el('fieldset', null, el('legend', { text: set.legend }));
        for (const it of set.items) f.append(makeCtl(it));
        page.append(f);
      }
      body.append(page);
    });
  }
  function makeCtl(it) {
    if (it.t === 'hint') return el('div', { class: 'hint', text: it.text });
    if (it.t === 'buttons') return el('div', { class: 'row wide' }, el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' },
      ...it.list.map(([l, a]) => el('button', { class: 'btn', text: l, onclick: () => act(a) }))));
    if (it.t === 'check') {
      const i = el('input', { type: 'checkbox' });
      i.checked = !!S[it.k];
      i.addEventListener('change', () => set(it.k, i.checked));
      ctl[it.k] = { it, i };
      return el('label', { class: 'check' }, i, el('span', { text: it.label }));
    }
    let input, out = null;
    if (it.t === 'range') {
      input = el('input', { type: 'range', min: it.min, max: it.max, step: it.step });
      input.value = S[it.k];
      out = el('output', { text: fmt(S[it.k], it.step) });
      input.addEventListener('input', () => { const v = parseFloat(input.value); out.textContent = fmt(v, it.step); set(it.k, v); });
      ctl[it.k] = { it, i: input, out };
      return el('label', { class: 'row' }, el('span', { text: it.label, title: it.label }), el('div', { class: 'range' }, input, out));
    }
    if (it.t === 'select' || it.t === 'fill') {
      input = el('select');
      if (it.t === 'fill') input.append(el('option', { value: '', text: '— 选择后填入 —' }));
      for (const [v, l] of it.opts) input.append(el('option', { value: v, text: l }));
      if (it.t === 'select') {
        input.value = S[it.k];
        input.addEventListener('change', () => set(it.k, input.value));
        ctl[it.k] = { it, i: input };
      } else input.addEventListener('change', () => { if (input.value) { set(it.k, input.value); syncUI(); } input.value = ''; });
    } else if (it.t === 'color') {
      input = el('input', { type: 'color' }); input.value = S[it.k];
      input.addEventListener('input', () => set(it.k, input.value));
      ctl[it.k] = { it, i: input };
    } else if (it.t === 'text' || it.t === 'area') {
      input = el(it.t === 'area' ? 'textarea' : 'input', it.t === 'text' ? { type: 'text', spellcheck: 'false' } : { spellcheck: 'false' });
      input.value = S[it.k];
      input.addEventListener('input', () => set(it.k, input.value));
      ctl[it.k] = { it, i: input };
      if (it.t === 'area') return el('label', { class: 'row wide' }, el('span', { text: it.label }), input);
    }
    return el('label', { class: 'row' }, el('span', { text: it.label, title: it.label }), input);
  }
  function syncUI() {
    for (const k in ctl) {
      const c = ctl[k];
      if (c.it.t === 'check') c.i.checked = !!S[k];
      else { c.i.value = S[k]; if (c.out) c.out.textContent = fmt(S[k], c.it.step); }
    }
  }
  function set(k, v) {
    S[k] = v; save();
    if (SETUP_KEYS.has(k)) needSetup = true;
    else if (DET_KEYS.has(k)) needDetect = true;
    if (k === 'mode' && v === 'motion' && !(src && src.video)) status('运动检测需要视频；图片会检测不到 blob。');
    dirty = true;
  }

  /* ---------- source ---------- */
  const out = $('#out'), octx = out.getContext('2d');
  const srcC = document.createElement('canvas'), sctx = srcC.getContext('2d', { willReadFrequently: true });
  const fxC = document.createElement('canvas'), fctx = fxC.getContext('2d', { willReadFrequently: true });
  const anC = document.createElement('canvas'), actx = anC.getContext('2d', { willReadFrequently: true });
  const fx = new BT.FX();
  const tracker = new BT.Tracker();
  let src = null, W = 0, H = 0, srcData = null, det = null, prevAn = null;
  let needSetup = false, needDetect = false, needGrab = false, dirty = true;
  let playing = true, t = 0, frame = 0, last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0;

  BT.makeDemo = function (w, h, seed) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    let s = seed || 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0a1a4a'); bg.addColorStop(0.55, '#0d4a82'); bg.addColorStop(0.56, '#062a50'); bg.addColorStop(1, '#021226');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.25; g.fillStyle = '#7fd4ff';
    for (let i = 0; i < 40; i++) g.fillRect(rnd() * w, h * (0.58 + rnd() * 0.4), w * (0.02 + rnd() * 0.08), Math.max(1, h * 0.004));
    g.globalAlpha = 1;
    const k = Math.min(w, h);
    const balls = [[0.22, 0.42, 0.13], [0.5, 0.3, 0.08], [0.72, 0.5, 0.16], [0.38, 0.72, 0.07], [0.87, 0.22, 0.06], [0.12, 0.8, 0.05], [0.6, 0.78, 0.045], [0.93, 0.75, 0.035], [0.3, 0.15, 0.04]];
    for (const [bx, by, br] of balls) {
      const x = bx * w, y = by * h, r = br * k * 1.4;
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.35, '#ffc830'); gr.addColorStop(0.8, '#ff7a00'); gr.addColorStop(1, '#a03c00');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = Math.max(1, k / 400);
    for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(rnd() * w, rnd() * h, k * (0.004 + rnd() * 0.012), 0, 7); g.stroke(); }
    return c;
  };

  function loadSource(node, name, isVideo, opts = {}) {
    if (rec) { status('请先结束当前录制 / 导出。'); return; }
    if (src && src.video) {
      src.el.pause();
      if (src.stream) src.stream.getTracks().forEach(tr => tr.stop());
    }
    if (src && src.url) URL.revokeObjectURL(src.url);
    src = { el: node, name, video: isVideo, url: node._url, live: !!opts.live, stream: opts.stream || null,
      w: isVideo ? node.videoWidth : (node.naturalWidth || node.width), h: isVideo ? node.videoHeight : (node.naturalHeight || node.height) };
    if (isVideo) {
      node.addEventListener('seeked', () => { needGrab = true; needDetect = true; tracker.reset(); });
      if (!opts.live) { node.loop = !!S.vidLoop; node.playbackRate = S.vidSpeed; }
      playing = true; $('#playBtn').classList.add('on');
    }
    updateVideoBar(true);
    $('#docName').textContent = name;
    renderTasks();
    tracker.reset(); prevAn = null; t = 0; frame = 0;
    needSetup = true; dirty = true;
    status(`已载入 ${name}  (${src.w}×${src.h}${isVideo ? ', 视频' : ''})`);
  }
  function loadFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|ogv)$/i.test(file.name)) {
      const v = document.createElement('video');
      v.muted = !S.vidSound; v.loop = !!S.vidLoop; v.playsInline = true; v.preload = 'auto'; v.src = url; v._url = url;
      v.addEventListener('loadeddata', () => { loadSource(v, file.name, true); v.play(); }, { once: true });
      v.addEventListener('error', () => status('视频无法解码：' + file.name));
    } else if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(file.name)) {
      const img = new Image(); img._url = url;
      img.onload = () => loadSource(img, file.name || '剪贴板图片', false);
      img.onerror = () => status('图片无法读取：' + file.name);
      img.src = url;
    } else status('不支持的文件类型：' + file.name);
  }

  function setup() {
    needSetup = false;
    if (!src) return;
    const k = Math.min(1, S.workMax / Math.max(src.w, src.h));
    W = Math.max(2, Math.round(src.w * k)); H = Math.max(2, Math.round(src.h * k));
    out.width = srcC.width = W; out.height = srcC.height = H;
    const ps = Math.max(1, S.pixelScale | 0);
    fxC.width = Math.ceil(W / ps); fxC.height = Math.ceil(H / ps);
    fx.resize(fxC.width, fxC.height);
    const ak = Math.min(1, S.detRes / Math.max(W, H));
    anC.width = Math.max(8, Math.round(W * ak)); anC.height = Math.max(8, Math.round(H * ak));
    prevAn = null;
    grab();
    needDetect = true;
    $('#stSize').textContent = `${W}×${H}  效果 ${fxC.width}×${fxC.height}`;
    fitCanvas();
  }
  function fitCanvas() {
    const view = $('#view');
    if (!W) return;
    if (view.classList.contains('fit')) {
      const k = Math.min((view.clientWidth - 8) / W, (view.clientHeight - 8) / H);
      out.style.width = Math.max(1, Math.floor(W * k)) + 'px'; out.style.height = Math.max(1, Math.floor(H * k)) + 'px';
    } else { out.style.width = W + 'px'; out.style.height = H + 'px'; }
  }
  function grab() {
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(src.el, 0, 0, W, H);
    srcData = sctx.getImageData(0, 0, W, H);
    fctx.imageSmoothingEnabled = true;
    fctx.drawImage(srcC, 0, 0, fxC.width, fxC.height);
    fx.setBase(fctx.getImageData(0, 0, fxC.width, fxC.height).data);
  }
  function detect() {
    needDetect = false;
    actx.drawImage(srcC, 0, 0, anC.width, anC.height);
    const an = actx.getImageData(0, 0, anC.width, anC.height);
    const d = BT.detect(an, prevAn, S);
    prevAn = an;
    if (src.video) d.blobs = tracker.update(d.blobs, S.trackDist * anC.width / 240, S.trackSmooth);
    det = d;
    fx.setDetection(det);
    $('#stBlobs').textContent = `blob ${det.blobs.length} / ${det.total}`;
  }

  function anyFx() { return S.ripOn || S.lakeOn || S.palOn || S.mbOn || S.dithOn || (S.bubOn && S.bubStyle !== 'ascii'); }

  function render(dt) {
    if (!src) return;
    if (src.video && (!src.el.paused || needGrab)) {
      if (src.el.readyState >= 2) { grab(); if (needGrab || frame % Math.max(1, S.detEvery | 0) === 0) needDetect = true; }
      needGrab = false;
    }
    if (needDetect) detect();
    octx.imageSmoothingEnabled = false;
    if (anyFx()) { fx.step(dt, t, S); octx.drawImage(fx.canvas, 0, 0, W, H); }
    else { if (S.bubOn) fx.bubblesStep(dt, S, fx.blobsFx(), null); octx.drawImage(srcC, 0, 0); }
    const u = S.overlayScale > 0 ? S.overlayScale | 0 : Math.max(1, Math.round(Math.min(W, H) / 560));
    BT.drawOverlay(octx, W, H, det, S, {
      u, t, frame, srcW: src.w, srcH: src.h, srcData, fx, count: det ? det.blobs.length : 0,
      charset: S.charset, scramble: S.scramble, scrambleSpeed: S.scrambleSpeed, labels: S.labels,
    });
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (needSetup) setup();
    if (playing || dirty || (src && src.video)) {
      if (playing) { t += dt; frame++; }
      render(playing ? dt : 0);
      dirty = false;
    }
    updateVideoBar();
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; $('#stFps').textContent = `${fps.toFixed(0)} fps${playing ? '' : ' (暂停)'}`; }
    requestAnimationFrame(loop);
  }

  /* ---------- actions ---------- */
  function status(m) { $('#stMsg').textContent = m; }
  BT.status = status;
  function stamp() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
  function download(blob, name) { const a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  /* ---------- video I/O ---------- */
  let rec = null;
  const MIMES = {
    mp4: ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'],
    webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm'],
  };
  function pickMime() {
    const order = S.vidFormat === 'webm' ? MIMES.webm : S.vidFormat === 'mp4' ? [...MIMES.mp4, ...MIMES.webm] : [...MIMES.mp4, ...MIMES.webm];
    const m = order.find(x => MediaRecorder.isTypeSupported(x)) || '';
    if (S.vidFormat === 'mp4' && !m.startsWith('video/mp4')) status('这个浏览器不支持录制 MP4，已改用 WebM。');
    return { mime: m, ext: m.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  /* Route element audio through Web Audio so it can be recorded while the speaker output stays independently mutable. */
  function ensureAudio(v) {
    if (v._dest) return v._dest;
    try {
      const ac = BT.audioCtx || (BT.audioCtx = new (window.AudioContext || window.webkitAudioContext)());
      if (ac.state === 'suspended') ac.resume();
      const s = ac.createMediaElementSource(v), dest = ac.createMediaStreamDestination(), g = ac.createGain();
      g.gain.value = S.vidSound ? 1 : 0;
      s.connect(dest); s.connect(g); g.connect(ac.destination);
      v._dest = dest; v._gain = g; v.muted = false;
      return dest;
    } catch (e) { return null; }
  }
  function setSound(on) {
    S.vidSound = on; save();
    if (!src || !src.video || src.live) return;
    if (src.el._gain) src.el._gain.gain.value = on ? 1 : 0;
    else src.el.muted = !on;
  }
  function makeRecorder(withAudio) {
    if (!window.MediaRecorder || !out.captureStream) { msgBox('视频导出', '这个浏览器不支持 Canvas 录制，请用新版 Chrome / Edge。'); return null; }
    const stream = out.captureStream(S.recFps);
    if (withAudio && src && src.video && !src.live) {
      const dest = ensureAudio(src.el);
      const at = dest && dest.stream.getAudioTracks()[0];
      if (at) stream.addTrack(at);
    }
    const { mime, ext } = pickMime();
    const chunks = [];
    const r = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: S.recMbps * 1e6 }, mime ? { mimeType: mime } : {}));
    r.ondataavailable = e => e.data.size && chunks.push(e.data);
    return { r, chunks, ext, type: (mime || 'video/webm').split(';')[0] };
  }
  function record() {
    if (rec) { rec.stop(); return; }
    const R = makeRecorder(S.vidAudio);
    if (!R) return;
    rec = R.r;
    rec.onstop = () => {
      download(new Blob(R.chunks, { type: R.type }), `blobtrack_${stamp()}.${R.ext}`);
      rec = null; $('#recBtn').classList.remove('on'); status(`录制完成，已下载 ${R.ext.toUpperCase()}。`);
    };
    playing = true; $('#playBtn').classList.add('on');
    if (src.video && src.el.paused) src.el.play();
    rec.start(250); $('#recBtn').classList.add('on');
    let left = S.recSec;
    status(`录制中… ${left}s（再点“录制”可提前结束）`);
    const iv = setInterval(() => { left--; if (!rec) { clearInterval(iv); return; } status(`录制中… ${left}s`); if (left <= 0) { clearInterval(iv); rec.stop(); } }, 1000);
  }
  function progressWin(title, onCancel) {
    const bar = el('div', { class: 'progress-fill' }), txt = el('div', { text: '准备中…' });
    const cancel = el('button', { class: 'btn', text: '取消' });
    const body = el('div', { style: 'padding:6px 4px' }, txt, el('div', { class: 'progress sunken', style: 'margin:8px 0 10px' }, bar), el('div', { class: 'msg-actions' }, cancel));
    const win = BT.makeWindow('progWin', title, 380, 150, body, { onClose: onCancel });
    win.style.height = 'auto';
    cancel.addEventListener('click', onCancel);
    return {
      set(f, s) { bar.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; txt.textContent = s; },
      close() { win.remove(); renderTasks(); },
    };
  }
  async function exportVideo() {
    if (!src) return;
    if (rec) { status('正在录制 / 导出中。'); return; }
    if (!src.video || src.live) { record(); return; }
    const v = src.el;
    const R = makeRecorder(S.vidAudio);
    if (!R) return;
    const keep = { loop: v.loop, rate: v.playbackRate };
    let cancelled = false, done = false, iv = 0;
    const finish = () => {
      if (done) return; done = true;
      v.removeEventListener('ended', onEnd);
      if (rec && rec.state !== 'inactive') rec.stop();
    };
    const onEnd = () => finish();
    const pw = progressWin('正在导出视频…', () => { cancelled = true; v.pause(); finish(); });
    v.pause(); v.loop = false; v.playbackRate = 1;
    tracker.reset(); prevAn = null; t = 0; frame = 0; fx.bubbles.length = 0;
    await new Promise(res => { v.addEventListener('seeked', res, { once: true }); v.currentTime = 0; });
    rec = R.r;
    rec.onstop = () => {
      clearInterval(iv);
      rec = null; $('#recBtn').classList.remove('on');
      v.loop = keep.loop; v.playbackRate = keep.rate;
      pw.close();
      if (cancelled) { status('已取消视频导出。'); }
      else {
        download(new Blob(R.chunks, { type: R.type }), `blobtrack_${(src.name || 'video').replace(/\.[^.]+$/, '')}_${stamp()}.${R.ext}`);
        status(`视频导出完成（${R.ext.toUpperCase()}，${W}×${H}，${S.recFps} fps）。`);
      }
      if (v.loop) v.play();
    };
    v.addEventListener('ended', onEnd);
    playing = true; $('#playBtn').classList.add('on'); $('#recBtn').classList.add('on');
    rec.start(250);
    try { await v.play(); } catch (e) { cancelled = true; finish(); msgBox('视频导出', '视频无法播放：' + e.message); return; }
    iv = setInterval(() => {
      const d = isFinite(v.duration) ? v.duration : 0;
      pw.set(d ? v.currentTime / d : 0, `${fmtTime(v.currentTime)} / ${d ? fmtTime(d) : '--:--'}   ${R.ext.toUpperCase()} ${W}×${H}`);
    }, 200);
  }
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msgBox('摄像头', '这个浏览器不支持摄像头，或页面不是 https / 本地文件。'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.srcObject = stream;
      await v.play();
      if (v.readyState < 2) await new Promise(res => v.addEventListener('loadeddata', res, { once: true }));
      loadSource(v, '摄像头', true, { live: true, stream });
    } catch (e) { msgBox('摄像头', '无法打开摄像头：' + (e.message || e.name)); }
  }
  function fmtTime(s) { s = Math.max(0, s || 0); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`; }
  let seeking = false;
  function updateVideoBar(force) {
    const bar = $('#videoBar');
    const isV = !!(src && src.video);
    if (bar.hidden === isV) { bar.hidden = !isV; fitCanvas(); }
    if (!isV) return;
    const v = src.el;
    if (force) {
      bar.classList.toggle('live', src.live);
      $('#vbLoop').checked = !!S.vidLoop; $('#vbSound').checked = !!S.vidSound; $('#vbSpeed').value = String(S.vidSpeed);
    }
    $('#vbPlay').textContent = v.paused ? '▶ 播放' : '❚❚ 暂停';
    if (src.live) { $('#vbTime').textContent = '● LIVE  ' + src.w + '×' + src.h; return; }
    const d = isFinite(v.duration) ? v.duration : 0;
    if (!seeking) $('#vbSeek').value = d ? Math.round(v.currentTime / d * 1000) : 0;
    $('#vbTime').textContent = `${fmtTime(v.currentTime)} / ${fmtTime(d)}`;
  }
  function initVideoBar() {
    $('#vbPlay').addEventListener('click', () => act('play'));
    $('#vbStart').addEventListener('click', () => { if (src && src.video && !src.live) src.el.currentTime = 0; });
    const sk = $('#vbSeek');
    sk.addEventListener('input', () => {
      seeking = true;
      if (src && src.video && !src.live && isFinite(src.el.duration)) src.el.currentTime = sk.value / 1000 * src.el.duration;
    });
    sk.addEventListener('change', () => { seeking = false; });
    $('#vbSpeed').addEventListener('change', e => { S.vidSpeed = parseFloat(e.target.value); save(); if (src && src.video && !src.live) src.el.playbackRate = S.vidSpeed; });
    $('#vbLoop').addEventListener('change', e => { S.vidLoop = e.target.checked; save(); if (src && src.video && !src.live) src.el.loop = S.vidLoop; });
    $('#vbSound').addEventListener('change', e => setSound(e.target.checked));
  }
  async function pasteClipboard() {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) { const tp = it.types.find(x => x.startsWith('image/')); if (tp) { const b = await it.getType(tp); loadFile(new File([b], '剪贴板图片.png', { type: tp })); return; } }
      status('剪贴板里没有图片。');
    } catch (e) { status('浏览器不允许直接读剪贴板，请在页面上按 Ctrl+V。'); }
  }
  function applyPreset(p) { Object.assign(S, p); save(); syncUI(); needDetect = true; dirty = true; }
  BT.apply = (p, name) => { applyPreset(p); if (name) status('已应用：' + name); };

  function act(a) {
    closeMenus();
    switch (a) {
      case 'open': $('#file').click(); break;
      case 'paste': pasteClipboard(); break;
      case 'demo': loadSource(BT.makeDemo(1280, 800), 'demo_orange_sea.bmp', false); break;
      case 'png': if (src) out.toBlob(b => { download(b, `blobtrack_${stamp()}.png`); status(`已导出 PNG ${W}×${H}`); }, 'image/png'); break;
      case 'rec': if (src) record(); break;
      case 'vexport': exportVideo(); break;
      case 'camera': startCamera(); break;
      case 'reset': S = Object.assign({}, D); save(); syncUI(); needSetup = true; dirty = true; status('已恢复默认设置。'); break;
      case 'play': playing = !playing; $('#playBtn').classList.toggle('on', playing); dirty = true; if (src && src.video) playing ? src.el.play() : src.el.pause(); break;
      case 'fit': $('#view').classList.add('fit'); $('#fitBtn').classList.add('on'); $('#zoomBtn').classList.remove('on'); fitCanvas(); break;
      case 'zoom': $('#view').classList.remove('fit'); $('#fitBtn').classList.remove('on'); $('#zoomBtn').classList.add('on'); fitCanvas(); break;
      case 'refs': BT.openRefs(); break;
      case 'tokens': openTokens(); break;
      case 'about': msgBox('关于 BlobTrack 98', 'BlobTrack 98  版本 1.0\n\n图片 / 视频 blob 追踪 + Win98 时代液体与气泡效果。\n全部在浏览器本地计算，不上传任何文件。'); break;
      case 'drop': {
        const b = $('#dropBtn'); const on = !b.classList.contains('on'); b.classList.toggle('on', on);
        $('#view').classList.toggle('tool-drop', on); break;
      }
    }
  }
  BT.act = act;

  /* ---------- floating windows ---------- */
  const ICON_X = '<svg width="8" height="7" viewBox="0 0 8 7"><path d="M0 0h2v1h1v1h2V1h1V0h2v1H7v1H6v1H5v1h1v1h1v1h1v1H6V6H5V5H3v1H2v1H0V6h1V5h1V4h1V3H2V2H1V1H0z"/></svg>';
  let zTop = 40;
  BT.makeWindow = function (id, title, w, h, content, opts = {}) {
    let win = document.getElementById(id);
    if (win) { win.hidden = false; win.style.zIndex = ++zTop; focusWin(win); return win; }
    const dw = $('#desktop').clientWidth, dh = $('#desktop').clientHeight;
    w = Math.min(w, dw - 20); h = Math.min(h, dh - 20);
    win = el('div', { class: 'window float', id, style: `left:${Math.max(10, (dw - w) / 2 + (opts.dx || 0))}px;top:${Math.max(10, (dh - h) / 2 + (opts.dy || 0))}px;width:${w}px;height:${h}px;z-index:${++zTop}` });
    const close = el('button', { 'aria-label': '关闭' }); close.innerHTML = ICON_X;
    const tb = el('div', { class: 'title-bar' }, el('div', { class: 'title-bar-text', text: title }), el('div', { class: 'title-bar-controls' }, close));
    const body = el('div', { class: 'window-body' }, content);
    win.append(tb, body);
    close.addEventListener('click', () => { win.hidden = true; if (opts.onClose) opts.onClose(); renderTasks(); });
    tb.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      focusWin(win);
      const ox = e.clientX - win.offsetLeft, oy = e.clientY - win.offsetTop;
      const mv = ev => { win.style.left = Math.max(-w + 60, ev.clientX - ox) + 'px'; win.style.top = Math.max(0, ev.clientY - oy) + 'px'; };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
    win.addEventListener('pointerdown', () => focusWin(win));
    $('#desktop').append(win);
    focusWin(win);
    return win;
  };
  function focusWin(win) {
    document.querySelectorAll('.window').forEach(w => w.classList.add('inactive'));
    win.classList.remove('inactive'); if (win.classList.contains('float')) win.style.zIndex = ++zTop;
    renderTasks();
  }
  function renderTasks() {
    const box = $('#tasks'); box.innerHTML = '';
    const wins = [$('#mainWin'), ...document.querySelectorAll('.window.float')].filter(w => !w.hidden);
    for (const w of wins) {
      const name = w.querySelector('.title-bar-text').textContent;
      const b = el('button', { class: 'btn task' + (w.classList.contains('inactive') ? '' : ' on'), text: name, title: name, onclick: () => focusWin(w) });
      box.append(b);
    }
  }
  function msgBox(title, text) {
    const id = 'msg' + Date.now();
    const ok = el('button', { class: 'btn default', text: '确定' });
    const ico = el('canvas', { width: 32, height: 32, style: 'flex:none;image-rendering:pixelated' });
    const g = ico.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(9, 3, 14, 26); g.fillRect(3, 9, 26, 14); g.fillRect(5, 5, 22, 22);
    g.fillStyle = '#0000ff'; g.fillRect(10, 4, 12, 24); g.fillRect(4, 10, 24, 12); g.fillRect(6, 6, 20, 20);
    g.fillStyle = '#fff'; g.fillRect(15, 8, 3, 3); g.fillRect(15, 13, 3, 11); g.fillRect(13, 13, 2, 2); g.fillRect(13, 22, 7, 2);
    const content = el('div', null, el('div', { class: 'msg' }, ico, el('div', { style: 'white-space:pre-wrap;padding-top:4px', text })), el('div', { class: 'msg-actions' }, ok));
    const win = BT.makeWindow(id, title, 380, 200, content);
    win.style.height = 'auto';
    ok.addEventListener('click', () => { win.remove(); renderTasks(); });
    ok.focus();
  }
  BT.msgBox = msgBox;
  function openTokens() {
    const rows = [['{id} {id:3}', '编号，:3 = 补零到 3 位'], ['{label}', '名称列表按编号循环'], ['{x} {y} {w} {h}', '原图像素坐标 / 尺寸'], ['{cx} {cy}', '重心坐标'], ['{area} {pct}', '面积 (像素) / 占比 %'], ['{hex} {r} {g} {b} {luma}', '平均颜色'], ['{conf}', '伪置信度，开启跳动时会变化'], ['{char} {chars:6}', '从字符集取 1 个 / 6 个字符'], ['{bar:8}', '█░ 进度条，按面积'], ['{n} {t} {frame}', '总数 / 时间码 / 帧号'], ['\\n', '换行']];
    const tbl = el('table', { style: 'border-collapse:collapse;width:100%;background:#fff' });
    rows.forEach(([a, b]) => tbl.append(el('tr', null, el('td', { style: 'padding:3px 6px;border-bottom:1px solid #c0c0c0;font-family:SimSun,monospace;white-space:nowrap', text: a }), el('td', { style: 'padding:3px 6px;border-bottom:1px solid #c0c0c0', text: b }))));
    BT.makeWindow('tokWin', '模板变量 - 帮助', 440, 380, el('div', { class: 'sunken', style: 'padding:2px' }, tbl));
  }

  /* ---------- menus ---------- */
  function closeMenus() { document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open')); $('#startMenu').classList.remove('open'); $('#startBtn').classList.remove('on'); }
  function initMenus() {
    document.querySelectorAll('.menu > button').forEach(b => {
      b.addEventListener('click', e => { const m = b.parentElement, was = m.classList.contains('open'); closeMenus(); if (!was) m.classList.add('open'); e.stopPropagation(); });
      b.addEventListener('mouseenter', () => { if (document.querySelector('.menu.open') && !b.parentElement.classList.contains('open')) { closeMenus(); b.parentElement.classList.add('open'); } });
    });
    document.addEventListener('click', e => { if (!e.target.closest('.menu') && !e.target.closest('#startMenu') && !e.target.closest('#startBtn')) closeMenus(); });
    document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); act(b.dataset.act); }));
    const pm = $('#presetMenu'), sm = $('#startPresets'), ps = $('#presetSel');
    for (const name in PRESETS) {
      pm.append(el('button', { text: name, onclick: () => { closeMenus(); BT.apply(PRESETS[name], name); } }));
      sm.append(el('button', { text: name, onclick: () => { closeMenus(); BT.apply(PRESETS[name], name); } }));
      ps.append(el('option', { value: name, text: name }));
    }
    ps.addEventListener('change', () => { if (ps.value) BT.apply(PRESETS[ps.value], ps.value); ps.value = ''; });
    $('#startBtn').addEventListener('click', e => { e.stopPropagation(); const m = $('#startMenu'), o = !m.classList.contains('open'); closeMenus(); m.classList.toggle('open', o); $('#startBtn').classList.toggle('on', o); });
    $('#mainClose').addEventListener('click', () => msgBox('BlobTrack 98', '这是网页，关不掉的。\n要退出请关闭浏览器标签页。'));
  }

  /* ---------- input ---------- */
  function initInput() {
    $('#file').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
    const view = $('#view');
    ['dragenter', 'dragover'].forEach(n => document.addEventListener(n, e => { e.preventDefault(); view.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(n => document.addEventListener(n, e => { e.preventDefault(); if (n === 'drop' || !e.relatedTarget) view.classList.remove('drag-over'); }));
    document.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
    document.addEventListener('paste', e => {
      for (const it of e.clipboardData.items) if (it.type.startsWith('image/')) { loadFile(it.getAsFile()); e.preventDefault(); return; }
    });
    document.addEventListener('keydown', e => {
      if (e.target.matches('input,textarea')) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'o') { e.preventDefault(); act('open'); }
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); act('png'); }
      if (e.key === ' ') { e.preventDefault(); act('play'); }
    });
    let down = false;
    const toFx = e => { const r = out.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * fx.w, (e.clientY - r.top) / r.height * fx.h, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    out.addEventListener('pointerdown', e => {
      if (!$('#dropBtn').classList.contains('on') || !src) return;
      down = true; out.setPointerCapture(e.pointerId);
      if (!S.ripOn) { S.ripOn = true; syncUI(); save(); status('已自动开启 2D 水波。'); }
      const [x, y] = toFx(e); fx.drop(x, y, S.ripSize + 1, S.ripAmp * 1.5);
    });
    out.addEventListener('pointermove', e => {
      const [x, y, nx, ny] = toFx(e);
      if (down) fx.drop(x, y, S.ripSize, S.ripAmp * 0.6);
      if (det) {
        const ax = Math.floor(nx * det.w), ay = Math.floor(ny * det.h);
        if (ax >= 0 && ay >= 0 && ax < det.w && ay < det.h) {
          const k = det.keep[det.labels[ay * det.w + ax]];
          const b = k ? det.blobs[k - 1] : null;
          $('#stMsg').textContent = `X ${Math.round(nx * src.w)}  Y ${Math.round(ny * src.h)}` + (b ? `   ▶ blob #${b.id}  面积 ${(b.area / (det.w * det.h) * 100).toFixed(2)}%` : '');
        }
      }
    });
    out.addEventListener('pointerup', () => { down = false; });
  }

  function drawIcon(c) {
    const g = c.getContext('2d');
    g.fillStyle = '#008080'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#ff8c00'; g.fillRect(4, 5, 8, 7); g.fillRect(5, 4, 6, 9); g.fillStyle = '#ffd84a'; g.fillRect(5, 5, 3, 2);
    g.fillStyle = '#00ff00'; g.fillRect(1, 1, 4, 1); g.fillRect(1, 1, 1, 4); g.fillRect(11, 1, 4, 1); g.fillRect(14, 1, 1, 4);
    g.fillRect(1, 14, 4, 1); g.fillRect(1, 11, 1, 4); g.fillRect(11, 14, 4, 1); g.fillRect(14, 11, 1, 4);
  }

  function clock() { const d = new Date(); $('#clock').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

  window.addEventListener('DOMContentLoaded', () => {
    buildUI(); initMenus(); initInput(); initVideoBar();
    document.querySelectorAll('canvas.app-ico').forEach(drawIcon);
    clock(); setInterval(clock, 10000);
    renderTasks();
    new ResizeObserver(fitCanvas).observe($('#view'));
    act('demo');
    requestAnimationFrame(t0 => { last = t0; requestAnimationFrame(loop); });
  });
})();
