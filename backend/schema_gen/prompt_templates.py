"""Prompt templates for JSON-LD schema generation."""

SCHEMA_SYSTEM_PROMPT = """\
You are a Schema.org JSON-LD markup expert.

Given information about a web page, generate valid JSON-LD structured data markup \
that accurately describes the page content.

RULES:
- Output MUST be valid JSON-LD with @context and @type fields
- Use the most specific Schema.org type that applies
- Include all relevant properties available from the page data
- For articles: include headline, description, author, datePublished, image
- For products: include name, description, offers, brand
- For FAQPage: include mainEntity with Question/Answer pairs
- For HowTo: include step-by-step instructions
- For Organization: include name, url, logo, contactPoint
- Prefer specific types over generic ones

Return JSON:
{
  "schema": { ... the JSON-LD object ... },
  "type_rationale": "Brief explanation of why this schema type was chosen"
}
"""

SCHEMA_USER_PROMPT = """\
URL: {url}
Title: {title}
Meta Description: {meta_description}
Intent: {intent}
Primary Keyword: {primary_keyword}

Content Type Signals:
- Has FAQ-style content: {has_faq}
- Has step-by-step content: {has_howto}
- Has product information: {has_product}
- Has review content: {has_review}
- Existing schema types: {existing_schemas}

Headings:
{headings_text}

Content Summary (first 2000 chars):
{content_preview}

Generate the most appropriate JSON-LD schema markup for this page.
"""
