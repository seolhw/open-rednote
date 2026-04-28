import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <main className="xhs-home page-wrap">
      <section className="xhs-hero">
        <p className="xhs-badge">小红书自动运营平台</p>
        <h1>让内容生产、发布、复盘，一套流程自动跑起来</h1>
        <p className="xhs-subtitle">
          对标你提供的 UI 视觉：左侧导航 + 中间对话工作流。这里先落地首页工作台样式，突出“会话、执行步骤、发布结果”三个核心区域。
        </p>
        <div className="xhs-actions">
          <a href="/about" className="xhs-btn xhs-btn-primary">
            查看项目说明
          </a>
          <a href="/demo/ai-chat" className="xhs-btn xhs-btn-light">
            打开 AI 助手
          </a>
        </div>
      </section>

      <section className="xhs-stats">
        {[
          ['会话任务', '128'],
          ['今日发布', '36'],
          ['成功率', '97.2%'],
          ['平均耗时', '2m 14s'],
        ].map(([label, value]) => (
          <article key={label} className="xhs-stat-card">
            <p>{label}</p>
            <h2>{value}</h2>
          </article>
        ))}
      </section>

      <section className="xhs-flow">
        <h3>自动运营流程</h3>
        <div className="xhs-flow-list">
          {[
            ['输入选题', '输入关键词或目标账号，系统自动拆解选题方向。'],
            ['生成图文', 'AI 自动输出标题、正文、配图建议与标签。'],
            ['审核发布', '确认内容后，一键触发发布与发布后监控。'],
          ].map(([title, desc], idx) => (
            <article key={title} className="xhs-flow-item">
              <span>{idx + 1}</span>
              <div>
                <h4>{title}</h4>
                <p>{desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
