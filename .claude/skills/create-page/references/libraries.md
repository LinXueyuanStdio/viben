# CDN Libraries Reference

推荐的 CDN 库及暗色主题配置。所有页面通过 `<script>` / `<link>` 引入，无需构建工具。

## 图表

### ECharts

```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
```

暗色主题适配：

```javascript
// 读取 CSS 变量作为 ECharts 颜色
function getTokenColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const chart = echarts.init(el, VibenPage.theme === 'dark' ? 'dark' : null);

// 主题切换时重新渲染
VibenPage.onThemeChange(function(theme) {
  chart.dispose();
  const newChart = echarts.init(el, theme === 'dark' ? 'dark' : null);
  newChart.setOption(option);
});

// 使用 token 颜色
const option = {
  color: [
    getTokenColor('--chart-1'),
    getTokenColor('--chart-2'),
    getTokenColor('--chart-3'),
    getTokenColor('--chart-4'),
  ],
  backgroundColor: 'transparent',
};
```

### Chart.js

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
```

```javascript
Chart.defaults.color = getTokenColor('--foreground-secondary');
Chart.defaults.borderColor = getTokenColor('--border');

new Chart(ctx, {
  type: 'line',
  data: {
    datasets: [{
      borderColor: getTokenColor('--chart-1'),
      backgroundColor: getTokenColor('--chart-1') + '33', // 20% alpha hack
    }]
  },
  options: {
    plugins: { legend: { labels: { color: getTokenColor('--foreground') } } },
    scales: {
      x: { ticks: { color: getTokenColor('--foreground-secondary') }, grid: { color: getTokenColor('--border') } },
      y: { ticks: { color: getTokenColor('--foreground-secondary') }, grid: { color: getTokenColor('--border') } },
    }
  }
});
```

## 图标

### Lucide Icons

```html
<script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js"></script>
```

```javascript
lucide.createIcons(); // 自动渲染 <i data-lucide="icon-name"></i>
```

```html
<i data-lucide="trending-up" style="color: var(--success)"></i>
<i data-lucide="trending-down" style="color: var(--error)"></i>
```

## 动画

### GSAP (ScrollTrigger)

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
```

```javascript
gsap.registerPlugin(ScrollTrigger);

gsap.from('.feature-card', {
  y: 40,
  opacity: 0,
  duration: 0.6,
  stagger: 0.1,
  ease: 'expo.out',
  scrollTrigger: {
    trigger: '.features',
    start: 'top 80%',
  }
});
```

**注意**：检查 `prefers-reduced-motion`：
```javascript
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  gsap.globalTimeline.timeScale(100); // 跳过动画
}
```

## 工具

### Day.js (日期)

```html
<script src="https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dayjs@1/locale/zh-cn.js"></script>
```

```javascript
dayjs.locale('zh-cn');
dayjs().format('YYYY-MM-DD HH:mm');
```

### Alpine.js (轻量响应式)

```html
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
```

```html
<div x-data="{ open: false }">
  <button @click="open = !open" class="btn btn-primary">Toggle</button>
  <div x-show="open" x-transition class="card">Content</div>
</div>
```

## 注意事项

1. 所有 CDN 库都应使用特定版本号（不用 `@latest`），除非页面是临时性质
2. 图表库初始化时设 `backgroundColor: 'transparent'`，让 CSS 变量控制背景
3. 主题切换时需要重新初始化图表实例（ECharts 的 theme 参数在 init 时确定）
4. 使用 Lucide 图标时，颜色直接用 `currentColor` 继承父元素
