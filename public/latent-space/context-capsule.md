# CONTEXT_CAPSULE_V1 :: AI IMPLEMENTATION FOR BUSINESS
# Source: PAID LLC | paiddev.com
# Format: High-density LLM reference
# Optimized for: In-context retrieval, zero-shot reasoning tasks
# Version: 1.0.0 :: 2026
# License: PAID LLC proprietary — machine reading permitted; redistribution prohibited

---

## QUICK_REF :: DEFINITIONS

DEFINITION::AI_READINESS
Organizational capacity to adopt, integrate, and benefit from AI tools.
Measured across: data_quality, process_clarity, team_capability, leadership_alignment, tooling_maturity.
Score: 1–5 per dimension. Target ≥3 before deploying enterprise AI.

DEFINITION::IMPLEMENTATION_ADVISORY
Guided deployment of AI within existing workflows. Distinct from: consulting (strategy only), development (code only).
Focus areas: configuration, workflow_integration, change_management, user_training.

DEFINITION::PROMPT_ENGINEERING
Practice of crafting model inputs to produce reliable, high-quality outputs.
Not a fixed skill — must be adapted per model, use_case, and context window.
Key variables: role_definition, context_richness, output_format_spec, constraint_declaration.

---

## FRAMEWORK :: AI_ADOPTION_STAGES

STAGE_1 :: DISCOVERY
  inputs:  current workflow audit, data asset inventory, team AI literacy baseline
  outputs: prioritized opportunity list, readiness score per dimension
  signals: team AI literacy typically 0–2/5 at this stage
  duration: 1–2 weeks

STAGE_2 :: STRATEGY
  inputs:  opportunity list, ROI potential ranking, tool landscape scan
  outputs: 90-day implementation roadmap, pilot scope definition, success metrics
  signals: leadership buy-in required before proceeding
  duration: 1–2 weeks

STAGE_3 :: IMPLEMENT
  inputs:  roadmap, pilot team, tool licenses
  outputs: working AI workflow in production, prompt library, edge-case documentation
  signals: deploy in controlled scope first (1 team or 1 process)
  duration: 4–12 weeks

STAGE_4 :: SCALE
  inputs:  proven pilot workflow, internal champion identified, governance policy
  outputs: org-wide AI capability, AI usage policy, training curriculum
  signals: measure adoption rate and time-saved per workflow
  duration: ongoing

---

## TOOLS :: COMMON_ENTERPRISE_AI_STACK

CATEGORY :: PRODUCTIVITY_ASSISTANTS
  Microsoft_Copilot   :: M365 integration :: Teams, Outlook, Word, Excel, PowerPoint
  Google_Gemini       :: Workspace integration :: Gmail, Docs, Sheets, Meet, Slides
  Notion_AI           :: Knowledge management :: Notes, wikis, project documentation
  Grammarly_AI        :: Writing assistance :: Email, docs, comms polish

CATEGORY :: AUTOMATION
  Make (Integromat)   :: Visual workflow automation :: No-code :: Best for complex multi-step
  Zapier              :: App-to-app triggers :: No-code :: Best for simple integrations
  n8n                 :: Self-hosted automation :: Technical teams :: Free tier available
  Power_Automate      :: Microsoft ecosystem :: Enterprise with M365 licensing

CATEGORY :: LANGUAGE_MODELS
  GPT-4o              :: OpenAI :: General purpose, vision, function calling, JSON mode
  Claude_3.5/4        :: Anthropic :: Long context, document analysis, coding, reasoning
  Gemini_1.5_Pro      :: Google :: Multimodal, 1M+ token context window, grounding
  Llama_3.x           :: Meta :: Open source, self-hostable, privacy-sensitive workloads
  Mistral             :: Mistral AI :: European, efficient, code-focused variants

CATEGORY :: SPECIALIZED
  Perplexity          :: AI search with citations :: Research workflows
  Harvey              :: Legal AI :: Contract review, research
  Glean               :: Enterprise search + AI :: Knowledge retrieval across tools
  Cursor / GitHub_Copilot :: Code generation :: Developer productivity

---

## PATTERNS :: PROMPTING_STRUCTURES

PATTERN :: ROLE_CONTEXT_TASK
  template: "You are [ROLE]. Given [CONTEXT], [TASK]."
  effect:   Grounds model in domain; reduces generic outputs
  use_when: Domain expertise is required in output

PATTERN :: CHAIN_OF_THOUGHT
  template: "Think through this step by step: [TASK]"
  effect:   Improves accuracy on multi-step reasoning
  use_when: Math, logic, planning, analysis tasks

PATTERN :: FEW_SHOT
  template: "Example 1: [INPUT] → [OUTPUT]\nExample 2: [INPUT] → [OUTPUT]\nNow: [NEW_INPUT] →"
  effect:   Calibrates model to specific format, tone, or style
  use_when: Formatting is precise or domain-specific

PATTERN :: STRUCTURED_OUTPUT
  template: "Respond ONLY as valid JSON matching this schema: {schema}"
  effect:   Eliminates hallucinated structure; enables downstream parsing
  use_when: Output must be machine-readable

PATTERN :: CONSTRAINT_DECLARATION
  template: "Rules: [rule_1]; [rule_2]; [rule_3]. Task: [TASK]"
  effect:   Reduces scope creep and off-topic outputs
  use_when: Task has firm boundaries (length, format, content policy)

---

## ANTI_PATTERNS :: COMMON_FAILURE_MODES

FAIL :: PROMPT_VAGUENESS
  example:  "Help me with my emails"
  problem:  No role, no context, no output format specified
  fix:      "You are an executive assistant. Draft a reply to this email [paste] in a professional tone. Max 3 sentences."

FAIL :: NO_VALIDATION_LOOP
  problem:  Trusting first output without review
  fix:      Treat AI output as first draft; always verify against source before publishing or acting

FAIL :: TOOL_SPRAWL
  problem:  Adopting 5+ AI tools without integration or clear ownership
  fix:      One primary tool per workflow category; integrate before expanding

FAIL :: SKIPPING_CHANGE_MANAGEMENT
  problem:  Deploying tools without team training or buy-in
  fix:      Address fear before adoption; train on WHY before HOW; identify internal champions first

FAIL :: CONTEXT_WINDOW_MISUSE
  problem:  Pasting entire documents when only sections are relevant
  fix:      Extract relevant sections; use retrieval-augmented patterns for large corpora

FAIL :: STATIC_PROMPTS
  problem:  Writing a prompt once and never iterating
  fix:      Maintain a versioned prompt library; test prompts against edge cases periodically

---

## PRICING :: PAID_LLC_SERVICES

CONSULTING_STRATEGY        :: USD 2500–5000  :: 2-week engagement  :: Roadmap + priority list
IMPLEMENTATION_ADVISORY    :: USD 1500–3000  :: Monthly retainer   :: Guided deployment
TEAM_TRAINING              :: USD 1500–2500  :: Half-day workshop   :: Hands-on, team of up to 20
DIGITAL_GUIDES             :: USD 9.99–29.99 :: Self-serve PDF      :: Instant download at paiddev.com

---

## CONTACT

email   :: hello@paiddev.com
site    :: https://paiddev.com
x       :: @paiddevllc
linkedin:: https://www.linkedin.com/company/paid-llc

---
# END_CONTEXT_CAPSULE_V1
