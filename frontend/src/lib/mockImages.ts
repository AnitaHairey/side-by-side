// Inline SVG "screenshots" for the JD 白条 demo. Each guide mimics the icon
// layout of the corresponding real screenshot and circles the area the user
// should tap.

function svg(body: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(body)}`;
}

const W = 360;
const H = 720;

function pageHeader(color: string, title: string): string {
  return `
    <rect x="0" y="0" width="${W}" height="60" fill="${color}"/>
    <text x="20" y="38" font-family="PingFang SC,sans-serif" font-size="18" fill="#fff">‹</text>
    <text x="${W / 2}" y="38" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="17" font-weight="700" fill="#fff">${title}</text>
  `;
}

function ring(cx: number, cy: number, rx: number, ry: number, label: string): string {
  return `
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#ff3b30" stroke-width="3"/>
    <circle cx="${cx + rx + 16}" cy="${cy - ry + 4}" r="14" fill="#ff3b30"/>
    <text x="${cx + rx + 16}" y="${cy - ry + 9}" text-anchor="middle" fill="#fff" font-family="PingFang SC,sans-serif" font-size="14" font-weight="700">${label}</text>
  `;
}

function frameSvg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#fdf2f0"/>
    ${inner}
  </svg>`;
}

// === image1: 京东「我的」页面，高亮「我的」tab + 箭头指向「白条」 ===
const guideMine = frameSvg(`
  <!-- 顶部：减重 banner + 客服/地址/设置 -->
  <rect x="12" y="14" width="200" height="34" rx="17" fill="#fff"/>
  <rect x="20" y="20" width="44" height="22" rx="11" fill="#e93323"/>
  <text x="42" y="36" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" font-weight="700" fill="#fff">减重</text>
  <text x="74" y="36" font-family="PingFang SC,sans-serif" font-size="12" fill="#2a210f">0.01元领体脂秤</text>

  <text x="${W - 96}" y="32" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="#5b6068">客服</text>
  <text x="${W - 60}" y="32" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="#5b6068">地址</text>
  <text x="${W - 24}" y="32" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="#5b6068">设置</text>

  <!-- 用户卡 -->
  <rect x="12" y="58" width="${W - 24}" height="92" rx="14" fill="#fff"/>
  <circle cx="44" cy="100" r="22" fill="#ff7a45"/>
  <text x="44" y="106" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="13" font-weight="800" fill="#fff">JD</text>
  <text x="78" y="92" font-family="PingFang SC,sans-serif" font-size="13" font-weight="700" fill="#2a210f">u_b3qicnrpo…</text>
  <text x="78" y="110" font-family="PingFang SC,sans-serif" font-size="10" fill="#9a8a63">银牌会员</text>
  <rect x="${W - 110}" y="80" width="98" height="38" rx="10" fill="#dff1ff"/>
  <text x="${W - 61}" y="105" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="12" font-weight="700" fill="#2977ff">学生会员 ›</text>

  <!-- 优惠券行 -->
  ${[
    ['9张', '优惠券', '#fff0d6', '🎟'],
    ['明细', '京豆', '#fff0d6', '豆'],
    ['抽¥50', '红包', '#ffe1e1', '包'],
    ['¥228', '省钱卡', '#fff0d6', '卡'],
    ['1张', '秒送', '#fff0d6', '送'],
  ]
    .map(
      ([n, t, bg, icon], i) => `
      <circle cx="${44 + i * 64}" cy="142" r="14" fill="${bg}"/>
      <text x="${44 + i * 64}" y="146" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="#e93323" font-weight="700">${icon}</text>
      <text x="${44 + i * 64}" y="172" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" font-weight="700" fill="#2a210f">${n}</text>
      <text x="${44 + i * 64}" y="186" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="9" fill="#9a8a63">${t}</text>
      `,
    )
    .join('')}

  <!-- 女性专区 banner -->
  <rect x="12" y="200" width="${W - 24}" height="36" rx="10" fill="#ffe6f0"/>
  <text x="22" y="223" font-family="PingFang SC,sans-serif" font-size="12" font-weight="700" fill="#e93323">女性专区</text>
  <text x="84" y="223" font-family="PingFang SC,sans-serif" font-size="11" fill="#5b6068">1分领大牌小样</text>
  <rect x="${W - 88}" y="205" width="74" height="26" rx="13" fill="#ff5a8a"/>
  <text x="${W - 51}" y="222" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" font-weight="700" fill="#fff">去领取</text>

  <!-- 足迹/收藏/关注/种草 -->
  ${[
    ['足迹', '49'],
    ['收藏', '3'],
    ['关注', '2'],
    ['种草', '发现'],
  ]
    .map(([t, n], i) => `
      <text x="${36 + i * 88}" y="262" font-family="PingFang SC,sans-serif" font-size="13" font-weight="700" fill="#2a210f">${t}</text>
      <text x="${36 + i * 88 + 30}" y="262" font-family="PingFang SC,sans-serif" font-size="11" fill="#9a8a63">${n}</text>
    `).join('')}

  <!-- 订单 icon 行 -->
  <rect x="12" y="280" width="${W - 24}" height="78" rx="14" fill="#fff"/>
  ${[
    ['📃', '待付款'],
    ['📦', '待收货'],
    ['🎫', '待使用'],
    ['💬', '待评价'],
    ['↩️', '退换/售后'],
  ].map(([ic, t], i) => {
    const cx = 32 + i * (W - 64) / 4;
    return `
      <circle cx="${cx}" cy="312" r="14" fill="#fff7e0"/>
      <text x="${cx}" y="318" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="13">${ic}</text>
      <text x="${cx}" y="346" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="10" fill="#2a210f">${t}</text>
    `;
  }).join('')}

  <!-- 三栏卡片 -->
  <!-- 钱包卡 -->
  <rect x="12" y="372" width="${(W - 36) / 3}" height="220" rx="14" fill="#fff"/>
  <text x="24" y="396" font-family="PingFang SC,sans-serif" font-size="14" font-weight="800" fill="#2a210f">钱包 ›</text>
  <text x="24" y="414" font-family="PingFang SC,sans-serif" font-size="10" fill="#9a8a63">请查收周账单</text>

  <text x="24" y="452" font-family="PingFang SC,sans-serif" font-size="20" font-weight="800" fill="#2a210f">316.78</text>
  <text x="24" y="468" font-family="PingFang SC,sans-serif" font-size="10" fill="#9a8a63">白条 ›</text>

  <text x="24" y="500" font-family="PingFang SC,sans-serif" font-size="16" font-weight="800" fill="#2a210f">198000</text>
  <text x="24" y="516" font-family="PingFang SC,sans-serif" font-size="10" fill="#9a8a63">金条借款 ›</text>

  <text x="24" y="548" font-family="PingFang SC,sans-serif" font-size="14" font-weight="800" fill="#2a210f">¥1034.1</text>
  <text x="24" y="564" font-family="PingFang SC,sans-serif" font-size="10" fill="#9a8a63">黄金 ›</text>

  <!-- 京东服务 -->
  <rect x="${24 + (W - 36) / 3}" y="372" width="${(W - 36) / 3}" height="220" rx="14" fill="#fff"/>
  <text x="${36 + (W - 36) / 3}" y="396" font-family="PingFang SC,sans-serif" font-size="14" font-weight="800" fill="#2a210f">京东服务 ›</text>
  <text x="${36 + (W - 36) / 3}" y="414" font-family="PingFang SC,sans-serif" font-size="10" fill="#9a8a63">新客回收券限时领</text>
  <rect x="${36 + (W - 36) / 3}" y="424" width="${(W - 36) / 3 - 24}" height="58" rx="8" fill="#ffe6cc"/>
  <text x="${46 + (W - 36) / 3}" y="448" font-family="PingFang SC,sans-serif" font-size="11" font-weight="800" fill="#e93323">领1855元</text>
  <text x="${46 + (W - 36) / 3}" y="466" font-family="PingFang SC,sans-serif" font-size="9" fill="#e93323">新人回收券</text>
  <circle cx="${36 + (W - 36) / 3 + 14}" cy="510" r="11" fill="#ff5a3c"/>
  <text x="${36 + (W - 36) / 3 + 32}" y="514" font-family="PingFang SC,sans-serif" font-size="11" fill="#2a210f">京东快递</text>
  <circle cx="${36 + (W - 36) / 3 + 14}" cy="540" r="11" fill="#ffb74a"/>
  <text x="${36 + (W - 36) / 3 + 32}" y="544" font-family="PingFang SC,sans-serif" font-size="11" fill="#2a210f">家电回收</text>

  <!-- 互动游戏 -->
  <rect x="${36 + 2 * (W - 36) / 3}" y="372" width="${(W - 36) / 3}" height="220" rx="14" fill="#fff"/>
  <text x="${48 + 2 * (W - 36) / 3}" y="396" font-family="PingFang SC,sans-serif" font-size="14" font-weight="800" fill="#2a210f">互动游戏 ›</text>
  <text x="${48 + 2 * (W - 36) / 3}" y="414" font-family="PingFang SC,sans-serif" font-size="10" fill="#9a8a63">海量京豆免费领</text>
  <rect x="${48 + 2 * (W - 36) / 3}" y="424" width="${(W - 36) / 3 - 24}" height="58" rx="8" fill="#ffd2d2"/>
  <text x="${58 + 2 * (W - 36) / 3}" y="448" font-family="PingFang SC,sans-serif" font-size="11" font-weight="800" fill="#e93323">最高88豆</text>
  <text x="${58 + 2 * (W - 36) / 3}" y="466" font-family="PingFang SC,sans-serif" font-size="9" fill="#e93323">24点失效</text>
  <circle cx="${48 + 2 * (W - 36) / 3 + 14}" cy="510" r="11" fill="#ffd24a"/>
  <text x="${48 + 2 * (W - 36) / 3 + 32}" y="514" font-family="PingFang SC,sans-serif" font-size="11" fill="#2a210f">京豆乐园</text>
  <circle cx="${48 + 2 * (W - 36) / 3 + 14}" cy="540" r="11" fill="#ff5a3c"/>
  <text x="${48 + 2 * (W - 36) / 3 + 32}" y="544" font-family="PingFang SC,sans-serif" font-size="11" fill="#2a210f">赚红包</text>

  <!-- 箭头：从「我的」 tab 指向「白条」 -->
  <defs>
    <marker id="arrowR" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0 0 L10 5 L0 10 z" fill="#ff3b30"/>
    </marker>
  </defs>
  <path
    d="M ${W - 50} ${H - 60}
       C ${W - 50} 540, 200 540, 110 470"
    stroke="#ff3b30" stroke-width="3" fill="none" stroke-dasharray="6 5" marker-end="url(#arrowR)"
  />

  <!-- 圈出底部「我的」tab -->
  <rect x="0" y="${H - 64}" width="${W}" height="64" fill="#fff"/>
  ${['首页', '补', '消息', '购物车', '我的'].map((t, i) => {
    const x = 36 + i * (W - 72) / 4;
    const active = t === '我的';
    return `<text x="${x}" y="${H - 18}" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="${active ? '#e93323' : '#9a8a63'}" font-weight="${active ? 700 : 400}">${t}</text>`;
  }).join('')}
  ${ring(W - 50, H - 32, 30, 24, '1')}

  <!-- 圈出钱包里的「白条 316.78」 -->
  ${ring(60, 460, 56, 22, '2')}
`);

