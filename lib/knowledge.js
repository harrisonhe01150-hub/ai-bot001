// lib/knowledge.js
// ⚠️ 本文件的内置知识（SECTIONS）与检索逻辑是 meihui-wecom-kf 仓库 src/knowledge.js
//    的副本，两端必须保持一致；文件末尾多出一段「远程快照接入」是网站独有的。
//
// 美辉科技产品知识库 —— 从公司内部资料（AI饲料）提炼。
// 采用关键词检索、按需注入：每次对话只把命中的主题节附加到系统提示词，
// 避免提示词过长。零依赖，内容更新直接改本文件即可。

const SECTIONS = [
  {
    id: 'products',
    title: '产品线与在售型号',
    keywords: ['型号', '产品', '品牌', '卖', '有哪些', '哪些', '推荐', '选型', 'zebra', '斑马',
      'honeywell', '霍尼', 'tsc', 'zt211', 'zt510', 'zd888', 'zc100', 'zc300', 'xi4',
      'ds4608', 'li2208', '证卡', '工业', '桌面', 'model', 'product', 'brand',
      '优博讯', 'urovo', 'idata', 'pda', '手持终端', '数据采集器', '工业平板', '工控机'],
    content: `【美辉代理与支持的品牌】
优博讯(Urovo) / 斑马(Zebra) / TSC / IDATA —— 打印机、PDA、扫描设备
【在售主要型号】
■ 条码打印机（品牌：Zebra斑马 / TSC / Honeywell霍尼韦尔）
· Zebra ZT211：工业级标签打印机，主推机型，支持热转印/热敏
· Zebra ZT510、Xi4系列：重载工业级打印机，适合大批量连续打印
· Zebra ZD888T：桌面型热转印打印机，适合门店/办公室小批量打印
· Zebra ZC100/ZC300：证卡打印机（员工卡、会员卡、门禁卡打印）
■ 条码扫描枪（品牌：Zebra / Honeywell）
· Zebra DS4608：二维有线扫描枪，支持屏幕码/一维/二维码
· Zebra LI2208：一维线性扫描枪，经典型号
· 另有无线扫描枪、固定式扫描头（产线/流水线用），支持232/485/以太网接口
■ PDA / 数据采集器 / 工业平板 / RFID设备（优博讯、IDATA 等品牌）
■ 耗材：铜版纸/PET标签、蜡基/混合基/树脂基碳带
选型时先了解客户使用场景（打印量、标签材质、使用环境），再推荐具体型号。
具体型号配置与适配，建议联系对应业务人员确认。`,
  },
  {
    id: 'printer_faults',
    title: '打印机常见故障排查（Zebra/霍尼韦尔/TSC 通用）',
    keywords: ['打印机', '不能开机', '开不了机', '没反应', '不打印', '红灯', '绿灯', '闪烁',
      '走纸', '跳纸', '偏移', '漂移', '脱机', '暂停', '打印任务', '端口', '驱动',
      'printer', '乱码', '内容不全', '碳带不走', '报错',
      // 口语化模糊说法（提升模糊问题召回）
      '打不出', '打不了', '打印不了', '不出纸', '出不来', '卡纸', '死机', '不工作'],
    content: `【打印机故障排查要点】
■ 不能开机：查插座供电→换电源线/适配器→确认电源开关。都正常则寄回检测。
■ 发打印指令没反应：
· 绿灯闪烁（小型机）/data灯闪烁（大机）＝任务已收到，多半在暂停状态，按进纸键/暂停键退出。
· 绿灯常亮＝任务没收到，插拔USB线看电脑是否识别；不识别则删除打印机重新让电脑发现，更新驱动。
· 亮红灯＝多为耗材安装错误或设置与耗材不符：先对照手册检查安装，再查打印首选项设置，然后驱动工具栏里做"校正介质"。校正后按进纸键，一次走一张、停在纸缝上才算正确。
· 检查是否被设为"脱机使用"：打印队列窗口→打印机菜单→取消脱机勾选。
■ 走纸不准/一打三张/位置漂移：先查感应器位置（ZD888须在最右边；大机红色光点必须照在标签上不能照空隙），再做介质校正。
■ 碳带不走：①碳带没装好 ②打印机被设为热敏模式 ③碳带支架故障需返修。
■ 指令打印中文乱码：打印机内置中文字库丢失或调用语句不对。
■ 打印内容缺左/右边：打印首选项里标签宽度/高度设置不对，新建正确尺寸模板再打印。
■ 检纸正常、驱动发指令正常、一打印就报错：问题在打印软件（BarTender/NiceLabel/ERP/Excel/PDF）自己的打印设置里，它与驱动设置是独立的，需在软件打印属性里调整。
■ 疑难杂症：恢复出厂设置后重试（打印首选项→工具）。`,
  },
  {
    id: 'print_quality',
    title: '打印质量问题（模糊/白线/白斑/碳带皱）',
    keywords: ['打印不清楚', '模糊', '白线', '白斑', '断针', '打印头', '胶辊', '碳带皱', '褶皱',
      '打印质量', '颜色浅', '深浅不一', '毛边', '锯齿', '耗材', '标签纸', '铜版纸', 'pet', '树脂', '蜡基',
      // 口语化模糊说法
      '不清晰', '看不清', '印不清', '打出来'],
    content: `【打印质量问题判断】
■ 深浅不一、无规律点线：耗材不匹配或速度/温度不合适。耗材搭配表：
· 普通铜版纸：蜡基✓(不耐刮) 混合基✓(耐刮) 树脂基✗
· 镜面/印刷铜版纸：蜡基(质量差) 混合基(看材料) 树脂基(看材料)
· PET标签：蜡基✗ 混合基✓(不耐刮) 树脂基✓(耐刮)
耗材没问题就在驱动里调打印速度和浓度。
■ 固定位置白线、边缘锐利、清洁后依旧：打印头断针，只能更换打印头。
■ 有规律白斑、间隔固定：胶辊破损，压力不够，需查胶辊。
■ 白线断续、边缘模糊：打印头脏，用无水酒精清洁打印头。长期不清洁会烧坏打印头。
■ 斜向白线+用过的碳带同位置有皱纹：碳带皱——查耗材匹配、降打印温度、调碳带拉力/碳带剥离板。
■ 一边清楚一边模糊：打印头压力不平衡，加大模糊侧压力。
■ 条码文字有锯齿毛边：PDF/网页转图片打印导致，建议改用专业条码软件(BarTender/NiceLabel)。`,
  },
  {
    id: 'scanner_faults',
    title: '扫描枪常见故障排查',
    keywords: ['扫描枪', '扫码枪', '扫描器', '回车', '后缀', 'tab', '扫不出', '不出光', '扫描光',
      '不识别', '码制', '重复读', '充电', '配对', '底座', '收不到数据', '串口', '232', '485',
      'scanner', '无线枪', '自检', '蜂鸣',
      // 口语化模糊说法
      '扫不了', '扫不上', '读不出', '读不了', '扫描不了', '扫码'],
    content: `【扫描枪故障排查要点】
■ 加回车/后缀：扫设置码实现。Zebra 08系列按手册扫4个设置码；霍尼1900扫对应设置码。不同型号设置码不同，可提供型号后由我们发对应设置码。
■ 点不亮、没有扫描光：开机有自检声→主板正常，多为扫描头问题；无自检声→依次排查电脑端口、数据线、主板。
■ 部分条码扫不出：该码制未开启。请客户提供条码样品或清晰照片，我们提供开启对应码制的设置码。
■ 同一条码重复读取：设置手册里延长"相同条码读取间隔时间"。
■ 无线枪不充电：①USB线/端口（换线换口排查）②底座问题 ③电池老化需更换。
■ 无线枪配对：扫底座上的配对码。Zebra扫完须把枪放回底座等一声蜂鸣才算成功；霍尼扫完即可。
■ 扫描有光但电脑收不到数据：开记事本、切英文输入法测试。记事本能输入→查客户软件环境；不能输入→①恢复出厂设置 ②检查接口方式选择（USB口/串口）③串口要核对端口号、通讯软件、通讯参数。
■ 固定式扫描头：支持加后缀、232转485/以太网端口转换、触发方式切换，故障排查思路与手持枪一致。`,
  },
  {
    id: 'zt211',
    title: 'ZT211 专项操作指引',
    keywords: ['zt211', '装碳带', '装标签', '安装标签', '清洁', '压力调节', '校准', '校正',
      '自动校准', '手动校准', '出厂设置', '恢复出厂'],
    content: `【ZT211 操作指引（官方视频+手册页码）】
官方支持页（视频教程都在这里）：https://www.zebra.com/cn/zh/support-downloads/printers-cn/industrial/zt211.html
· 安装标签和碳带：看"Media and Ribbon Loading"视频，或手册30-50页
· 打印头清洁：看"Printhead & Rollers cleaning"视频，或手册77-89页
· 打印头压力调节：看"Printhead Pressure Adjustment"视频，或手册72-75页
· 自动校准标签：看"Auto Calibration"视频，或手册68页
· 手动校准标签：看"Manual Calibration"视频，或手册68-71页
· 碳带褶皱调整：看"Adjust the Ribbon Strip Plate"视频
· 标签类型选择：看"Identifying Media"视频
· 恢复出厂设置：看"Factory Reset"视频`,
  },
  {
    id: 'downloads',
    title: '官方驱动与软件下载',
    keywords: ['驱动', '下载', '软件', '安装包', 'driver', 'download', '123scan', 'setup utilities',
      '设置软件', '配置软件'],
    content: `【官方下载地址（都是Zebra官网，放心访问）】
· Zebra打印机驱动：https://www.zebra.com/cn/zh/support-downloads/printers/printer-drivers.html
· Zebra ZC300证卡打印机驱动：https://www.zebra.com/cn/zh/support-downloads/printers/card/zc300.html
· Zebra打印机设置软件(Zebra Setup Utilities)：https://www.zebra.com/cn/zh/support-downloads/software/printer-software/printer-setup-utilities.html
· Zebra扫描枪设置软件(123Scan)：https://www.zebra.com/cn/zh/support-downloads/software/scanner-software/123scan-utility.html
网络/蓝牙打印配置：装好Zebra Setup Utilities后用USB连接，在软件里配置打印机连接性（静态IP/无线ESSID密码/蓝牙名称密码），发送设置后打印机自动重启生效。`,
  },
  {
    id: 'warranty',
    title: '保修政策',
    keywords: ['保修', '质保', '在保', '保多久', '保修期', '过保', '免费修', '收费',
      '人为', '打印头保修', '公里', 'warranty', '三包'],
    content: `【保修政策】
· PDA 主机：保修 1 年；PDA 配件：保修 3 个月
· 条码打印机主机：保修 1 年
· 打印头：保修 6 个月 或 30 公里打印长度（以先到者为准）
· 人为损坏不在保修范围内
判断是否在保：请客户提供设备序列号（机身标签），拍序列号标签照片发来核实。`,
  },
  {
    id: 'repair',
    title: '寄修流程与地址',
    keywords: ['寄修', '寄回', '返修', '维修', '送修', '邮寄', '快递', '地址', '收件',
      '退货', '寄到哪', 'rma', '修理', '检测'],
    content: `【寄修流程】
寄修时务必在包裹内**单独附一张纸条**，写清以下四项，否则会延误处理：
1. 回寄地址（写清楚）
2. 电话（写清楚）
3. 联系人（写清楚）
4. 设备具体什么功能无法使用 / 故障原因（写清楚）

【寄修收货地址】
浙江省杭州市拱墅区杭行路666号万达广场C座1309　收件人：翟工　13456828195

【退货地址】
浙江省杭州市拱墅区杭行路666号万达广场C座1309　收件人：陈斌　18758117499

寄修前建议先在对话中描述故障并提供照片，很多问题可以远程解决，不必寄回。`,
  },
  {
    id: 'contact',
    title: '联系方式与转人工',
    keywords: ['联系', '电话', '微信', '找谁', '转人工', '人工', '客服电话', '技术支持',
      '业务员', '销售', '售前', '咨询', '加微信', '负责人', 'contact'],
    content: `【官方联系方式】（只可提供以下号码，不得提供其他任何号码）
· 技术问题 / 人工升级：张琦　13615815336
· 销售咨询微信：13757131105
· 寄修收货：翟工　13456828195
· 退货事宜：陈斌　18758117499
· 公司地址：浙江省杭州市拱墅区杭行路666号万达广场C座1309

【转人工时机】
当 AI 无法解决、需要现场判断、涉及报价或订单时，主动把客户转给对应负责人。
注意：工作时间未在资料中明确，不要向客户承诺具体的上下班时间或响应时长。`,
  },
  {
    id: 'service_flow',
    title: '故障处理总流程',
    keywords: ['坏了', '故障', '不能用', '怎么办', '处理流程', '报修', '售后',
      // 口语化模糊说法 —— 客户只说"有问题/不好用"时兜底命中本节（本节引导先问清现象，与澄清策略一致）
      '有问题', '出问题', '不好用', '用不了', '不灵', '异常', '出毛病', '毛病'],
    content: `【故障处理标准流程】
1. 请客户具体描述故障现象。
2. 请客户把指示灯状态、液晶面板提示信息、故障代码拍照或录像发来，据此判断。
3. 检查耗材（标签和碳带）安装是否正确，设置是否与实际耗材匹配。
4. 提供序列号照片以核实保修状态。
5. 按对应故障排查步骤引导处理；仍无法解决的，转技术人员（张琦 13615815336），必要时安排寄修。
标签与碳带校准等操作需结合客户实际使用场景，建议由对应业务人员确认后再操作。`,
  },
];

