"use client"

import * as React from "react"
import { ReadDrawer } from "@/components/layout/read-drawer"
import { PageMeta } from "@/components/content/page-meta"
import { mockReadPageMeta } from "@/lib/mock/read-page-meta"

interface ReadPageClientProps {
  userSlug: string
  pageId: string
}

export function ReadPageClient({ userSlug: _userSlug, pageId: _pageId }: ReadPageClientProps) {
  return (
    <>
      {/* ReadDrawer with tabs: 详情 / 评论 / 笔记 */}
      <ReadDrawer
        tabs={[
          {
            value: "details",
            label: "详情",
            content: <PageMeta data={mockReadPageMeta} />,
          },
          {
            value: "comments",
            label: "评论",
            badge: 28,
            content: <CommentsPlaceholder />,
          },
          {
            value: "notes",
            label: "笔记",
            badge: 12,
            content: <NotesPlaceholder />,
          },
        ]}
        defaultTab="details"
      />

      {/* Main content: full-viewport iframe */}
      <div
        className="-mx-[calc((100vw-100%)/2)] w-screen relative left-1/2 right-1/2"
        style={{
          marginLeft: "calc(-50vw + 50%)",
          marginRight: "calc(-50vw + 50%)",
        }}
      >
        <div
          className="w-full bg-background"
          style={{ minHeight: "calc(100vh - var(--nav-h, 56px))" }}
        >
          <iframe
            title={mockReadPageMeta.title}
            srcDoc={DEMO_HTML}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            className="w-full border-0 bg-white"
            style={{ height: "calc(100vh - var(--nav-h, 56px))" }}
          />
        </div>
      </div>
    </>
  )
}

function CommentsPlaceholder() {
  return (
    <div className="grid place-items-center min-h-[200px] text-muted-foreground text-sm">
      <div className="grid gap-3 justify-items-center">
        <svg className="h-10 w-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <span>暂无评论</span>
      </div>
    </div>
  )
}

function NotesPlaceholder() {
  return (
    <div className="grid place-items-center min-h-[200px] text-muted-foreground text-sm">
      <div className="grid gap-3 justify-items-center">
        <svg className="h-10 w-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <span>暂无笔记</span>
      </div>
    </div>
  )
}

