// kilocode_change - new file
import { createSignal, Show } from "solid-js"
import type { ReasoningPart } from "@kilocode/sdk/v2"
import { useI18n } from "@opencode-ai/ui/context/i18n"
import { Icon } from "@opencode-ai/ui/components/icon"
import { Markdown } from "@opencode-ai/ui/components/markdown"
export * from "@opencode-ai/ui/message-part"
import { PART_MAPPING } from "@opencode-ai/ui/message-part"

// Override the reasoning component with collapsible UI
PART_MAPPING["reasoning"] = function ReasoningPartDisplay(props: { part: ReasoningPart }) {
  const part = props.part as ReasoningPart
  const i18n = useI18n()
  // Filter out redacted reasoning chunks from OpenRouter
  // OpenRouter sends encrypted reasoning data that appears as [REDACTED]
  const text = () => part.text.replace("[REDACTED]", "").trim()
  const [collapsed, setCollapsed] = createSignal(false)

  return (
    <Show when={text()}>
      <div data-component="reasoning-part" data-collapsed={collapsed()}>
        <div data-slot="reasoning-header" onClick={() => setCollapsed(!collapsed())}>
          <Icon name="brain" size="small" />
          <span data-slot="reasoning-label">{i18n.t("ui.reasoning.label")}</span>
          <svg data-slot="reasoning-chevron" viewBox="0 0 20 20">
            <path d="M6.667 8.333L10 11.667l3.333-3.334" stroke="currentColor" stroke-linecap="square" fill="none" />
          </svg>
        </div>
        <div data-slot="reasoning-body">
          <Markdown text={text()} cacheKey={part.id} />
        </div>
      </div>
    </Show>
  )
}
