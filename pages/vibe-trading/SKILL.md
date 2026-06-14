---
name: vibe-trading
description: 交易终端 - 策略监控、手动下单、AI决策日志
metadata:
  icon:
    type: lucide
    value: candlestick-chart
  cover: 'gradient:ocean'
  page:
    type: server
    command: "pnpm dev"
    port: 3100
    ready_pattern: "Ready in"
    timeout: 20000
    permission:
      - read
      - write
---

# 交易终端

策略交易监控面板，支持手动下单和 AI 决策回放。
