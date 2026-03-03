# 首页 SVG 动画卡片设计方案

**日期**: 2026-03-03
**状态**: 待实现

## 概述

将 apps/web 首页的静态卡片改造为具有丰富细节和动态效果的 SVG 动画卡片。

## 设计决策

| 项目 | 选择 |
|------|------|
| 范围 | CHALLENGES、LIFECYCLE、FEATURES、SUPPORTED_AGENTS 四类卡片 |
| 风格 | 图标场景动画 - 将概念转化为具体微场景 |
| 交互 | 入场 + 悬停增强 |
| 技术 | CSS 动画 + 内联 SVG |

## 组件架构

```
app/components/
├── animated-cards/
│   ├── use-in-view.ts          # Intersection Observer Hook
│   ├── challenge-card.tsx      # 痛点卡片 SVG
│   ├── lifecycle-card.tsx      # 生命周期卡片 SVG
│   ├── feature-card.tsx        # 功能特性卡片 SVG
│   └── agent-badge.tsx         # 智能体徽章 SVG
```

## 配色方案

- 主色：`#D6D876`（琥珀黄）
- 背景：`#07070b` / `#0f0f16`
- 线条：`rgba(255,255,255,0.1)`
- 发光效果：`rgba(214,216,118,0.3)`

---

## CHALLENGES 痛点卡片

### 卡片 1："代码能生成，但产品难落地"

- **场景**：代码块碎片散落，无法拼合
- **入场动画**：代码块从中心散开、漂浮
- **悬停增强**：碎片尝试聚合但又弹开，暗示无法成型

### 卡片 2："多智能体协作难以控盘"

- **场景**：多个圆形节点（代表智能体），连线杂乱交错
- **入场动画**：节点依次出现，连线快速乱窜
- **悬停增强**：节点抖动，连线闪烁，暗示混乱状态

### 卡片 3："上线后维护成本持续攀升"

- **场景**：堆叠的方块不断累加，旁边有上升曲线
- **入场动画**：方块从底部逐个堆叠，曲线向上攀升
- **悬停增强**：堆叠加速，曲线斜率变陡，暗示成本失控

---

## LIFECYCLE 生命周期卡片

### 卡片 1："定义目标" (Sparkles)

- **场景**：一个光点扩展成树状任务结构
- **入场动画**：中心光点闪烁 → 向外延伸分支 → 形成 3-4 层任务树
- **悬停增强**：树节点发光脉冲，暗示计划活跃

### 卡片 2："并行执行" (LayoutGrid)

- **场景**：三列看板 + 多条并行进度条
- **入场动画**：进度条从左向右同时推进，看板卡片在列间滑动
- **悬停增强**：进度条加速，卡片移动更频繁

### 卡片 3："审查发布" (ShieldCheck)

- **场景**：检查清单 + 盾牌图标
- **入场动画**：清单项逐个出现，每项旁边打勾 ✓，最后盾牌亮起
- **悬停增强**：盾牌发出保护光环

### 卡片 4："持续迭代" (GitBranch)

- **场景**：循环箭头 + 版本号递增 (v1 → v2 → v3)
- **入场动画**：循环箭头旋转一圈，版本号渐变更新
- **悬停增强**：循环持续转动，暗示迭代不停

---

## FEATURES 功能特性卡片

### 卡片 1："看板视图" (LayoutGrid)

- **场景**：三列看板，卡片在列间拖拽移动
- **入场动画**：列依次淡入，卡片从上方落入各列
- **悬停增强**：一张卡片从第一列滑到第三列

### 卡片 2："日历规划" (CalendarDays)

- **场景**：月历网格 + 时间线标记
- **入场动画**：格子逐行显现，关键日期点亮高亮
- **悬停增强**：时间线延伸，更多日期被标记

### 卡片 3："MCP 集成" (Layers)

- **场景**：中心 hub + 周围多个节点连接
- **入场动画**：中心节点亮起，连线向外辐射连接各端点
- **悬停增强**：数据流沿连线脉冲流动

### 卡片 4："多智能体协作" (Users)

- **场景**：3-4 个小头像围绕中心任务协作
- **入场动画**：头像依次出现，向中心发送信号线
- **悬停增强**：信号线交互加密，头像间有对话气泡闪烁

### 卡片 5："桌面工作台" (Monitor)

- **场景**：显示器轮廓 + 内部仪表盘元素
- **入场动画**：屏幕亮起，仪表盘图表逐个绘制
- **悬停增强**：数据指标跳动更新

### 卡片 6："可控发布流" (CheckCircle2)

- **场景**：流程管道，节点依次点亮直到终点
- **入场动画**：从起点到终点依次激活，最后打勾完成
- **悬停增强**：整条管道发光脉冲

---

## SUPPORTED_AGENTS 智能体徽章

使用 `@lobehub/icons` 图标：

| Agent | 图标 | 变体 |
|-------|------|------|
| Claude Desktop | `Claude` | `.Color` |
| Claude Code | `Claude` | `.Color` |
| Cursor | `Cursor` | 默认或 `.Color` |
| Windsurf | `Windsurf` | 默认或 `.Color` |
| Cline | `Cline` | 默认或 `.Color` |
| Gemini CLI | `Gemini` | `.Color` |

**动画效果：**

- **入场**：徽章依次弹入 + 图标旋转淡入
- **悬停**：图标放大 + 背景光晕扩散
- **默认**：微弱呼吸发光

---

## 技术实现

### CSS 动画 (globals.css)

```css
/* 入场动画 */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
}
@keyframes scale-in {
  from { opacity: 0; transform: scale(0.8); }
}
@keyframes draw-line {
  from { stroke-dashoffset: 100; }
  to { stroke-dashoffset: 0; }
}

/* 循环动画 */
@keyframes pulse-glow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes progress {
  from { width: 0; }
  to { width: 100%; }
}
```

### Intersection Observer Hook

```tsx
// hooks/use-in-view.ts
export function useInView(ref, options?) {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect(); // 只触发一次
      }
    }, options);

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, options]);

  return isInView;
}
```

### SVG 通用属性

- `viewBox="0 0 120 80"` - 统一画布比例
- `stroke-dasharray` + `stroke-dashoffset` 实现线条绘制动画
- `fill="currentColor"` 继承文字颜色

---

## 文件清单

1. `app/components/animated-cards/use-in-view.ts`
2. `app/components/animated-cards/challenge-card.tsx`
3. `app/components/animated-cards/lifecycle-card.tsx`
4. `app/components/animated-cards/feature-card.tsx`
5. `app/components/animated-cards/agent-badge.tsx`
6. `app/globals.css` - 新增动画 keyframes
7. `app/page.tsx` - 集成新组件
