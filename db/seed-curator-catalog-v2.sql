-- Add 7 missing guides to TheCurator's Bazaar catalog
-- Safe to re-run: uses ON CONFLICT DO NOTHING
-- Run AFTER agent-catalog.sql (table must exist)
-- These guides were added to products.ts after the original seed

INSERT INTO agent_catalog (agent_name, product_name, description, price_cents, checkout_url, platform_fee_percent, seller_earn_percent)
VALUES
  (
    'TheCurator',
    'The Free AI Stack: An End-to-End AI Setup for Small Business',
    'Build a complete five-tool AI stack -- writing, visuals, automation, inbox, and organization -- for $0 using Claude, Gemini, Canva, Zapier, and Notion free tiers.',
    1499,
    'https://buy.stripe.com/00w6oIdb14gG1nEh1Kcs80F',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'Jumpstart Your Business with AI for Under $100 a Month',
    'Concentrate your AI budget into two or three tools that cover 90% of small business needs. Claude Pro, Zapier Starter, and one specialized tool -- wired together and producing ROI in week one.',
    1499,
    'https://buy.stripe.com/9B64gAb2TaF46HY12Mcs80G',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'Copilot as a Coworker: The Microsoft 365 Team Collaboration Guide',
    'Team-level Copilot deployment for Microsoft 365: meeting recaps, collaborative documents, Copilot Pages, and shared prompt libraries that make AI output consistent across your whole team.',
    1999,
    'https://buy.stripe.com/fZucN6b2T7sS2rIbHqcs80E',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'Claude for Business: The Practical Playbook',
    'Real workflows for using Claude in business: document analysis, proposal writing, client communications, and building a persistent AI assistant that knows your business.',
    1999,
    'https://buy.stripe.com/7sY8wQ4EvbJ85DU7racs80B',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'AI Agents for Small Business',
    'Plain-English guide to deploying your first AI agent -- lead follow-up, proposal generation, triage, and automation -- in 30 days with no code required.',
    1999,
    'https://buy.stripe.com/7sY28sef56oO4zQ4eYcs80C',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'Build It Without Code: A Non-Developer''s Guide to Cursor',
    'Use Cursor and AI to build landing pages, internal tools, intake forms, and data dashboards -- without hiring a developer or learning to code.',
    1999,
    'https://buy.stripe.com/00wfZi4EveVkfeu5j2cs80D',
    0.00,
    100.00
  ),
  (
    'TheCurator',
    'Enterprise AI Deployment: The Complete Implementation Guide',
    'An 8-phase enterprise AI deployment framework covering use case selection, vendor evaluation, security and compliance, pilot design, change management, phased rollout, and ROI measurement.',
    2999,
    'https://buy.stripe.com/dRmdRa2wn8wW6HY3aUcs80H',
    0.00,
    100.00
  )
ON CONFLICT DO NOTHING;
