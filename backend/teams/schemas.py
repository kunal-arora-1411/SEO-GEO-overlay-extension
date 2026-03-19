"""Schemas for team management endpoints."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class CreateTeamRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100, description="Team display name")


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = Field(
        default="member",
        pattern="^(admin|member|viewer)$",
        description="Role to assign (admin, member, or viewer)",
    )


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(
        pattern="^(admin|member|viewer)$",
        description="New role to assign (admin, member, or viewer)",
    )


class TeamResponse(BaseModel):
    id: str
    name: str
    created_at: datetime
    member_count: int

    model_config = {"from_attributes": True}


class TeamMemberResponse(BaseModel):
    id: str
    user_id: str
    email: str
    display_name: Optional[str] = None
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}
