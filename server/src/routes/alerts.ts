import { Router } from "express";
import { AlertModel, AlertRuleModel } from "../models.js";

const router = Router();

const RULE_TYPES = ["negativity", "volume", "keyword"] as const;

function isRuleType(t: unknown): t is (typeof RULE_TYPES)[number] {
  return typeof t === "string" && (RULE_TYPES as readonly string[]).includes(t);
}

// 规则 CRUD
router.get("/rules", async (req, res) => {
  try {
    const filter = req.query.datasetId ? { datasetId: req.query.datasetId } : {};
    const rules = await AlertRuleModel.findAll({ where: filter });
    res.json({ rules: rules.map((r) => ({ id: r.id, datasetId: r.datasetId, type: r.type, threshold: r.threshold, keyword: r.keyword, enabled: r.enabled })) });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.post("/rules", async (req, res) => {
  const { datasetId, type, threshold, keyword, enabled } = req.body ?? {};
  if (!datasetId || typeof type !== "string") {
    return res.status(400).json({ error: "datasetId / type 必填" });
  }
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < 0) {
    return res.status(400).json({ error: "threshold 必须为不小于 0 的有限数字" });
  }
  if (!isRuleType(type)) {
    return res.status(400).json({ error: `type 必须为 ${RULE_TYPES.join(" / ")}` });
  }
  try {
    const rule = await AlertRuleModel.create({
      datasetId,
      type,
      threshold,
      keyword: typeof keyword === "string" ? keyword : "",
      enabled: enabled === undefined ? true : enabled === true,
    });
    res.status(201).json({ id: rule.id });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.patch("/rules/:id", async (req, res) => {
  try {
    const rule = await AlertRuleModel.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ error: "规则不存在" });
    const { threshold, keyword, enabled, type } = req.body ?? {};
    if (threshold !== undefined) {
      if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < 0) {
        return res.status(400).json({ error: "threshold 必须为不小于 0 的有限数字" });
      }
      rule.threshold = threshold;
    }
    if (typeof keyword === "string") rule.keyword = keyword;
    if (enabled !== undefined) {
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled 必须为布尔值" });
      rule.enabled = enabled;
    }
    if (type !== undefined) {
      if (!isRuleType(type)) {
        return res.status(400).json({ error: `type 必须为 ${RULE_TYPES.join(" / ")}` });
      }
      rule.type = type;
    }
    await rule.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.delete("/rules/:id", async (req, res) => {
  try {
    await AlertRuleModel.destroy({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// 告警列表（分页）
router.get("/", async (req, res) => {
  try {
    const filter = req.query.datasetId ? { datasetId: req.query.datasetId } : {};
    const rawLimit = Number(req.query.limit ?? 100);
    const rawSkip = Number(req.query.skip ?? 0);
    const limit = Number.isFinite(rawLimit) ? Math.min(500, Math.max(1, Math.floor(rawLimit))) : 100;
    const skip = Number.isFinite(rawSkip) ? Math.max(0, Math.floor(rawSkip)) : 0;
    const alerts = await AlertModel.findAll({
      where: filter,
      order: [["triggeredAt", "DESC"]],
      offset: skip,
      limit,
    });
    res.json({
      alerts: alerts.map((a) => ({
        id: a.id,
        datasetId: a.datasetId,
        type: a.type,
        severity: a.severity,
        message: a.message,
        value: a.value,
        triggeredAt: a.triggeredAt,
        acknowledged: a.acknowledged,
      })),
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// 确认告警
router.patch("/:id/ack", async (req, res) => {
  try {
    await AlertModel.update({ acknowledged: true }, { where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;