/* ── 自定义知识（老板通过企业微信口述新增，由 knowledge-store.js 注入）──
   排在内置知识之前参与检索，同分时优先命中，便于"新说法覆盖旧说法"。 */
let customSections = [];

export function setCustomSections(arr) {
  customSections = Array.isArray(arr) ? arr : [];
}

/* ── 内置条目的远程覆盖（见文件末尾「远程快照接入」）────────
   客服服务那边的 SECTIONS 可能比网站这份新（两个仓库分别部署，发版不同步）。
   同 id 的内置条目以远程为准，靠这张表覆盖，而不是改动上面的 SECTIONS 常量 ——
   这样清空覆盖就能立刻回到本地版本，不会有"改回不去"的状态。 */
let builtinOverrides = new Map();

export function getAllSections() {
  const builtins = builtinOverrides.size
    ? SECTIONS.map((s) => builtinOverrides.get(String(s.id)) || s)
    : SECTIONS;
  return [...customSections, ...builtins];
}

/**
 * 简易检索（详细版）：统计各节关键词命中数，返回拼好的正文 + 命中了哪几节。
 *
 * 本文件保持"不联网"：如果开了模型重排（RERANK_ENABLED），由调用方
 * 先跑 src/rerank.js 拿到一组标题 id，通过 preselected 传进来。
 * 合并规则：关键词命中的排前面，重排补充的排后面，一起受 maxSections/maxChars 约束。
 *
 * @param {Array<{role:string,content:string}>} messages
 * @param {{maxSections?:number,maxChars?:number,preselected?:string[]}} [opts]
 * @returns {{text:string, sections:Array<{id:string,title:string,custom:boolean}>}}
 */
