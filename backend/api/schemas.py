from typing import Optional

from pydantic import BaseModel, Field


# --- Page data models (received from the extension) ---
# All models use extra="ignore" so unexpected fields from the
# extension are silently dropped instead of causing 422 errors.

class MetaData(BaseModel):
    model_config = {"extra": "ignore"}

    title: Optional[str] = None
    title_length: int = 0
    meta_description: Optional[str] = None
    meta_description_length: int = 0
    canonical_url: Optional[str] = None
    robots: Optional[str] = None
    language: Optional[str] = None
    author: Optional[str] = None


class HeadingItem(BaseModel):
    model_config = {"extra": "ignore"}

    index: int = 0
    text: str = ""
    selector: Optional[str] = None


class ParagraphItem(BaseModel):
    model_config = {"extra": "ignore"}

    index: int = 0
    text: str = ""
    word_count: int = 0
    selector: Optional[str] = None


class ContentData(BaseModel):
    model_config = {"extra": "ignore"}

    full_text: str = Field(default="", max_length=500000)
    word_count: int = 0
    sentence_count: int = 0
    paragraph_count: int = 0
    paragraphs: list[ParagraphItem] = Field(default_factory=list)
    lists: list[dict] = Field(default_factory=list)
    tables: list[dict] = Field(default_factory=list)


class HeadingsData(BaseModel):
    model_config = {"extra": "ignore"}

    h1: list[HeadingItem] = Field(default_factory=list)
    h2: list[HeadingItem] = Field(default_factory=list)
    h3: list[HeadingItem] = Field(default_factory=list)


class LinksData(BaseModel):
    model_config = {"extra": "ignore"}

    internal_count: int = 0
    external_count: int = 0
    broken_count: int = 0


class StructuredDataInfo(BaseModel):
    model_config = {"extra": "ignore"}

    json_ld_types: list[str] = Field(default_factory=list)
    has_schema: bool = False


class ReadabilityData(BaseModel):
    model_config = {"extra": "ignore"}

    flesch_reading_ease: float = 0.0
    flesch_kincaid_grade: float = 0.0
    smog_index: float = 0.0


class SEOIssue(BaseModel):
    model_config = {"extra": "ignore"}

    type: str = ""
    impact: int = 0
    element: str = ""
    message: str = ""
    suggestion_type: Optional[str] = None


# --- Request ---

class AnalyzeRequest(BaseModel):
    model_config = {"extra": "ignore"}

    url: str
    meta: MetaData = Field(default_factory=MetaData)
    headings: HeadingsData = Field(default_factory=HeadingsData)
    content: ContentData = Field(default_factory=ContentData)
    links: LinksData = Field(default_factory=LinksData)
    structured_data: StructuredDataInfo = Field(default_factory=StructuredDataInfo)
    readability: ReadabilityData = Field(default_factory=ReadabilityData)
    seo_issues: list[SEOIssue] = Field(default_factory=list)


# --- Response ---

class GEOCategoryScore(BaseModel):
    score: float
    max_score: float
    findings: list[str] = Field(default_factory=list)


class Suggestion(BaseModel):
    type: str
    element: str
    selector: Optional[str] = None
    original: Optional[str] = None
    suggestion: str
    reason: str
    impact: int = Field(ge=1, le=10)


class AnalyzeResponse(BaseModel):
    geo_score: int
    geo_categories: dict[str, GEOCategoryScore]
    geo_issues: list[dict] = Field(default_factory=list)
    suggestions: list[Suggestion] = Field(default_factory=list)
    intent: str
    primary_keyword: Optional[str] = None
    processing_time_ms: int