// Demo HTML content for the iframe — a simple article page about Transformer architecture
const DEMO_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  :root { color-scheme: light; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Lexend', sans-serif;
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 24px 120px;
    line-height: 1.8;
    color: #173f4c;
    background: #fff;
  }
  h1 { font-family: Lexend, sans-serif; font-size: clamp(28px, 4vw, 40px); line-height: 1.12; margin: 0 0 12px; color: #0a2a33; }
  h2 { font-family: Lexend, sans-serif; font-size: 22px; margin: 40px 0 12px; color: #0d4b5c; }
  h3 { font-family: Lexend, sans-serif; font-size: 18px; margin: 28px 0 8px; color: #104f61; }
  p { margin: 0 0 16px; font-size: 16px; }
  .meta { color: #5f7f8c; font-size: 14px; margin-bottom: 32px; }
  .highlight { background: linear-gradient(135deg, #e6f7fb, #d4f0f7); padding: 18px 22px; border-radius: 10px; margin: 24px 0; border-left: 3px solid #0891b2; }
  code { background: #f0f7fa; padding: 2px 7px; border-radius: 5px; font-size: 14px; color: #0d697f; }
  pre { background: #f5fafc; padding: 18px; border-radius: 10px; overflow-x: auto; font-size: 14px; line-height: 1.6; border: 1px solid #e0eef2; }
  ul, ol { padding-left: 22px; margin: 12px 0 20px; }
  li { margin-bottom: 6px; }
  blockquote { border-left: 3px solid #0891b2; padding: 8px 18px; margin: 20px 0; background: #f5fafc; border-radius: 0 8px 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
  th { background: #f0f7fa; padding: 10px 14px; text-align: left; font-weight: 600; border-bottom: 2px solid #d4e8ee; }
  td { padding: 10px 14px; border-bottom: 1px solid #e8f0f3; }
  .figure { margin: 28px 0; text-align: center; }
  .figure-placeholder { background: linear-gradient(135deg, #e6f7fb, #d4f0f7); height: 220px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #5f7f8c; font-size: 14px; }
  .figure-caption { font-size: 13px; color: #8aa5b0; margin-top: 8px; }
</style>
</head>
<body>
<h1>Transformer 架构详解：从 Attention 到应用</h1>
<div class="meta">李明 · 发布于 2025-03-15 · 23,400 次阅读 · 890 次收藏</div>

<p>自 2017 年 Vaswani 等人在《Attention Is All You Need》中提出 Transformer 架构以来，这种基于自注意力机制的模型已经成为自然语言处理、计算机视觉乃至多模态学习的核心基础架构。</p>

<div class="highlight">
<strong>核心要点：</strong> Transformer 摒弃了传统的循环神经网络结构，完全依赖注意力机制来捕获序列中的长距离依赖关系，实现了更高度的并行计算和更好的序列建模能力。
</div>

<h2>1. 自注意力机制（Self-Attention）</h2>

<p>自注意力是 Transformer 的核心创新。它允许模型在处理序列中的每个位置时，能够参考序列中的所有其他位置，从而捕获全局的上下文信息。</p>

<p>具体来说，对于输入序列中的每个元素，我们计算三个向量：<strong>Query (Q)</strong>、<strong>Key (K)</strong> 和 <strong>Value (V)</strong>。注意力权重通过 Query 和 Key 的点积计算得出，然后用于对 Value 进行加权求和：</p>

<pre>Attention(Q, K, V) = softmax(QK^T / √d_k) × V</pre>

<p>其中 d_k 是 Key 向量的维度，除以 √d_k 是为了防止点积过大导致 softmax 梯度消失（即<strong>缩放点积注意力</strong>）。</p>

<div class="figure">
  <div class="figure-placeholder">Self-Attention 计算流程图</div>
  <div class="figure-caption">图 1：缩放点积注意力的计算过程</div>
</div>

<h2>2. 多头注意力（Multi-Head Attention）</h2>

<p>与其只使用一组 Q/K/V 变换，多头注意力将输入投影到多个不同的子空间，在每个子空间中独立计算注意力，然后将结果拼接起来。这使得模型能够同时关注不同位置、不同语义层面的信息。</p>

<pre>MultiHead(Q, K, V) = Concat(head_1, ..., head_h) × W^O
head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)</pre>

<p>在实践中，通常使用 8 或 16 个注意力头。每个头的维度 d_k = d_model / h，保持总计算量不变。</p>

<h2>3. 位置编码（Positional Encoding）</h2>

<p>由于 Transformer 不包含循环或卷积结构，它本身无法感知序列中元素的位置信息。为了解决这个问题，Transformer 在输入嵌入中加入了位置编码。</p>

<p>原始论文使用正弦和余弦函数来生成位置编码：</p>

<pre>PE(pos, 2i) = sin(pos / 10000^(2i/d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))</pre>

<p>这种方法的优点是能够外推到训练时未见过的序列长度，且不同位置之间的相对关系可以通过线性变换来表示。</p>

<h2>4. 前馈网络与残差连接</h2>

<p>每个注意力层之后都跟随着一个位置独立的前馈网络（FFN），通常是一个两层的 MLP：</p>

<pre>FFN(x) = ReLU(xW_1 + b_1)W_2 + b_2</pre>

<p>Transformer 在每个子层（注意力和 FFN）周围都使用了<strong>残差连接</strong>和<strong>层归一化</strong>（Layer Normalization），这使得训练更深的网络变得更加稳定。</p>

<blockquote>
<p>"残差连接和层归一化是训练深层 Transformer 的关键技巧。没有它们，梯度在反向传播过程中会迅速衰减或爆炸。" — 《Attention Is All You Need》</p>
</blockquote>

<h2>5. 编码器-解码器架构</h2>

<p>原始的 Transformer 采用编码器-解码器结构：</p>

<table>
  <tr><th>组件</th><th>描述</th></tr>
  <tr><td>编码器</td><td>N=6 个相同层的堆叠，每层包含多头自注意力 + FFN</td></tr>
  <tr><td>解码器</td><td>N=6 个相同层的堆叠，每层包含掩码多头自注意力 + 交叉注意力 + FFN</td></tr>
</table>

<p>编码器处理输入序列并生成上下文表示。解码器则根据编码器的输出和已生成的部分序列，自回归地生成目标序列。解码器中的<strong>掩码注意力</strong>确保每个位置只能注意到它之前的位置，保持自回归性质。</p>

<h2>6. 现代变体与应用</h2>

<p>Transformer 架构已经衍生出许多重要的变体：</p>

<ul>
  <li><strong>BERT</strong>（仅编码器）：通过掩码语言模型进行预训练，在理解任务上表现出色</li>
  <li><strong>GPT 系列</strong>（仅解码器）：通过自回归语言模型进行预训练，在生成任务上表现卓越</li>
  <li><strong>T5</strong>（编码器-解码器）：将所有 NLP 任务统一为文本到文本的格式</li>
  <li><strong>Vision Transformer (ViT)</strong>：将图像分割为 patch，直接应用 Transformer 编码器</li>
  <li><strong>CLIP</strong>：使用对比学习联合训练文本和图像编码器</li>
</ul>

<h2>7. 实现要点</h2>

<p>在实际实现 Transformer 时，需要注意以下几点：</p>

<ol>
  <li><strong>注意力掩码</strong>：对于变长序列，需要使用 padding mask 来避免注意到填充位置；对于自回归解码，需要使用因果掩码</li>
  <li><strong>初始化策略</strong>：通常使用 Xavier 初始化或小标准差的正态分布初始化</li>
  <li><strong>学习率调度</strong>：原始论文使用 warmup + 逆平方根衰减的学习率调度策略</li>
  <li><strong>Dropout 正则化</strong>：在注意力权重、FFN 激活和嵌入层之后使用 dropout</li>
</ol>

<div class="highlight">
<strong>实践经验：</strong> 对于中等规模的数据集，建议使用 6-12 层、8-16 个注意力头、d_model=512-768 的配置。预训练时使用较大的 batch size（如 4096）配合梯度累积可以有效稳定训练。
</div>

<p>理解 Transformer 不仅有助于掌握现代 NLP 技术，也为学习大语言模型、多模态 AI 等前沿方向打下坚实基础。</p>

</body>
</html>`