// === image2: 白条页面，高亮「查账还款」 ===
const guideBaitiao = frameSvg(`
  <!-- 顶部红色 header (去掉返回上面的标题区) -->
  <rect x="0" y="0" width="${W}" height="120" fill="#e93323"/>
  <text x="20" y="38" font-family="PingFang SC,sans-serif" font-size="20" fill="#fff">‹</text>
  <text x="56" y="40" font-family="PingFang SC,sans-serif" font-size="20" font-weight="800" fill="#fff">白条</text>
  <text x="100" y="40" font-family="PingFang SC,sans-serif" font-size="11" fill="#fff" opacity="0.85">简单·快捷·安全</text>
  <text x="${W - 60}" y="40" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="#fff">客服</text>
  <text x="${W - 24}" y="38" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="14" font-weight="700" fill="#fff">⋯</text>

  <!-- 副信息：吉祥物 + 7折券 + 信誉分 -->
  <ellipse cx="38" cy="92" rx="22" ry="22" fill="#fff"/>
  <ellipse cx="44" cy="86" rx="6" ry="8" fill="#fff" stroke="#e93323" strokeWidth="1"/>
  <circle cx="42" cy="84" r="2" fill="#1a1a1f"/>
  <path d="M30 96 q8 6 16 0" stroke="#ff9c2e" strokeWidth="3" fill="none" strokeLinecap="round"/>
  <rect x="74" y="76" width="160" height="32" rx="16" fill="#ffe9c2"/>
  <rect x="84" y="84" width="22" height="16" rx="3" fill="#ff8a3c"/>
  <text x="95" y="97" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="10" font-weight="700" fill="#fff">¥</text>
  <text x="118" y="97" font-family="PingFang SC,sans-serif" font-size="12" fill="#5b3812">领取息费7折券</text>
  <rect x="${W - 110}" y="76" width="98" height="32" rx="16" fill="#ffe9c2"/>
  <text x="${W - 95}" y="97" font-family="PingFang SC,sans-serif" font-size="11" fill="#5b3812">信誉分683 ›</text>

  <!-- 主卡片 -->
  <rect x="14" y="120" width="${W - 28}" height="276" rx="20" fill="#fff"/>
  <text x="${W / 2}" y="160" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="13" fill="#9a8a63">5月19日待还</text>
  <rect x="${W / 2 + 32}" y="148" width="42" height="18" rx="4" fill="#fff" stroke="#eee"/>
  <text x="${W / 2 + 53}" y="161" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="#9a8a63">已出账</text>

  <text x="${W / 2}" y="216" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="42" font-weight="800" fill="#2a210f">316.78</text>
  <rect x="${W / 2 - 80}" y="232" width="160" height="28" rx="14" fill="#ff3b30"/>
  <text x="${W / 2}" y="252" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="12" font-weight="700" fill="#fff">可得53.17  分期还款 ›</text>

  <line x1="${W / 2}" y1="282" x2="${W / 2}" y2="338" stroke="#eee" stroke-width="1"/>
  <text x="${W / 4 + 8}" y="306" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="14" fill="#2a210f">可用额度</text>
  <text x="${W / 4 + 8}" y="328" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="13" fill="#9a8a63">1,107.08 去提额 ›</text>

  <text x="${(W * 3) / 4 - 8}" y="306" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="14" fill="#2a210f" font-weight="700">查账还款</text>
  <text x="${(W * 3) / 4 - 8}" y="328" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="13" fill="#9a8a63">还款日5月19日 ›</text>

  <rect x="34"        y="354" width="${(W - 68 - 16) / 2}" height="34" rx="17" fill="#f4f4f8"/>
  <text x="${34 + (W - 68 - 16) / 4}" y="376" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="13" fill="#2a210f">白条取现</text>
  <rect x="${34 + (W - 68 - 16) / 2 + 16}" y="354" width="${(W - 68 - 16) / 2}" height="34" rx="17" fill="#f4f4f8"/>
  <text x="${34 + (W - 68 - 16) / 2 + 16 + (W - 68 - 16) / 4}" y="376" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="13" fill="#2a210f">额度管理</text>

  <!-- icon row：金条借款 / 先享后付 / 天天来提额 / 京东信誉分 / 大牌免息 -->
  ${[
    { t: '金条借款', draw: (cx: number, cy: number) => `
        <circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="#2a210f" stroke-width="1.6"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" font-weight="800" fill="#2a210f">借</text>
      `},
    { t: '先享后付', draw: (cx: number, cy: number) => `
        <path d="M ${cx - 10} ${cy - 4} q 10 -14 20 0 v 14 a 4 4 0 0 1 -4 4 h -12 a 4 4 0 0 1 -4 -4 z" fill="none" stroke="#2a210f" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M ${cx - 4} ${cy - 4} v -2 a 4 4 0 0 1 8 0 v 2" fill="none" stroke="#ff5a3c" stroke-width="1.6"/>
      `},
    { t: '天天来提额', draw: (cx: number, cy: number) => `
        <rect x="${cx - 11}" y="${cy - 11}" width="22" height="22" rx="3" fill="none" stroke="#2a210f" stroke-width="1.6"/>
        <text x="${cx}" y="${cy + 1}" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" font-weight="800" fill="#2a210f">¥</text>
        <path d="M ${cx} ${cy + 4} l 0 6 m -4 -3 l 4 -3 l 4 3" stroke="#ff5a3c" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      `},
    { t: '京东信誉分', draw: (cx: number, cy: number) => `
        <path d="M ${cx} ${cy - 12} l 12 4 v 10 q 0 8 -12 12 q -12 -4 -12 -12 v -10 z" fill="none" stroke="#2a210f" stroke-width="1.6" stroke-linejoin="round"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="10" font-weight="800" fill="#2a210f">分</text>
      `},
    { t: '大牌免息', draw: (cx: number, cy: number) => `
        <path d="M ${cx - 12} ${cy - 4} l 12 -10 l 12 10 v 10 a 2 2 0 0 1 -2 2 h -20 a 2 2 0 0 1 -2 -2 z" fill="none" stroke="#2a210f" stroke-width="1.6" stroke-linejoin="round"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="9" font-weight="800" fill="#2a210f">24期</text>
      `},
  ].map(({ t, draw }, i) => {
    const cx = 36 + i * (W - 72) / 4;
    const cy = 432;
    return `
      ${draw(cx, cy)}
      <text x="${cx}" y="${cy + 30}" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="#2a210f">${t}</text>
    `;
  }).join('')}
  <circle cx="${W / 2 - 30}" cy="478" r="2" fill="#bbb"/>
  <circle cx="${W / 2 - 18}" cy="478" r="2" fill="#bbb"/>
  <circle cx="${W / 2 - 6}" cy="478" r="2" fill="#bbb"/>

  <!-- 消息条 -->
  <rect x="14" y="498" width="${W - 28}" height="38" rx="10" fill="#fff"/>
  <text x="28" y="522" font-family="PingFang SC,sans-serif" font-size="12" fill="#5b6068">消息  白条取现功能开放通知</text>
  <text x="${W - 28}" y="522" text-anchor="end" font-family="PingFang SC,sans-serif" font-size="11" fill="#9a8a63">4小时前 ›</text>

  <!-- 母亲节 banner -->
  <rect x="14" y="546" width="${W - 28}" height="100" rx="14" fill="#ffe6e6"/>
  <text x="28" y="572" font-family="PingFang SC,sans-serif" font-size="11" fill="#5b3812">母亲节·白条许愿机</text>
  <text x="28" y="600" font-family="PingFang SC,sans-serif" font-size="16" font-weight="700" fill="#e93323">马上许愿 送礼给妈妈</text>
  <rect x="28" y="612" width="80" height="26" rx="13" fill="#ff5a3c"/>
  <text x="68" y="630" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" font-weight="700" fill="#fff">去领好运</text>
  <!-- 花束占位 -->
  <ellipse cx="${W - 100}" cy="600" rx="30" ry="22" fill="#ffc8d8"/>
  <rect x="${W - 110}" y="610" width="20" height="24" rx="4" fill="#9ec8ff"/>
  <!-- 寻宝 -->
  <rect x="${W - 56}" y="556" width="40" height="40" rx="6" fill="#ff5a3c"/>
  <text x="${W - 36}" y="578" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="10" fill="#fff" font-weight="700">点我</text>
  <text x="${W - 36}" y="592" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="10" fill="#fff" font-weight="700">寻宝</text>
  <text x="${W - 36}" y="612" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="9" fill="#9a8a63">最高50</text>

  <!-- 圈出查账还款 + 标 1 -->
  ${ring((W * 3) / 4 - 8, 318, 76, 28, '1')}

  <!-- 底部 tabbar -->
  <rect x="0" y="${H - 64}" width="${W}" height="64" fill="#fff"/>
  ${[
    { t: '白条', icon: (cx: number, cy: number) => `<rect x="${cx - 8}" y="${cy - 14}" width="16" height="18" rx="2" fill="#e93323"/>` },
    { t: '白条权益', icon: (cx: number, cy: number) => `<path d="M ${cx - 10} ${cy - 4} l 4 -10 l 6 6 l 6 -6 l 4 10 z" fill="#9a8a63"/>` },
    { t: '我的', icon: (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy - 8}" r="5" fill="#9a8a63"/><path d="M ${cx - 10} ${cy + 4} a 10 6 0 0 1 20 0" fill="#9a8a63"/>` },
  ].map(({ t, icon }, i) => {
    const cx = (W / 3) * i + W / 6;
    const cy = H - 30;
    const active = t === '白条';
    return `
      ${icon(cx, cy)}
      <text x="${cx}" y="${H - 8}" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="${active ? '#e93323' : '#9a8a63'}" font-weight="${active ? 700 : 400}">${t}</text>
    `;
  }).join('')}
