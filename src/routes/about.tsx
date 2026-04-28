import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="mx-auto w-full max-w-[1160px] px-4 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-xs font-bold tracking-[0.14em] text-rose-500 uppercase">项目说明</p>
        <h1 className="mb-3 text-3xl font-bold text-zinc-900 sm:text-5xl">
          小红书 AI 自动运营平台
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-zinc-600">
          这是一个面向内容运营的工作台，目标是把选题、内容生成、发布与复盘串成可复用流程，帮助你用更少时间完成稳定产出。
        </p>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['智能选题', '根据关键词或目标账号快速生成可执行选题方向。'],
          ['AI 图文', '自动生成标题、正文、配图建议和话题标签。'],
          ['自动发布', '审核后触发发布动作，减少重复性操作。'],
          ['数据复盘', '沉淀发布效果，支持后续内容迭代。'],
        ].map(([title, desc]) => (
          <article key={title} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{desc}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">快速入口</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href="/chat"
            className="inline-flex items-center justify-center rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white no-underline transition hover:bg-rose-600"
          >
            打开 Chat
          </a>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 no-underline transition hover:bg-zinc-50"
          >
            返回工作台
          </a>
        </div>
      </section>
    </main>
  )
}
