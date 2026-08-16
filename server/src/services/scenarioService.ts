import type { Sentiment } from "../types.js";

interface Segment {
  startDay: number;
  endDay: number;
  dist: Record<Sentiment, number>;
  topics: Record<Sentiment, string[]>;
}

export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  days: number;
  count: number;
  segments: Segment[];
  templates: Record<Sentiment, string[]>;
  authors: string[];
  platforms: string[];
}

const AUTHORS = [
  "青柠微凉", "代码搬运工", "深夜码农", "阿茶", "不吃香菜", "追风少年", "Luna", "老白",
  "山月", "TT控", "小鹿乱撞", "Nova", "格子衬衫", "一杯冰美式", "皮皮虾", "Kimi酱",
];

const PLATFORMS = ["App Store", "应用宝", "微博", "小红书", "知乎", "贴吧"];

const SCENARIOS: ScenarioDef[] = [
  {
    id: "app-update",
    name: "某 App 大版本更新",
    description: "好评开局 → 闪退/性能负面激增（触发告警）→ 修复后回落，完整事件曲线",
    days: 30,
    count: 450,
    segments: [
      {
        startDay: 1, endDay: 12,
        dist: { pos: 0.62, neu: 0.25, neg: 0.13 },
        topics: {
          pos: ["新界面", "流畅度", "功能丰富", "设计好看"],
          neu: ["界面变化", "功能调整", "更新说明", "默认设置"],
          neg: ["耗电", "学习成本", "改动大", "不习惯"],
        },
      },
      {
        startDay: 13, endDay: 21,
        dist: { pos: 0.18, neu: 0.27, neg: 0.55 },
        topics: {
          pos: ["响应快", "局部修复", "客服跟进"],
          neu: ["等待修复", "反馈渠道", "官方回应"],
          neg: ["闪退", "卡顿", "耗电严重", "兼容性", "无法登录"],
        },
      },
      {
        startDay: 22, endDay: 30,
        dist: { pos: 0.5, neu: 0.3, neg: 0.2 },
        topics: {
          pos: ["修复完成", "体验提升", "稳定性", "客服负责"],
          neu: ["更新进度", "后续版本", "反馈热度"],
          neg: ["个别机型", "遗留问题", "复现缓慢"],
        },
      },
    ],
    templates: {
      pos: [
        "更新到最新版之后感觉明显流畅了，启动速度也快了，给开发团队点个赞！",
        "新界面真好看，配色舒服，用起来很顺手，爱了。",
        "这次更新把之前一直想要的功能加上了，好评！",
        "升级完用了一周，稳定性比上一版好太多，继续加油。",
        "功能越来越全了，日常使用完全够用，推荐升级。",
        "修复速度快，反馈的问题两天就处理了，客服态度也很好。",
        "动画过渡很顺滑，细节做得用心，体验拉满。",
        "更新日志写得很清楚，改动都看得明白，好评。",
      ],
      neu: [
        "更新完界面变了不少，还在适应中。",
        "功能调整可以理解，就是默认设置有点不习惯。",
        "看更新说明这次改动挺大的，先用几天再说。",
        "感觉变化不大，主要是一些细节调整。",
        "等后续版本再看看，暂时中规中矩。",
        "更新完数据好像没丢，这点还行。",
      ],
      neg: [
        "更新完直接闪退，重启也没用，太糟心了。",
        "新版卡成PPT，滑动都掉帧，负优化啊这是。",
        "耗电严重，一小时掉20%，越更新越倒退。",
        "旧版好好的，更新完反而一堆问题，后悔升级了。",
        "登录都登不上，一直转圈，官方能不能管管。",
        "部分机型兼容性有问题，我的手机直接无法打开。",
        "反馈了三天没人理，客服形同虚设。",
        "这次更新是我用过最差的一版，没有之一。",
      ],
    },
    authors: AUTHORS,
    platforms: PLATFORMS,
  },
  {
    id: "new-product",
    name: "新品发布两极分化",
    description: "性能党好评 vs 价格党差评，主题清晰（性能/价格/客服/外观）",
    days: 21,
    count: 420,
    segments: [
      {
        startDay: 1, endDay: 10,
        dist: { pos: 0.45, neu: 0.2, neg: 0.35 },
        topics: {
          pos: ["性能", "外观设计", "参数", "工艺"],
          neu: ["价格对比", "参数解读", "评测"],
          neg: ["价格", "性价比", "阉割", "参数虚标"],
        },
      },
      {
        startDay: 11, endDay: 21,
        dist: { pos: 0.4, neu: 0.15, neg: 0.45 },
        topics: {
          pos: ["体验稳定", "性能释放", "做工细节"],
          neu: ["观望", "降价预期", "竞品对比"],
          neg: ["价格偏高", "客服差", "溢价", "售后", "发货慢"],
        },
      },
    ],
    templates: {
      pos: [
        "性能释放很强，跑分拉满，玩游戏丝滑，值这个价。",
        "做工质感超出预期，边框控制得非常好。",
        "屏幕素质一流，参数没虚标，实测很顶。",
        "用了一周，续航和性能都很满意，推荐。",
        "外观设计在线，拿出去辨识度很高。",
        "系统优化到位，日常使用毫无卡顿。",
      ],
      neu: [
        "参数看起来不错，等实测出来再决定买不买。",
        "价格和竞品比没什么优势，先观望。",
        "看评测说性能强但发热大，还在纠结。",
        "等降价再说，现在入手不划算。",
        "跟上一代比提升有限，看个人需求吧。",
      ],
      neg: [
        "这个价格能买更好的，溢价太严重了。",
        "阉割了不少配置，还卖这么贵，割韭菜。",
        "客服态度差，问个问题半天不回。",
        "等了半个月才发货，预售就是耍猴。",
        "宣称的参数实际根本达不到，虚标。",
        "售后网点太少，出问题维修都是麻烦事。",
        "性价比太低了，同价位有更好的选择。",
      ],
    },
    authors: AUTHORS,
    platforms: PLATFORMS,
  },
  {
    id: "pr-crisis",
    name: "品牌公关事件",
    description: "负面爆发（质量问题曝光）→ 官方回应 → 舆情缓和，演示事件时间线",
    days: 21,
    count: 450,
    segments: [
      {
        startDay: 1, endDay: 6,
        dist: { pos: 0.3, neu: 0.3, neg: 0.4 },
        topics: {
          pos: ["品牌信任", "过往口碑"],
          neu: ["事件发酵", "媒体报道", "网友讨论"],
          neg: ["质量质疑", "曝光", "信任危机"],
        },
      },
      {
        startDay: 7, endDay: 12,
        dist: { pos: 0.1, neu: 0.18, neg: 0.72 },
        topics: {
          pos: ["个别正面反馈"],
          neu: ["官方回应", "调查进展"],
          neg: ["质量问题", "欺骗消费者", "拒不承认", "维权难", "公关差"],
        },
      },
      {
        startDay: 13, endDay: 21,
        dist: { pos: 0.35, neu: 0.35, neg: 0.3 },
        topics: {
          pos: ["回应诚恳", "整改措施", "补偿方案"],
          neu: ["整改效果", "后续监督", "结果公示"],
          neg: ["整改不彻底", "补偿太少", "观望"],
        },
      },
    ],
    templates: {
      pos: [
        "官方回应还算诚恳，至少承认了问题，比装死强。",
        "整改措施力度可以，希望真的落实到位。",
        "愿意站出来负责，这个态度值得肯定。",
        "补偿方案虽然不多，但起码有行动。",
      ],
      neu: [
        "等官方调查结果出来再说，不站队。",
        "事情还在发酵，看后续怎么处理。",
        "媒体的报道各有说法，真假难辨。",
        "等整改结果公示了再评价。",
      ],
      neg: [
        "质量这么差还卖这么贵，欺骗消费者。",
        "问题曝光这么久才回应，公关能力堪忧。",
        "嘴上说整改，实际根本没动作。",
        "维权太难了，客服一直踢皮球。",
        "这么大的品牌出这种事，太让人失望了。",
        "拒不承认问题，还删评论封号，恶心。",
        "补偿方案打发叫花子呢，一点诚意没有。",
        "信任一旦崩塌就回不来了，拉黑。",
      ],
    },
    authors: AUTHORS,
    platforms: PLATFORMS,
  },
];

