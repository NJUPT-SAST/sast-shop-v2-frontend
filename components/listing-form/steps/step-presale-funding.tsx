"use client"

import { FormField } from "@/components/forms/form-field"
import { Input } from "@heroui/react"
import { Section } from "../shared"

export function StepPresaleFunding() {
  return (
    <Section desc="未达标自动原路退款" title="众筹设置">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField hint="达成此金额即众筹成功" label="目标金额 (元)" name="target_amount" required>
          <Input inputMode="decimal" placeholder="10000.00" variant="secondary" />
        </FormField>
        <FormField hint="至少需 24 小时之后" label="截止时间" name="deadline" required>
          <Input placeholder="2026-06-01T00:00" type="datetime-local" variant="secondary" />
        </FormField>
      </div>
    </Section>
  )
}
