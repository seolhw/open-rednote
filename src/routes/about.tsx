import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="mx-auto w-full max-w-[1160px] space-y-4 px-4 py-10">
      <Card>
        <CardHeader>
          <Badge variant="secondary" className="w-fit">项目说明</Badge>
          <CardTitle className="text-3xl sm:text-5xl">小红书 AI 自动运营平台</CardTitle>
          <CardDescription className="max-w-3xl text-base leading-8">
            把选题、内容生成、发布与复盘串成可复用流程，帮助你用更少时间完成稳定产出。
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['智能选题', '根据关键词或目标账号快速生成可执行选题方向。'],
          ['AI 图文', '自动生成标题、正文、配图建议和话题标签。'],
          ['自动发布', '审核后触发发布动作，减少重复性操作。'],
          ['数据复盘', '沉淀发布效果，支持后续内容迭代。'],
        ].map(([title, desc]) => (
          <Card key={title} className="gap-2">
            <CardHeader className="px-4 pt-4"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4 pt-0"><p className="text-sm text-muted-foreground">{desc}</p></CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader><CardTitle>快速入口</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild><a href="/chat">打开 Chat</a></Button>
          <Button asChild variant="outline"><a href="/">返回工作台</a></Button>
        </CardContent>
      </Card>
    </main>
  )
}
