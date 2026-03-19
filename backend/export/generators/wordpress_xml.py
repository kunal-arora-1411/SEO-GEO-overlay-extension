"""Generate WordPress-compatible WXR XML with Yoast SEO fields."""

import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any
from xml.dom import minidom


def generate_wordpress_xml(analysis_data: dict[str, Any]) -> str:
    """Produce a WordPress eXtended RSS (WXR) XML document.

    The export includes:
    - Yoast SEO meta fields (title, description, focus keyword)
    - Content suggestions formatted as post content
    - Standard WXR envelope compatible with WordPress import

    Args:
        analysis_data: Dict containing url, seo_score, geo_score,
            suggestions, intent, primary_keyword, meta data, etc.

    Returns:
        Well-formed XML string.
    """
    url = analysis_data.get("url", "")
    primary_keyword = analysis_data.get("primary_keyword", "")
    intent = analysis_data.get("intent", "unknown")
    seo_score = analysis_data.get("seo_score", 0)
    geo_score = analysis_data.get("geo_score", 0)
    suggestions = analysis_data.get("suggestions", [])

    # Extract meta data
    page_data = analysis_data.get("page_data", {})
    meta = page_data.get("meta", analysis_data.get("meta", {}))
    title = ""
    meta_description = ""
    if isinstance(meta, dict):
        title = meta.get("title", "")
        meta_description = meta.get("meta_description", "")

    # Use suggestion for title/description if originals are empty
    for sug in suggestions:
        if isinstance(sug, dict):
            if sug.get("element") == "title" and sug.get("suggestion") and not title:
                title = sug["suggestion"]
            if sug.get("element") == "meta_description" and sug.get("suggestion") and not meta_description:
                meta_description = sug["suggestion"]

    if not title:
        title = f"SEO & GEO Optimised Page - {intent.title()}"

    now = datetime.now(timezone.utc)
    pub_date = now.strftime("%a, %d %b %Y %H:%M:%S +0000")
    post_date = now.strftime("%Y-%m-%d %H:%M:%S")

    # Build post content from suggestions
    content_parts: list[str] = []
    content_parts.append(
        f"<h2>SEO &amp; GEO Analysis Summary</h2>\n"
        f"<p>SEO Score: {seo_score} | GEO Score: {geo_score} | "
        f"Intent: {intent} | Primary Keyword: {primary_keyword or 'N/A'}</p>\n"
    )

    if suggestions:
        content_parts.append("<h2>Content Suggestions</h2>\n")
        for idx, sug in enumerate(suggestions, 1):
            if isinstance(sug, dict):
                sug_type = sug.get("type", "general")
                element = sug.get("element", "")
                suggestion_text = sug.get("suggestion", "")
                reason = sug.get("reason", "")
                original = sug.get("original", "")

                content_parts.append(f"<h3>#{idx} {sug_type.replace('_', ' ').title()}</h3>\n")
                if element:
                    content_parts.append(f"<p><strong>Element:</strong> {element}</p>\n")
                if original:
                    content_parts.append(f"<p><strong>Original:</strong> {_xml_escape(original)}</p>\n")
                if suggestion_text:
                    content_parts.append(f"<p><strong>Suggested:</strong> {_xml_escape(suggestion_text)}</p>\n")
                if reason:
                    content_parts.append(f"<p><em>{_xml_escape(reason)}</em></p>\n")
            else:
                content_parts.append(f"<p>{_xml_escape(str(sug))}</p>\n")

    post_content = "".join(content_parts)

    # Namespace URIs
    wxr_ns = "http://wordpress.org/export/1.2/"
    dc_ns = "http://purl.org/dc/elements/1.1/"
    content_ns = "http://purl.org/rss/1.0/modules/content/"
    excerpt_ns = "http://wordpress.org/export/1.2/excerpt/"
    wp_ns = "http://wordpress.org/export/1.2/"

    # Build XML manually for cleaner output with namespaces
    xml_str = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
    xmlns:excerpt="{excerpt_ns}"
    xmlns:content="{content_ns}"
    xmlns:dc="{dc_ns}"
    xmlns:wp="{wp_ns}">
<channel>
    <title>SEO GEO Optimizer Export</title>
    <link>{_xml_escape(url)}</link>
    <description>SEO and GEO analysis export</description>
    <language>en</language>
    <wp:wxr_version>1.2</wp:wxr_version>

    <item>
        <title>{_xml_escape(title)}</title>
        <link>{_xml_escape(url)}</link>
        <pubDate>{pub_date}</pubDate>
        <dc:creator>seo-geo-optimizer</dc:creator>
        <description>{_xml_escape(meta_description)}</description>
        <content:encoded><![CDATA[{post_content}]]></content:encoded>
        <excerpt:encoded><![CDATA[{_xml_escape(meta_description)}]]></excerpt:encoded>
        <wp:post_date>{post_date}</wp:post_date>
        <wp:post_type>post</wp:post_type>
        <wp:status>draft</wp:status>

        <!-- Yoast SEO Meta Fields -->
        <wp:postmeta>
            <wp:meta_key>_yoast_wpseo_title</wp:meta_key>
            <wp:meta_value><![CDATA[{_xml_escape(title)}]]></wp:meta_value>
        </wp:postmeta>
        <wp:postmeta>
            <wp:meta_key>_yoast_wpseo_metadesc</wp:meta_key>
            <wp:meta_value><![CDATA[{_xml_escape(meta_description)}]]></wp:meta_value>
        </wp:postmeta>
        <wp:postmeta>
            <wp:meta_key>_yoast_wpseo_focuskw</wp:meta_key>
            <wp:meta_value><![CDATA[{_xml_escape(primary_keyword or "")}]]></wp:meta_value>
        </wp:postmeta>
        <wp:postmeta>
            <wp:meta_key>_seo_geo_optimizer_seo_score</wp:meta_key>
            <wp:meta_value><![CDATA[{seo_score}]]></wp:meta_value>
        </wp:postmeta>
        <wp:postmeta>
            <wp:meta_key>_seo_geo_optimizer_geo_score</wp:meta_key>
            <wp:meta_value><![CDATA[{geo_score}]]></wp:meta_value>
        </wp:postmeta>
        <wp:postmeta>
            <wp:meta_key>_seo_geo_optimizer_intent</wp:meta_key>
            <wp:meta_value><![CDATA[{intent}]]></wp:meta_value>
        </wp:postmeta>
    </item>
</channel>
</rss>"""

    return xml_str


def _xml_escape(text: str) -> str:
    """Escape special characters for XML content."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
