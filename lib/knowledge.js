// src/knowledge.js
// 美辉科技产品知识库 —— 从公司内部资料（AI饲料）提炼。
// 采用关键词检索、按需注入：每次对话只把命中的主题节附加到系统提示词，
// 避免提示词过长。零依赖，内容更新直接改本文件即可。

const SECTIONS = [
  {
    id: 'products',
    title: '产品线与在售型号',
    keywords: ['型号', '产品', '品牌', '卖', '有哪些', '哪些', '推荐', '选型', 'zebra', '斑马',
      'honeywell', '霍尼', 'tsc', 'zt211', 'zt510', 'zd888', 'zc100', 'zc300', 'xi4',
      'ds4608', 'li2208', '证卡', '工业', '桌面', 'model', 'product', 'brand'],
    content: `【美辉在售主要型号】
■ 条码打印机（品牌：Zebra斑马 / Honeywell霍尼韦尔 / TSC）
· Zebra ZT211：工业级标签打印机，主推机型，支持热转印/热敏
· Zebra ZT510、Xi4系列：重载工业级打印机，适合大批量连续打印
· Zebra ZD888T：桌面型热转印打印机，适合门店/办公室小批量打印
· Zebra ZC100/ZC300：证卡打印机（员工卡、会员卡、门禁卡打印）
■ 条码扫描枪（品牌：Zebra / Honeywell）
· Zebra DS4608：二维有线扫描枪，支持屏幕码/一维/二维码
· Zebra LI2208：一维线性扫描枪，经典型号
· 另有无线扫描枪、固定式扫描头（产线/流水线用），支持232/485/以太网接口
■ 耗材：铜版纸/PET标签、蜡基/混合基/树脂基碳带
选型时先了解客户使用场景（打印量、标签材质、使用环境），再推荐具体型号。`,
  },
  {
    id: 'printer_faults',
    title: '打印机常见故障排查（Zebra/霍尼韦尔/TSC 通用）',
    keywords: ['打印机', '不能开机', '开不了机', '没反应', '不打印', '红灯', '绿灯', '闪烁',
      '走纸', '跳纸', '偏移', '漂移', '脱机', '暂停', '打印任务', '端口', '驱动',
      'printer', '乱码', '内容不全', '碳带不走', '报错'],
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
      '打印质量', '颜色浅', '深浅不一', '毛边', '锯齿', '耗材', '标签纸', '铜版纸', 'pet', '树脂', '蜡基'],
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
      'scanner', '无线枪', '自检', '蜂鸣'],
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
    id: 'service',
    title: '售后服务流程',
    keywords: ['保修', '在保', '维修', '返修', '寄回', '售后', '人工', '技术支持', '序列号',
      '坏了', '故障', '检测', 'warranty', 'repair'],
    content: `【售后服务流程】
1. 先请客户提供设备序列号（机身标签上），拍序列号标签照片发给我们，用于查询是否在保。
2. 描述故障现象，并把指示灯状态、液晶面板提示信息拍照或录像发来，便于快速判断。
3. 按上述排查步骤先行处理；无法解决的，由本公司技术服务人员跟进协助，必要时安排寄回检测。
请客户放心：售前售后都有专人负责，响应及时。`,
  },
];

/** 简易检索：统计各节关键词命中数，返回得分最高的若干节 */
export function retrieveKnowledge(messages, { maxSections = 3, maxChars = 3200 } = {}) {
  // 取最近 3 条用户消息作为检索依据（当前问题权重最高）
  const userTexts = messages
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m, i, arr) => ({ text: String(m.content || '').toLowerCase(), weight: i === arr.length - 1 ? 3 : 1 }));

  if (!userTexts.length) return '';

  const scored = SECTIONS.map((s) => {
    let score = 0;
    for (const { text, weight } of userTexts) {
      for (const kw of s.keywords) {
        if (text.includes(kw.toLowerCase())) score += weight;
      }
    }
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSections);

  if (!scored.length) return '';

  let out = '';
  for (const { s } of scored) {
    if (out.length + s.content.length > maxChars) break;
    out += (out ? '\n\n' : '') + s.content;
  }
  return out;
}

export const KNOWLEDGE_SECTION_COUNT = SECTIONS.length;
