/**
 * Kilo-specific Question tool extensions.
 *
 * The dismissed outcome surfaces RejectedError (e.g. from Question.dismissAll
 * when a new prompt arrives mid-question) as a "dismissed" result instead of
 * turning it into a defect via Effect.orDie, which would kill the in-flight stream.
 */
import type { Question } from "../question"

type Metadata = {
  answers: ReadonlyArray<Question.Answer>
  dismissed?: boolean
}

/**
 * Handle a "dismissed" result from Question.ask, returning tool output metadata
 * that signals the question was auto-dismissed (e.g. because a new prompt
 * arrived while the tool was waiting for user input).
 */
export function dismissedOutcome(): { title: string; output: string; metadata: Metadata } {
  const dismissed: Metadata = { answers: [], dismissed: true }
  return {
    title: "Question dismissed",
    output: "User dismissed the question.",
    metadata: dismissed,
  }
}
