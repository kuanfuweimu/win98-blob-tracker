/* Reference window: each card runs the real effect on a tiny demo image, plus source links. */
(function () {
  const BT = window.BT;
  const CARDS = [
    {
      title: '调色板循环 Color Cycling',
      desc: '像素本身不动，只把调色板的颜色索引一格格轮转。8 位游戏和 Win98 时代的瀑布、波光、熔岩都是这样做的，几乎零成本。',
      use: '液体 → 调色板循环',
      fx: { palOn: true, palName: 'water', palRegion: 'all', palFlow: 'y', palBands: 3, palMix: 0.9 },
      apply: { palOn: true, palName: 'water', palRegion: 'outside', palFlow: 'y', palBands: 3, palMix: 0.6 },
      links: [['Mark Ferrari 8-bit 色彩循环 (canvascycle)', 'http://www.effectgames.com/demos/canvascycle/'], ['源码 jhuckaby/canvascycle', 'https://github.com/jhuckaby/canvascycle']],
    },
    {
      title: '2D 水波 Hugo Elias',
      desc: '两张高度图交替：新值 = 四邻平均×2 − 旧值，再乘阻尼。用相邻高度差去偏移取样位置，就得到折射；再按高度差加亮，就有高光。90 年代 demo 和 Java 水波 applet 的标配。',
      use: '液体 → 2D 水波，画面上可拖动搅水',
      fx: { ripOn: true, ripRain: 5, ripPulse: 0.6, ripSize: 2, ripAmp: 260 },
      apply: { ripOn: true, ripRain: 2, ripPulse: 0.5 },
      links: [['Hugo Elias: 2D Water (存档)', 'https://web.archive.org/web/2016/http://freespace.virgin.net/hugo.elias/graphics/x_water.htm']],
    },
    {
      title: '湖面倒影 Anfy Lake',
      desc: 'Anfy 的 Lake Java applet 在 1997–2000 年的个人主页上非常流行：把图片下半部分做镜像，再按行加正弦偏移，形成会动的湖面倒影。',
      use: '液体 → 湖面倒影',
      fx: { lakeOn: true, lakeY: 0.55, lakeAmp: 3, lakeTintAmt: 0.35 },
      apply: { lakeOn: true, lakeY: 0.62 },
      links: [['Anfy Lake applet 存档', 'https://1archive.com/java/anfy/anlake/']],
    },
    {
      title: '元球液体 Metaballs',
      desc: '每个球贡献 r²/d² 的场，叠加后超过阈值的地方就是“液体”，两个球靠近会自然粘连。分三段色加黑色描边，是早期屏保和 demo 里胶状液体的典型画法。',
      use: '液体 → 元球液体 (以 blob 为球心)',
      fx: { mbOn: true, mbStyle: 'flat3', mbColor: '#ff8c00', mbFree: 5, mbSat: 2, mbSize: 0.5 },
      apply: { mbOn: true, mbStyle: 'flat3', mbSat: 3, mbMix: 0.9 },
      links: [['Metaballs (Wikipedia)', 'https://en.wikipedia.org/wiki/Metaballs'], ['M4tini/metaballs', 'https://github.com/M4tini/metaballs']],
    },
    {
      title: '有序抖动 Bayer Dithering',
      desc: '16 色 / 256 色显示时，用 Bayer 矩阵把渐变拆成规律的点阵，靠人眼混色还原透明感和水的层次。Win98 在 16 色模式下显示图片、GIF 动画里的水都是这种棋盘点。',
      use: '液体 → 有序抖动',
      fx: { dithOn: true, dithPal: 'win16', dithSpread: 48 }, cycleDither: true,
      apply: { dithOn: true, dithPal: 'water', dithSpread: 48 },
      links: [['Ordered dithering (Wikipedia)', 'https://en.wikipedia.org/wiki/Ordered_dithering']],
    },
    {
      title: '像素气泡 Pixel Bubbles',
      desc: 'Win98 Plus!“海底世界 Underwater”主题和水族箱屏保里的气泡：1 像素描边圆 + 左上角高光点，正弦摆动上升，破裂时散成 8 个像素点。',
      use: '液体 → 像素气泡',
      fx: { bubOn: true, bubSource: 'bottom', bubRate: 14, bubMax: 4, bubMin: 1, bubSpeed: 0.8 },
      apply: { bubOn: true, bubStyle: 'classic', bubRate: 10 },
      links: [['Windows 98 屏保合集', 'https://jasperbernaers.com/windows98-screensaver/'], ['Microsoft Plus! 98 (Wikipedia)', 'https://en.wikipedia.org/wiki/Microsoft_Plus!']],
    },
  ];
  const OFF = { ripOn: false, lakeOn: false, palOn: false, mbOn: false, dithOn: false, bubOn: false };

  let running = false, cards = [];
  function tick(now) {
    if (!running) return;
    const t = now / 1000;
    for (const c of cards) {
      if (c.S.dithOn && c.cycleDither) {
        const pals = ['win16', 'water', 'cga', 'duo', 'orange'];
        c.S.dithPal = pals[Math.floor(t / 1.6) % pals.length];
        c.tag.textContent = '调色板: ' + c.S.dithPal;
      }
      c.fx.step(1 / 60, t, c.S);
      c.g.drawImage(c.fx.canvas, 0, 0);
    }
    requestAnimationFrame(tick);
  }

  BT.openRefs = function () {
    const exists = document.getElementById('refWin');
    if (exists) { BT.makeWindow('refWin'); running = true; requestAnimationFrame(tick); return; }
    const W = 160, H = 100;
    const demo = BT.makeDemo(W, H, 3);
    const data = demo.getContext('2d').getImageData(0, 0, W, H);
    const det = BT.detect(data, null, Object.assign({}, BT.DEFAULTS, { threshold: 150, minArea: 0.3, morph: 0 }));
    const grid = document.createElement('div'); grid.className = 'ref-grid';
    cards = CARDS.map(cd => {
      const card = document.createElement('div'); card.className = 'ref-card';
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const fx = new BT.FX(); fx.resize(W, H); fx.setBase(data.data); fx.setDetection(det);
      const S = Object.assign({}, BT.DEFAULTS, OFF, cd.fx);
      const tag = document.createElement('div'); tag.className = 'hint';
      card.innerHTML = `<h4></h4>`;
      card.querySelector('h4').textContent = cd.title;
      card.append(cv, tag);
      const p = document.createElement('p'); p.textContent = cd.desc; card.append(p);
      const use = document.createElement('p'); use.className = 'use'; use.textContent = '站内位置：' + cd.use; card.append(use);
      const links = document.createElement('div'); links.className = 'links';
      for (const [l, u] of cd.links) { const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.textContent = l; a.title = u; links.append(a); }
      card.append(links);
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = '应用到画面'; b.style.marginTop = '6px';
      b.addEventListener('click', () => BT.apply(cd.apply, cd.title));
      card.append(b);
      grid.append(card);
      return { fx, S, g: cv.getContext('2d'), tag, cycleDither: cd.cycleDither };
    });
    const intro = document.createElement('div'); intro.className = 'hint'; intro.style.marginBottom = '8px';
    intro.textContent = '下面每个小窗口都在实时运行站内同一套算法。点“应用到画面”会把该效果叠加到当前图片上。';
    const wrap = document.createElement('div'); wrap.append(intro, grid);
    BT.makeWindow('refWin', '参考资料 - Win98 时代的液体与气泡', 860, 640, wrap, { onClose: () => { running = false; } });
    running = true; requestAnimationFrame(tick);
  };
})();