export function listScenarios() {
  return SCENARIOS.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    count: s.count,
    days: s.days,
  }));
}

export function getScenario(id: string) {
  return SCENARIOS.find((s) => s.id === id) ?? null;
}

export interface GeneratedComment {
  content: string;
  author: string;
  platform: string;
  timestamp: Date;
  sentiment: Sentiment;
  sentimentScore: number;
  topics: string[];
  keywords: string[];
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// 按情感的关键词池（供词云展示）
const KEYWORD_POOL: Record<Sentiment, string[]> = {
  pos: ["流畅", "好用", "喜欢", "满意", "推荐", "提升", "稳定", "值得"],
  neu: ["观望", "适应", "一般", "更新", "反馈", "等待", "观望中"],
  neg: ["闪退", "卡顿", "耗电", "客服差", "失望", "慢", "退款", "不推荐", "太贵", "故障"],
};

/** 按场景定义生成一批带时间戳/情感/主题的评论 */
export function generateScenarioComments(def: ScenarioDef): GeneratedComment[] {
  const out: GeneratedComment[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - def.days + 1);

  for (let i = 0; i < def.count; i++) {
    // 按 segment 长度加权随机选段
    const totalLen = def.segments.reduce((s, seg) => s + (seg.endDay - seg.startDay + 1), 0);
    let r = Math.random() * totalLen;
    let seg = def.segments[0];
    for (const s of def.segments) {
      r -= s.endDay - s.startDay + 1;
      if (r <= 0) { seg = s; break; }
    }
    // 按情感分布抽 sentiment
    const distRoll = Math.random();
    let sentiment: Sentiment = "neu";
    if (distRoll < seg.dist.pos) sentiment = "pos";
    else if (distRoll < seg.dist.pos + seg.dist.neu) sentiment = "neu";
    else sentiment = "neg";

    const day = seg.startDay + Math.floor(Math.random() * (seg.endDay - seg.startDay + 1));
    const ts = new Date(start);
    ts.setDate(ts.getDate() + day - 1);
    ts.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);

    const content = pick(def.templates[sentiment]);
    const topics = [...seg.topics[sentiment]].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
    const keywords = [...KEYWORD_POOL[sentiment]]
      .sort(() => Math.random() - 0.5)
      .slice(0, 2 + Math.floor(Math.random() * 2));

    const scoreMap: Record<Sentiment, number> = {
      pos: 0.5 + Math.random() * 0.5,
      neu: (Math.random() - 0.5) * 0.4,
      neg: -(0.5 + Math.random() * 0.5),
    };

    out.push({
      content,
      author: pick(def.authors),
      platform: pick(def.platforms),
      timestamp: ts,
      sentiment,
      sentimentScore: Math.round(scoreMap[sentiment] * 100) / 100,
      topics,
      keywords,
    });
  }
  // 按时间排序
  out.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return out;
}