`);

// === image3: 我的账单页面，圈出「分期还款」和「还款」让 AI 提示需要决定 ===
const guideRepay = frameSvg(`
  ${pageHeader('#e93323', '我的账单')}

  <rect x="14" y="76" width="${W - 28}" height="36" rx="6" fill="#ff7a45"/>
  <text x="30" y="100" font-family="PingFang SC,sans-serif" font-size="12" fill="#fff">📢 警惕！这5类新型诈骗套路！</text>

  <rect x="${W / 2 - 110}" y="124" width="220" height="36" rx="18" fill="#ffe6e6"/>
  <text x="${W / 2}" y="148" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="13" fill="#2a210f">微信还款提醒未开启 ›</text>

  <rect x="14" y="172" width="${W - 28}" height="320" rx="20" fill="#fff"/>
  <text x="28"        y="200" font-family="PingFang SC,sans-serif" font-size="13" fill="#2a210f">5月账单 明细 ›</text>
  <text x="${W - 28}" y="200" text-anchor="end" font-family="PingFang SC,sans-serif" font-size="13" fill="#9a8a63">还款日5月19日</text>
  <line x1="28" y1="216" x2="${W - 28}" y2="216" stroke="#eee"/>

  <text x="${W / 2}" y="248" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="12" fill="#9a8a63">剩余待还(元) 已出账</text>
  <text x="${W / 2}" y="298" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="38" font-weight="800" fill="#2a210f">316.78</text>

  <!-- 分期还款 (大红按钮) -->
  <rect x="42" y="332" width="${W - 84}" height="46" rx="23" fill="#ff3b30"/>
  <text x="${W / 2}" y="362" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="16" font-weight="800" fill="#fff">分期还款</text>
  <rect x="${W / 2 - 44}" y="318" width="88" height="22" rx="11" fill="#fff" stroke="#ffb89e"/>
  <text x="${W / 2}"  y="334" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="#e93323">必得53.17元</text>

  <!-- 还款 (白色按钮) -->
  <rect x="42" y="394" width="${W - 84}" height="46" rx="23" fill="#fff" stroke="#eee"/>
  <text x="${W / 2}" y="424" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="16" font-weight="700" fill="#2a210f">还   款</text>

  <text x="${W / 3 + 10}" y="476" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="12" fill="#9a8a63">下期账单</text>
  <line x1="${W / 2}" y1="464" x2="${W / 2}" y2="482" stroke="#eee"/>
  <text x="${(W * 2) / 3 - 10}" y="476" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="12" fill="#9a8a63">全部账单</text>

  ${ring(W / 2, 355, 130, 30, '?')}
  ${ring(W / 2, 417, 130, 28, '?')}

  <!-- 提示卡 -->
  <rect x="14" y="510" width="${W - 28}" height="80" rx="14" fill="#fff"/>
  ${['自动分期', '享国家贴息', '自动还款'].map((t, i) => {
    const x = 28 + i * (W - 56) / 2 - (i === 0 ? 0 : 0);
    const cx = 28 + ((W - 56) / 3) * i + (W - 56) / 6;
    return `
      <circle cx="${cx}" cy="540" r="14" fill="none" stroke="#5b6068" stroke-width="1.4"/>
      <text x="${cx}" y="576" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="11" fill="#2a210f">${t}</text>
    `;
  }).join('')}
`);

export const MOCK_IMAGES = {
  // The SMS that the user uploads as the first message — we point to the
  // file in the project root. (Vite serves project root via `/@fs/...` only
  // in dev; here we serve a copy from /public via dev proxy fallback. To
  // keep it simple the SMS is shown inline in the user's optimistic message
  // attachment, so this URL is only used as a fallback preview.)
  smsPreview: '/sms.jpg',
  mine: svg(guideMine),
  baitiao: svg(guideBaitiao),
  repay: svg(guideRepay),
};
