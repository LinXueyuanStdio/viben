# Implement Browse MCP Design System

## Goal

实施完整的 Browse MCP 设计系统，将现有的通用界面转变为具有独特品牌识别度的温暖、未来感的学术工具界面。

## Background

当前 Browse MCP 使用通用的黑白灰配色和系统字体，缺乏品牌识别度。我们创建了一个完整的设计系统规范（`.trellis/spec/frontend/design-system.md`），定义了：

- **温暖橙色/琥珀色**主色调（区别于典型的蓝/紫色 AI 工具）
- **Crimson Pro 衬线体** + Inter 无衬线体（学术权威感 + 现代易读性）
- **精心编排的动画系统**（页面加载序列、图表动画、卡片交互）
- **Bento Grid 布局**（灵活的卡片式布局）

## Requirements

### Phase 1: Foundation (CSS Variables & Typography)

1. **Update CSS Variables** (`apps/desktop/src/index.css`)
   - 替换所有颜色变量为新的 OKLCH 色值
   - 添加完整的 brand-amber 色阶 (50-900)
   - 添加 brand-peach、brand-teal 辅助色
   - 更新 Light/Dark 主题映射
   - 添加 spacing scale 变量
   - 添加 animation timing 变量（easing, duration）
   - 添加 radius 和 shadow 变量

2. **Import Fonts**
   - 添加 Google Fonts: Crimson Pro (weights: 400, 600)
   - 添加 Google Fonts: Inter (weights: 400, 500, 600)
   - 添加 JetBrains Mono (optional, for code)
   - 更新 `@layer base` 中的 font-family

3. **Background Texture**
   - 在 `body::before` 添加微妙的噪点纹理
   - 使用 SVG filter 实现（opacity: 0.03）

### Phase 2: Component Updates

4. **Button Component** (`apps/desktop/src/components/ui/button.tsx`)
   - 添加 hover lift effect (`hover:-translate-y-0.5`)
   - 添加 colored shadow on hover (`shadow-primary`)
   - 添加 active state (`active:translate-y-0`)
   - 使用新的 duration 和 easing 变量
   - 更新颜色为新的 CSS 变量

5. **Card Component** (新建或更新现有卡片)
   - 创建 `apps/desktop/src/components/ui/card.tsx`
   - 实现 Bento Grid size variants (small, medium, large, full)
   - 添加 hover 效果（border glow + lift + shadow）
   - 添加微妙的渐变背景（`card-gradient` class）

6. **Sidebar Component** (`apps/desktop/src/components/layout/sidebar.tsx`)
   - 更新配色使用新的 sidebar 变量
   - 添加 nav item hover animation
   - 优化 logo 区域样式

### Phase 3: Animation & Polish

7. **Page Transition Animations**
   - 安装 Framer Motion（如果尚未安装）
   - 在 `App.tsx` 添加 AnimatePresence
   - 创建 page variants (fade + slide)
   - 为所有页面包裹 motion.div

8. **Dashboard Enhancements** (`apps/desktop/src/pages/dashboard.tsx`)
   - StatCard 添加 entrance animation（stagger）
   - Activity Heatmap cells 添加 cascade animation
   - Line Chart path 添加 draw animation
   - Bar charts 添加 grow animation with stagger

9. **Loading States**
   - 创建 skeleton loading components
   - 添加 shimmer effect
   - 应用到数据加载区域

10. **Theme Toggle** (设置页面)
    - 确保 Light/Dark 切换正常工作
    - 验证所有颜色在两个主题下都正确显示
    - 添加切换动画（smooth transition）

### Phase 4: Layout System

11. **Bento Grid Implementation**
    - 创建 `apps/desktop/src/components/layout/bento-grid.tsx`
    - 实现 12-column grid system
    - 实现 responsive breakpoints
    - 重构 Dashboard 使用 Bento Grid

12. **Responsive Design**
    - 验证所有组件在移动端正常显示
    - 确保 Bento Grid 在小屏幕正确收缩为单列
    - 测试 sidebar collapse 行为

## Acceptance Criteria

### Phase 1: Foundation
- [ ] `index.css` 包含所有新的 CSS 变量（颜色、间距、动画、圆角、阴影）
- [ ] 字体正确导入：Crimson Pro、Inter、JetBrains Mono
- [ ] Light/Dark 主题都使用新的配色
- [ ] 背景有微妙的噪点纹理
- [ ] 所有颜色使用 OKLCH 格式

### Phase 2: Components
- [ ] Button 有 hover lift + colored shadow
- [ ] Card 组件支持 Bento Grid size variants
- [ ] Card 有 hover glow effect
- [ ] Sidebar 使用新配色
- [ ] 所有组件在 Dark mode 下正常显示

### Phase 3: Animation
- [ ] 页面切换有 fade + slide 动画
- [ ] Dashboard 统计卡有交错入场动画
- [ ] 图表有绘制/生长动画
- [ ] Heatmap 有级联出现动画
- [ ] 所有动画使用定义的 easing 和 duration

### Phase 4: Layout
- [ ] Bento Grid 组件实现完成
- [ ] Dashboard 重构使用 Bento Grid
- [ ] 响应式设计在所有屏幕尺寸正常工作
- [ ] 移动端正确显示为单列布局

### Overall Quality
- [ ] `pnpm dev` 成功启动，无 TypeScript 错误
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过
- [ ] 所有页面加载无控制台错误
- [ ] Dark mode 切换流畅
- [ ] 性能良好（动画不卡顿，FPS > 60）

## Technical Notes

### Color Migration

从旧变量到新变量的映射：

```
旧变量                        新变量
--primary              →      --brand-amber-600
--primary-foreground   →      oklch(1 0 0) (white)
--secondary            →      --neutral-200 (light) / --neutral-700 (dark)
--muted                →      --neutral-100 (light) / --neutral-800 (dark)
--border               →      --neutral-200 (light) / --neutral-700 (dark)
--sidebar-primary      →      --brand-amber-600
```

### Font Loading

使用 Google Fonts CDN:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

或者使用 `@import` 在 CSS 中。

### Animation Performance

- 优先使用 CSS animations（`transform`, `opacity`）
- 避免 animating `width`, `height`, `top`, `left`
- 使用 `will-change` hint for complex animations
- 使用 `transform: translateZ(0)` 触发 GPU 加速

### Bento Grid Responsive Rules

```
Mobile (<640px):    All cards span 12 columns (full width)
Tablet (641-1024):  Small=6, Medium=6, Large=12
Desktop (>1024):    Small=4, Medium=6, Large=8, Full=12
```

## Implementation Order

建议按此顺序实施，每个阶段完成后可以看到可见的改进：

1. **Phase 1** → 用户立即看到新配色
2. **Phase 2** → 组件变得更精致
3. **Phase 3** → 动画让界面生动起来
4. **Phase 4** → 布局更现代、灵活

每个 Phase 独立，可以分开提交。

## Dependencies

- Framer Motion: `pnpm add framer-motion` (for page transitions)
- 所有其他依赖已存在

## Timeline

- Phase 1: 1-2 小时（CSS 变量 + 字体）
- Phase 2: 2-3 小时（组件更新）
- Phase 3: 3-4 小时（动画实现）
- Phase 4: 2-3 小时（Bento Grid）

总计：8-12 小时开发时间

## Reference

完整的设计系统规范：`.trellis/spec/frontend/design-system.md`
