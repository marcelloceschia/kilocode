/**
 * Kilo-specific Question extensions.
 *
 * These are kept in a dedicated kilocode directory to minimize merge conflicts
 * with upstream opencode (which uses a different architecture for question prompts).
 */
import { Effect, SessionID } from "effect"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Log } from "@/util"
import type { QuestionID } from "@/question/schema"
import type { RejectedError } from "@/question/index"

const log = Log.create({ service: "question.kilocode" })

interface PendingEntry {
  info: { sessionID: SessionID; id: QuestionID }
  deferred: Deferred.Deferred<ReadonlyArray<string>, RejectedError>
}

export { PendingEntry }

/**
 * Dismiss every pending question on a session so a new prompt can unblock
 * an in-flight tool waiting on user input.
 *
 * Mirrors Suggestion.dismissAll so both read the same way at the callsite.
 *
 * NOTE: This dismisses ALL pending questions for the session — not just the
 * most recent one. This is intentional: when a new user prompt arrives,
 * we want to immediately clear any outstanding questions so the new
 * prompt is processed without being blocked by unanswered questions.
 */
export function dismissAll(
  sessionID: SessionID,
  pending: Map<QuestionID, PendingEntry>,
): Effect.Effect<void> {
  const matches = Array.from(pending.entries()).filter(([, entry]) => entry.info.sessionID.equals(sessionID))
  return Effect.forEach(matches, ([id, entry]) =>
    Effect.gen(function* () {
      pending.delete(id)
      log.info("dismissed", { requestID: id })
      yield* Bus.publish(Event.Rejected, {
        sessionID: entry.info.sessionID,
        requestID: entry.info.id,
      })
      yield* Deferred.fail(entry.deferred, new RejectedError())
    }),
  )
}