export function retrieveKnowledgeDetailed(messages, { maxSections = 3, maxChars = 3200, preselected = [] } = {}) {
  const all = getAllSections();

  // 取最近 3 条用户消息作为检索依据（当前问题权重最高）
  const userTexts = (Array.isArray(messages) ? messages : [])
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m, i, arr) => ({ text: String(m.content || '').toLowerCase(), weight: i === arr.length - 1 ? 3 : 1 }));

  const scored = userTexts.length
    ? all.map((s, idx) => {
      let score = 0;
      for (const { text, weight } of userTexts) {
        for (const kw of s.keywords) {
          if (text.includes(String(kw).toLowerCase())) score += weight;
        }
      }
      // 自定义条目同分时排前面（idx 小的在前，见 getAllSections 顺序）
      return { s, score, idx };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.idx - b.idx)
      .slice(0, maxSections)
    : [];

  // 关键词命中优先，模型重排挑出来的补在后面
  const chosen = [];
  const seen = new Set();
  for (const { s } of scored) {
    chosen.push(s);
    seen.add(String(s.id));
  }
  for (const id of Array.isArray(preselected) ? preselected : []) {
    if (chosen.length >= maxSections) break;
    const key = String(id);
    if (seen.has(key)) continue;
    const s = all.find((x) => String(x.id) === key);
    if (!s) continue;
    chosen.push(s);
    seen.add(key);
  }

  let text = '';
  const sections = [];
  for (const s of chosen) {
    if (text.length + s.content.length > maxChars) break;
    text += (text ? '\n\n' : '') + s.content;
    sections.push({ id: String(s.id), title: s.title, custom: String(s.id).startsWith('custom_') });
  }
  return { text, sections };
}

