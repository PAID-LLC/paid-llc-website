-- Seed TheCurator's catalog with PAID LLC's 9 AI guides
-- Safe to re-run: uses ON CONFLICT DO NOTHING
-- Run AFTER agent-catalog.sql (table must exist)

INSERT INTO agent_catalog (agent_name, product_name, description, price_cents, checkout_url, platform_fee_percent, seller_earn_percent)
VALUES
  (
    'TheCurator',
    'AI Readiness Assessment',
    'Benchmark where your business stands on AI adoption, identify your highest-value gaps, and walk away with a prioritized action plan.',
    1499,
    'https://buy.stripe.com/14AcN60of28y0jAfXGcs809',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'Microsoft 365 Copilot Playbook',
    'Practical Copilot workflows for Word, Excel, Outlook, and Teams. Real examples your team can implement on day one.',
    1999,
    'https://buy.stripe.com/fZu28s0of00qgiyaDmcs808',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'Excel + AI: Analyze Data Without a Data Analyst',
    'Use ChatGPT and Copilot to clean, analyze, and summarize spreadsheet data — no advanced formulas or data background required.',
    1499,
    'https://buy.stripe.com/aFa6oI6MD28yeaqbHqcs807',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'AI-Powered Outlook: Smart Email System',
    'Build a zero-inbox system using AI-generated templates, smart filters, and automated follow-up workflows inside Outlook.',
    999,
    'https://buy.stripe.com/aFacN6db15kKaYe8vecs806',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'Google Workspace AI Guide',
    'Put Gemini to work across Gmail, Docs, Sheets, and Meet. Includes copy-paste workflows, prompts, and time-saving shortcuts.',
    1999,
    'https://buy.stripe.com/bJe14odb16oOaYe26Qcs805',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'Gmail + AI: Inbox Zero for Business',
    'A practical system for managing high-volume email using AI drafts, label automation, and reusable template libraries.',
    999,
    'https://buy.stripe.com/00w9AU7QHeVk3vMdPycs804',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'The Solopreneur Content Engine',
    'Automate your blog and social media content using Claude or ChatGPT plus Zapier. Includes prompt templates and workflow blueprints.',
    1999,
    'https://buy.stripe.com/7sY5kEc6X7sS6HY7racs803',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'Small Business AI Operations Playbook',
    'Audit your business for AI opportunities, then automate three core workflows: customer communication, scheduling, and reporting.',
    2499,
    'https://buy.stripe.com/bJefZi7QH7sS6HYdPycs802',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'ChatGPT Business Prompt Library',
    '100+ copy-paste prompts for sales, marketing, operations, HR, and customer service — organized by function and ready to use.',
    1299,
    'https://buy.stripe.com/fZucN65IzcNcgiydPycs801',
    0.00,
    100.00
  )
ON CONFLICT DO NOTHING;
