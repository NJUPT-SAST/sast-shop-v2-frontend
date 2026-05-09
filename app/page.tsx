"use client"

import { TauriDemo } from "@/components/tauri-demo"
import { Button, Card, Chip, Input, Label, TextField, buttonVariants } from "@heroui/react"
import { Icon } from "@iconify/react"

const TECH_STACK = [
  "Next.js 16",
  "React 19",
  "Tauri 2",
  "TypeScript 5",
  "HeroUI v3",
  "Tailwind v4",
  "Vitest",
  "Biome",
] as const

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* Gradient orb backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-500/30 via-blue-500/30 to-cyan-400/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-0 -z-0 h-[400px] w-[600px] rounded-full bg-gradient-to-br from-pink-500/20 to-orange-400/20 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 sm:py-28">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/60 px-4 py-1.5 text-xs font-medium text-zinc-700 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:text-zinc-300">
            <Icon className="size-3.5 text-violet-500" icon="lucide:sparkles" />
            <span>v0.1.0 · Tauri-ready starter template</span>
          </div>

          <h1 className="bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl md:text-7xl dark:from-white dark:via-zinc-200 dark:to-zinc-500">
            React HeroUI
            <br />
            <span className="bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              Quick Starter
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
            A production-ready monorepo: Next.js 16 + React 19, wrapped by Tauri 2 for native
            desktop, styled with HeroUI v3 on Tailwind CSS v4. Vitest, Playwright, and Biome
            preconfigured.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              className={buttonVariants({ variant: "primary" })}
              href="https://heroui.com/docs/react/getting-started/quick-start"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon className="size-4" icon="lucide:rocket" />
              Quick Start
            </a>
            <a
              className={buttonVariants({ variant: "secondary" })}
              href="https://github.com/heroui-inc/heroui"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon className="size-4" icon="mdi:github" />
              View on GitHub
            </a>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-2">
            {TECH_STACK.map((tech) => (
              <Chip color="accent" key={tech} size="sm" variant="soft">
                {tech}
              </Chip>
            ))}
          </div>
        </section>

        {/* Component showcase */}
        <section className="mt-28">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
              Built-in Components
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Real HeroUI v3 components, live
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card variant="default">
              <Card.Header>
                <Card.Title className="flex items-center gap-2">
                  <Icon className="size-4 text-violet-500" icon="lucide:mouse-pointer-click" />
                  Buttons
                </Card.Title>
                <Card.Description>
                  Semantic variants. <code className="text-xs">onPress</code> over{" "}
                  <code className="text-xs">onClick</code>.
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-wrap gap-2 pt-2">
                <Button size="sm">Primary</Button>
                <Button size="sm" variant="secondary">
                  Secondary
                </Button>
                <Button size="sm" variant="outline">
                  Outline
                </Button>
                <Button size="sm" variant="ghost">
                  Ghost
                </Button>
                <Button size="sm" variant="danger">
                  Danger
                </Button>
              </Card.Content>
            </Card>

            <Card variant="default">
              <Card.Header>
                <Card.Title className="flex items-center gap-2">
                  <Icon className="size-4 text-emerald-500" icon="lucide:circle-check" />
                  Statuses
                </Card.Title>
                <Card.Description>
                  Compose with <code className="text-xs">Chip</code> + Iconify icons.
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-wrap gap-2 pt-2">
                <Chip color="accent" size="sm" variant="soft">
                  <Chip.Label>New</Chip.Label>
                </Chip>
                <Chip color="success" size="sm" variant="soft">
                  <Chip.Label>Active</Chip.Label>
                </Chip>
                <Chip color="warning" size="sm" variant="soft">
                  <Chip.Label>Pending</Chip.Label>
                </Chip>
                <Chip color="danger" size="sm" variant="soft">
                  <Chip.Label>Failed</Chip.Label>
                </Chip>
                <Chip color="accent" size="sm" variant="primary">
                  <Chip.Label>Beta</Chip.Label>
                </Chip>
              </Card.Content>
            </Card>

            <Card variant="default">
              <Card.Header>
                <Card.Title className="flex items-center gap-2">
                  <Icon className="size-4 text-blue-500" icon="lucide:square-pen" />
                  Form
                </Card.Title>
                <Card.Description>React Aria validation, no extra libs.</Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3 pt-2">
                <TextField name="email" type="email">
                  <Label>Email</Label>
                  <Input placeholder="you@example.com" variant="secondary" />
                </TextField>
                <Button className="self-start" size="sm" type="submit">
                  Subscribe
                </Button>
              </Card.Content>
            </Card>
          </div>
        </section>

        {/* Tauri bridge */}
        <section className="mt-28 border-t border-zinc-200 pt-16 dark:border-zinc-800">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
              Native Bridge
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Talk to Rust from React
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-600 dark:text-zinc-400">
              When launched with{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm dark:bg-zinc-800">
                pnpm tauri dev
              </code>
              , the button below calls a Rust command via{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm dark:bg-zinc-800">
                lib/tauri.ts
              </code>
              .
            </p>
          </div>
          <div className="mt-8 flex justify-center">
            <TauriDemo />
          </div>
        </section>

        <footer className="mt-28 flex flex-col items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
          <div className="flex items-center gap-2">
            <Icon className="size-3.5" icon="lucide:heart" />
            <span>Edit</span>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono dark:bg-zinc-800">
              app/page.tsx
            </code>
            <span>to make it yours</span>
          </div>
        </footer>
      </div>
    </main>
  )
}
