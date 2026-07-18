"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { RiShieldUserLine } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"

import { requestLarkAuthorizationCode, type LarkClientApi } from "@/lib/lark-auth"

declare global {
  interface Window {
    h5sdk?: { ready: (callback: () => void) => void }
    tt?: LarkClientApi
  }
}

type AuthState = "checking" | "authenticating" | "authenticated" | "error"

export function AuthBootstrap({
  enabled,
  appId,
  children,
}: {
  enabled: boolean
  appId: string
  children: ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState<AuthState>(enabled ? "checking" : "authenticated")
  const [error, setError] = useState("")
  const startedRef = useRef(false)

  const authenticate = useCallback(async () => {
    setError("")
    setState("checking")
    try {
      const status = await fetch("/api/auth/session", { cache: "no-store" })
      const current = (await status.json()) as { authenticated?: boolean }
      if (status.ok && current.authenticated) {
        setState("authenticated")
        return
      }
      if (!appId) throw new Error("缺少飞书应用 ID，请联系管理员完成部署配置")
      if (!window.h5sdk || !window.tt) {
        throw new Error("请在飞书客户端内打开该应用")
      }
      setState("authenticating")
      const code = await new Promise<string>((resolve, reject) => {
        window.h5sdk?.ready(() => {
          if (!window.tt) {
            reject(new Error("飞书客户端初始化失败，请重新打开应用"))
            return
          }
          requestLarkAuthorizationCode(window.tt, appId).then(resolve, reject)
        })
      })
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      })
      if (!response.ok) throw new Error("登录会话建立失败，请重新授权")
      setState("authenticated")
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请稍后重试")
      setState("error")
    }
  }, [appId, router])

  useEffect(() => {
    if (!enabled || startedRef.current) return
    startedRef.current = true
    void authenticate()
  }, [authenticate, enabled])

  if (state === "authenticated") return children

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><RiShieldUserLine /></span>
          <CardTitle>登录 SAST 商城</CardTitle>
          <CardDescription>{state === "error" ? error : "正在通过飞书安全登录，请稍候…"}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {state === "error" ? (
            <Button onClick={() => { startedRef.current = true; void authenticate() }}>重新登录</Button>
          ) : (
            <Spinner className="text-primary" />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