/** 简易检索：只要正文（旧签名，保持兼容） */
export function retrieveKnowledge(messages, opts = {}) {
  return retrieveKnowledgeDetailed(messages, opts).text;
}

export const KNOWLEDGE_SECTION_COUNT = SECTIONS.length;

/* ══ 远程快照接入（网站独有，客服服务里没有这一段）══════════════
   老板在企业微信里口述新增的知识只落在客服服务的 data/ 里。网站通过
   客服服务的 GET /kb 把那份快照拉过来，用下面两个函数应用到检索里。
   拉取与缓存在 lib/remote-kb.js，本文件保持"不联网"。 */

/**
 * 用远程内置条目覆盖本地同 id 的内置条目。
 * 只认 id 能对上的：远程新增的内置条目不会凭空插进来（那属于发版的事），
 * 本地有、远程没有的也原样保留（比如远程是旧版）。
 * 传空数组 / 不传 = 清空所有覆盖，回到纯本地。
 *
 * @param {Array<{id:string,title?:string,keywords?:string[],content?:string}>} [sections]
 */
export function setBuiltinOverrides(sections) {
  const next = new Map();
  const localIds = new Set(SECTIONS.map((s) => String(s.id)));
  for (const s of Array.isArray(sections) ? sections : []) {
    const id = String(s?.id || '');
    if (!localIds.has(id)) continue;
    const local = SECTIONS.find((x) => String(x.id) === id);
    next.set(id, {
      id,
      title: s.title ? String(s.title) : local.title,
      keywords: Array.isArray(s.keywords) && s.keywords.length ? s.keywords.map(String) : local.keywords,
      content: s.content ? String(s.content) : local.content,
    });
  }
  builtinOverrides = next;
  return builtinOverrides.size;
}

/**
 * 应用一份 /kb 快照：自定义条目全量替换，内置条目按 id 覆盖。
 * 「全量替换」是刻意的 —— 老板删掉的条目也必须从网站消失。
 * 快照结构不对（缺 sections）就当没收到，保持现状，绝不清空本地。
 *
 * @param {{sections?:Array<{id:string,custom?:boolean}>}} payload
 * @returns {{custom:number, builtin:number}} 应用了几条
 */
export function applyRemoteKnowledge(payload) {
  const all = Array.isArray(payload?.sections) ? payload.sections : null;
  if (!all) return { custom: 0, builtin: 0 };

  const custom = all.filter((s) => s && s.custom);
  const builtin = all.filter((s) => s && !s.custom);

  setCustomSections(custom.map((s) => ({
    id: String(s.id),
    title: String(s.title || ''),
    keywords: Array.isArray(s.keywords) ? s.keywords.map(String) : [],
    content: String(s.content || ''),
  })));
  const applied = setBuiltinOverrides(builtin);
  return { custom: custom.length, builtin: applied };
}
