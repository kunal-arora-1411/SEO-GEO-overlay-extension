"""Team management API endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, status

from auth.dependencies import get_current_user
from db.models.user import User
from teams.schemas import (
    CreateTeamRequest,
    InviteMemberRequest,
    TeamMemberResponse,
    TeamResponse,
    UpdateMemberRoleRequest,
)
from teams.service import TeamService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/teams", tags=["teams"])


def _get_team_service() -> TeamService:
    return TeamService()


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    request: CreateTeamRequest,
    user: User = Depends(get_current_user),
    svc: TeamService = Depends(_get_team_service),
) -> dict[str, Any]:
    """Create a new team. The authenticated user becomes the owner."""
    return svc.create_team(name=request.name, owner_id=str(user.id))


@router.get("", response_model=list[TeamResponse])
async def list_teams(
    user: User = Depends(get_current_user),
    svc: TeamService = Depends(_get_team_service),
) -> list[dict[str, Any]]:
    """List all teams the authenticated user belongs to."""
    return svc.get_user_teams(user_id=str(user.id))


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    user: User = Depends(get_current_user),
    svc: TeamService = Depends(_get_team_service),
) -> dict[str, Any]:
    """Get details for a specific team."""
    return svc.get_team(team_id=team_id)


@router.post(
    "/{team_id}/invite",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    team_id: str,
    request: InviteMemberRequest,
    user: User = Depends(get_current_user),
    svc: TeamService = Depends(_get_team_service),
) -> dict[str, Any]:
    """Invite a new member to the team by email."""
    return svc.invite_member(
        team_id=team_id,
        email=request.email,
        role=request.role,
        inviter_id=str(user.id),
    )


@router.delete(
    "/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_member(
    team_id: str,
    user_id: str,
    user: User = Depends(get_current_user),
    svc: TeamService = Depends(_get_team_service),
) -> None:
    """Remove a member from the team."""
    svc.remove_member(
        team_id=team_id,
        user_id=user_id,
        remover_id=str(user.id),
    )


@router.patch(
    "/{team_id}/members/{user_id}/role",
    response_model=TeamMemberResponse,
)
async def update_member_role(
    team_id: str,
    user_id: str,
    request: UpdateMemberRoleRequest,
    user: User = Depends(get_current_user),
    svc: TeamService = Depends(_get_team_service),
) -> dict[str, Any]:
    """Update a team member's role."""
    return svc.update_member_role(
        team_id=team_id,
        user_id=user_id,
        new_role=request.role,
        updater_id=str(user.id),
    )


@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
async def list_members(
    team_id: str,
    user: User = Depends(get_current_user),
    svc: TeamService = Depends(_get_team_service),
) -> list[dict[str, Any]]:
    """List all members of a team."""
    return svc.get_team_members(team_id=team_id)
