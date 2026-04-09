"""Team management API endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.models.team import Team, TeamMember
from db.models.user import User
from db.session import get_db
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


# ---------------------------------------------------------------------------
# Schemas for /teams/me endpoints
# ---------------------------------------------------------------------------

class MemberOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    joined_at: str


class TeamOut(BaseModel):
    id: str
    name: str
    members: list[MemberOut]
    plan: str


class InviteBody(BaseModel):
    email: str
    role: str = "member"


# ---------------------------------------------------------------------------
# Helper: get-or-create the current user's primary team
# ---------------------------------------------------------------------------

async def _get_or_create_team(user: User, db: AsyncSession) -> Team:
    """Return the user's first team, creating one if none exists."""
    result = await db.execute(
        select(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(TeamMember.user_id == user.id)
        .limit(1)
    )
    team = result.scalar_one_or_none()

    if team is None:
        name = f"{user.display_name or user.email.split('@')[0]}'s Team"
        team = Team(name=name)
        db.add(team)
        await db.flush()
        member = TeamMember(team_id=team.id, user_id=user.id, role="owner")
        db.add(member)
        await db.flush()
        await db.refresh(team)

    return team


async def _build_team_out(team: Team, db: AsyncSession, owner_tier: str) -> TeamOut:
    members_result = await db.execute(
        select(TeamMember, User)
        .join(User, User.id == TeamMember.user_id)
        .where(TeamMember.team_id == team.id)
    )
    rows = members_result.all()
    members = [
        MemberOut(
            id=str(tm.id),
            email=u.email,
            full_name=u.display_name or "",
            role=tm.role,
            joined_at=tm.joined_at.isoformat(),
        )
        for tm, u in rows
    ]
    return TeamOut(
        id=str(team.id),
        name=team.name,
        members=members,
        plan=owner_tier,
    )


# ---------------------------------------------------------------------------
# /teams/me convenience routes
# ---------------------------------------------------------------------------

@router.get("/me", response_model=TeamOut)
async def get_my_team(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamOut:
    """Get (or auto-create) the authenticated user's primary team."""
    team = await _get_or_create_team(user, db)
    return await _build_team_out(team, db, user.tier)


@router.post("/me/invite", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
async def invite_to_my_team(
    body: InviteBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MemberOut:
    """Invite a user to the authenticated user's primary team."""
    team = await _get_or_create_team(user, db)

    invitee_result = await db.execute(select(User).where(User.email == body.email))
    invitee = invitee_result.scalar_one_or_none()
    if invitee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found with that email address",
        )

    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == invitee.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this team",
        )

    member = TeamMember(team_id=team.id, user_id=invitee.id, role=body.role)
    db.add(member)
    await db.flush()
    await db.refresh(member)

    return MemberOut(
        id=str(member.id),
        email=invitee.email,
        full_name=invitee.display_name or "",
        role=member.role,
        joined_at=member.joined_at.isoformat(),
    )


@router.delete("/me/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_my_team(
    member_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a member from the authenticated user's primary team."""
    team = await _get_or_create_team(user, db)

    # Verify the requester is owner/admin
    requester_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.user_id == user.id,
        )
    )
    requester_membership = requester_result.scalar_one_or_none()
    if requester_membership is None or requester_membership.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team owners and admins can remove members",
        )

    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.team_id == team.id,
        )
    )
    member = member_result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if member.user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove yourself")

    await db.delete(member)


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
