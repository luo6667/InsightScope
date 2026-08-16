// 关键词提取：基于"情感评价词典"匹配（词必须是能反映质量/满意度的真词，不做无意义拆字）

// 评价词典：正 / 中性 / 负面（2 字以上为主，避免"差"误匹配"差别"）
const DICT: { word: string; sentiment: "pos" | "neu" | "neg" }[] = [
  // 正面（质量好、满意度高）
  { word: "满意", sentiment: "pos" },
  { word: "好用", sentiment: "pos" },
  { word: "不错", sentiment: "pos" },
  { word: "挺好", sentiment: "pos" },
  { word: "很好", sentiment: "pos" },
  { word: "好评", sentiment: "pos" },
  { word: "推荐", sentiment: "pos" },
  { word: "喜欢", sentiment: "pos" },
  { word: "划算", sentiment: "pos" },
  { word: "实惠", sentiment: "pos" },
  { word: "流畅", sentiment: "pos" },
  { word: "稳定", sentiment: "pos" },
  { word: "给力", sentiment: "pos" },
  { word: "值得", sentiment: "pos" },
  { word: "优秀", sentiment: "pos" },
  { word: "惊喜", sentiment: "pos" },
  { word: "靠谱", sentiment: "pos" },
  { word: "舒服", sentiment: "pos" },
  { word: "完美", sentiment: "pos" },
  { word: "耐用", sentiment: "pos" },
  { word: "质量好", sentiment: "pos" },
  { word: "物美价廉", sentiment: "pos" },

  // 中性（事实性描述）
  { word: "一般", sentiment: "neu" },
  { word: "还行", sentiment: "neu" },
  { word: "观望", sentiment: "neu" },
  { word: "中规中矩", sentiment: "neu" },
  { word: "更新", sentiment: "neu" },
  { word: "反馈", sentiment: "neu" },
  { word: "客服", sentiment: "neu" },
  { word: "物流", sentiment: "neu" },
  { word: "快递", sentiment: "neu" },
  { word: "价格", sentiment: "neu" },
  { word: "性价比", sentiment: "neu" },
  { word: "质量", sentiment: "neu" },
  { word: "性能", sentiment: "neu" },
  { word: "售后", sentiment: "neu" },
  { word: "发货", sentiment: "neu" },
  { word: "版本", sentiment: "neu" },
  { word: "功能", sentiment: "neu" },
  { word: "包装", sentiment: "neu" },
  { word: "续航", sentiment: "neu" },
  { word: "外观", sentiment: "neu" },

  // 负面（质量差、不满意）
  { word: "太差", sentiment: "neg" },
  { word: "很差", sentiment: "neg" },
  { word: "差劲", sentiment: "neg" },
  { word: "垃圾", sentiment: "neg" },
  { word: "失望", sentiment: "neg" },
  { word: "卡顿", sentiment: "neg" },
  { word: "闪退", sentiment: "neg" },
  { word: "耗电", sentiment: "neg" },
  { word: "太慢", sentiment: "neg" },
  { word: "很慢", sentiment: "neg" },
  { word: "坑", sentiment: "neg" },
  { word: "难用", sentiment: "neg" },
  { word: "投诉", sentiment: "neg" },
  { word: "退款", sentiment: "neg" },
  { word: "维修", sentiment: "neg" },
  { word: "故障", sentiment: "neg" },
  { word: "糟糕", sentiment: "neg" },
  { word: "无语", sentiment: "neg" },
  { word: "后悔", sentiment: "neg" },
  { word: "差评", sentiment: "neg" },
  { word: "虚假", sentiment: "neg" },
  { word: "欺骗", sentiment: "neg" },
  { word: "维权", sentiment: "neg" },
  { word: "太贵", sentiment: "neg" },
  { word: "不值", sentiment: "neg" },
  { word: "退货", sentiment: "neg" },
  { word: "瑕疵", sentiment: "neg" },
  { word: "破损", sentiment: "neg" },
  { word: "漏发", sentiment: "neg" },
  { word: "拖延", sentiment: "neg" },
  { word: "踢皮球", sentiment: "neg" },
];

const STOP = new Set(["这个", "那个", "我们", "你们", "他们", "一个", "可以", "就是", "但是", "还是", "因为", "所以", "怎么", "什么", "没有", "非常", "真的", "感觉", "一下", "有点", "已经", "比较", "然后", "而且", "如果", "应该", "希望", "不过", "现在", "觉得", "时候", "问题", "东西", "地方", "这样", "那样", "多少", "为什么"]);

/** 从一条评论提取评价关键词（词典匹配 + 英文单词 + 自定义词，去重后最多 n 个） */
export function extractKeywords(text: string, n = 8, extra: string[] = []): string[] {
  const words = new Set<string>();
  // 英文单词
  for (const m of text.match(/[a-zA-Z][a-zA-Z0-9_-]{1,}/g) ?? []) {
    words.add(m.toLowerCase());
  }
  // 评价词典匹配（包含匹配）
  for (const { word } of DICT) {
    if (text.includes(word)) words.add(word);
  }
  // 自定义词典（用户添加的词，如产品名/特定槽点）
  for (const w of extra) {
    const t = w.trim();
    if (t && text.includes(t)) words.add(t);
  }
  // 过滤停用词
  const filtered = [...words].filter((w) => !STOP.has(w) && w.length <= 12);
  return filtered.slice(0, n);
}

/** 内容词频统计：给定一批评论内容，返回出现次数 top 的评价词（支持自定义词典） */
export function countKeywords(contents: string[], limit = 20, extra: string[] = []): { word: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const c of contents) {
    for (const w of extractKeywords(c, 12, extra)) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
