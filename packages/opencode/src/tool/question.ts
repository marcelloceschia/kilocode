import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import { Question } from "../question"
import DESCRIPTION from "./question.txt"
import { dismissedOutcome } from "./question.kilocode"

const parameters = z.object({
  questions: z.array(Question.Prompt.zod).describe("Questions to ask"),
})

type Metadata = {
  answers: ReadonlyArray<Question.Answer>
  dismissed?: boolean // kilocode_change
}

export const QuestionTool = Tool.define<typeof parameters, Metadata, Question.Service>(
  "question",
  Effect.gen(function* () {
    const question = yield* Question.Service

    return {
      description: DESCRIPTION,
      parameters,
      execute: (params: z.infer<typeof parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          // kilocode_change start - see question.kilocode.ts
          const answers = yield* question
            .ask({
              sessionID: ctx.sessionID,
              questions: params.questions,
              tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
            })
            .pipe(Effect.catchTag("QuestionRejectedError", () => Effect.succeed<"dismissed">("dismissed")))
          if (answers === "dismissed") return dismissedOutcome()
          // kilocode_change end

          const formatted = params.questions
            .map((q, i) => `"${q.question}"="${answers[i]?.length ? answers[i].join(", ") : "Unanswered"}"`)
            .join(", ")

          return {
            title: `Asked ${params.questions.length} question${params.questions.length > 1 ? "s" : ""}`,
            output: `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`,
            metadata: {
              answers,
            },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
