"""Schema generation API endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, Request

from auth.dependencies import get_optional_user
from db.models.user import User
from schema_gen.generator import SchemaGenerator
from services.llm_service import LLMService

router = APIRouter(prefix="/schema", tags=["schema"])


@router.post("/generate")
async def generate_schema(
    request: Request,
    body: dict[str, Any],
    user: User | None = Depends(get_optional_user),
) -> dict[str, Any]:
    """Generate JSON-LD structured data for a page.

    Expects a JSON body with: url, title, meta_description, intent,
    primary_keyword, headings, content_text, existing_schemas.
    """
    settings = request.app.state.settings
    llm = LLMService(settings)
    generator = SchemaGenerator(llm)

    result = await generator.generate(
        url=body.get("url", ""),
        title=body.get("title", ""),
        meta_description=body.get("meta_description", ""),
        intent=body.get("intent", "informational"),
        primary_keyword=body.get("primary_keyword", ""),
        headings=body.get("headings", []),
        content_text=body.get("content_text", ""),
        existing_schemas=body.get("existing_schemas", []),
    )

    return result
