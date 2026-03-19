"""Team management business logic.

Stores all data in-memory dicts for now. These will be replaced with
database models in a later migration.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# Role hierarchy: lower index = higher privilege
ROLE_HIERARCHY = ["owner", "admin", "member", "viewer"]

# In-memory storage
_teams: dict[str, dict[str, Any]] = {}
_memberships: dict[str, dict[str, Any]] = {}


def _role_rank(role: str) -> int:
    """Return the numeric rank of a role. Lower number = higher privilege."""
    try:
        return ROLE_HIERARCHY.index(role)
    except ValueError:
        return len(ROLE_HIERARCHY)


def _has_higher_or_equal_role(actor_role: str, target_role: str) -> bool:
    """Check whether the actor's role is at least as privileged as the target."""
    return _role_rank(actor_role) <= _role_rank(target_role)


def _get_member_role(team_id: str, user_id: str) -> Optional[str]:
    """Look up the role of a user within a team, or None if not a member."""
    for membership in _memberships.values():
        if membership["team_id"] == team_id and membership["user_id"] == user_id:
            return membership["role"]
    return None


class TeamService:
    """Service layer for team operations."""

    def create_team(self, name: str, owner_id: str) -> dict[str, Any]:
        """Create a new team and add the creator as the owner.

        Args:
            name: Display name for the team.
            owner_id: User ID of the team creator (becomes owner).

        Returns:
            Dict representing the newly created team.
        """
        team_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        team = {
            "id": team_id,
            "name": name,
            "created_at": now,
            "owner_id": owner_id,
        }
        _teams[team_id] = team

        # Add owner as first member
        membership_id = str(uuid.uuid4())
        _memberships[membership_id] = {
            "id": membership_id,
            "team_id": team_id,
            "user_id": owner_id,
            "email": f"user-{owner_id}@placeholder",
            "display_name": None,
            "role": "owner",
            "joined_at": now,
        }

        logger.info("Team '%s' created by user %s", name, owner_id)
        return self._team_response(team_id)

    def get_team(self, team_id: str) -> dict[str, Any]:
        """Retrieve a single team by ID.

        Raises:
            HTTPException: 404 if the team does not exist.
        """
        if team_id not in _teams:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team not found",
            )
        return self._team_response(team_id)

    def get_user_teams(self, user_id: str) -> list[dict[str, Any]]:
        """Return all teams the given user belongs to."""
        team_ids: set[str] = set()
        for membership in _memberships.values():
            if membership["user_id"] == user_id:
                team_ids.add(membership["team_id"])

        return [
            self._team_response(tid)
            for tid in team_ids
            if tid in _teams
        ]

    def invite_member(
        self,
        team_id: str,
        email: str,
        role: str,
        inviter_id: str,
    ) -> dict[str, Any]:
        """Invite a new member to a team.

        Only owners and admins can invite. Admins cannot invite other admins
        or owners.

        Args:
            team_id: Target team.
            email: Email address of the invitee.
            role: Role to assign (admin, member, viewer).
            inviter_id: User ID of the person sending the invite.

        Returns:
            Dict representing the new membership record.

        Raises:
            HTTPException: 404 if team not found, 403 if insufficient
                permissions, 409 if member already exists.
        """
        if team_id not in _teams:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team not found",
            )

        inviter_role = _get_member_role(team_id, inviter_id)
        if inviter_role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this team",
            )

        # Only owner and admin can invite
        if inviter_role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners and admins can invite members",
            )

        # Admins cannot assign roles equal or higher than their own
        if inviter_role == "admin" and _role_rank(role) <= _role_rank("admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot invite members with admin or owner role",
            )

        # Check for existing membership by email
        for membership in _memberships.values():
            if membership["team_id"] == team_id and membership["email"] == email:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A member with this email is already in the team",
                )

        membership_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        # Generate a placeholder user_id for the invitee (in production this
        # would resolve to a real user or create a pending invitation)
        invitee_user_id = str(uuid.uuid4())

        membership = {
            "id": membership_id,
            "team_id": team_id,
            "user_id": invitee_user_id,
            "email": email,
            "display_name": None,
            "role": role,
            "joined_at": now,
        }
        _memberships[membership_id] = membership

        logger.info(
            "User %s invited %s as %s to team %s",
            inviter_id, email, role, team_id,
        )
        return membership

    def remove_member(
        self,
        team_id: str,
        user_id: str,
        remover_id: str,
    ) -> None:
        """Remove a member from a team.

        Only owners and admins can remove members. Admins cannot remove other
        admins or the owner. The owner cannot be removed.

        Raises:
            HTTPException: 404 if team/member not found, 403 if insufficient
                permissions, 400 if attempting to remove the owner.
        """
        if team_id not in _teams:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team not found",
            )

        remover_role = _get_member_role(team_id, remover_id)
        if remover_role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this team",
            )

        target_role = _get_member_role(team_id, user_id)
        if target_role is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this team",
            )

        # Cannot remove the owner
        if target_role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The team owner cannot be removed",
            )

        # Only owner and admin can remove members
        if remover_role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners and admins can remove members",
            )

        # Admins cannot remove other admins
        if remover_role == "admin" and target_role == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot remove other admins",
            )

        # Find and delete the membership record
        membership_id_to_delete = None
        for mid, membership in _memberships.items():
            if membership["team_id"] == team_id and membership["user_id"] == user_id:
                membership_id_to_delete = mid
                break

        if membership_id_to_delete is not None:
            del _memberships[membership_id_to_delete]
            logger.info(
                "User %s removed user %s from team %s",
                remover_id, user_id, team_id,
            )

    def update_member_role(
        self,
        team_id: str,
        user_id: str,
        new_role: str,
        updater_id: str,
    ) -> dict[str, Any]:
        """Update a team member's role.

        Role hierarchy enforcement:
        - Only the owner can promote to admin or change admin roles.
        - Admins can change member/viewer roles.
        - Nobody can change the owner role through this method.

        Returns:
            Updated membership dict.

        Raises:
            HTTPException: 404 if team/member not found, 403 if insufficient
                permissions, 400 for invalid role transitions.
        """
        if team_id not in _teams:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team not found",
            )

        updater_role = _get_member_role(team_id, updater_id)
        if updater_role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this team",
            )

        target_role = _get_member_role(team_id, user_id)
        if target_role is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this team",
            )

        # Cannot change the owner's role
        if target_role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The owner's role cannot be changed",
            )

        # Cannot set anyone to owner via this method
        if new_role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot assign owner role through role update",
            )

        # Updater must outrank both the target's current role and the new role
        if not _has_higher_or_equal_role(updater_role, target_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to modify this member's role",
            )

        if not _has_higher_or_equal_role(updater_role, new_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions to assign the '{new_role}' role",
            )

        # Admins cannot promote to admin (only owner can)
        if updater_role == "admin" and new_role == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner can promote members to admin",
            )

        # Apply the role change
        for membership in _memberships.values():
            if membership["team_id"] == team_id and membership["user_id"] == user_id:
                membership["role"] = new_role
                logger.info(
                    "User %s changed user %s role to %s in team %s",
                    updater_id, user_id, new_role, team_id,
                )
                return membership

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership record not found",
        )

    def get_team_members(self, team_id: str) -> list[dict[str, Any]]:
        """List all members of a team.

        Raises:
            HTTPException: 404 if team not found.
        """
        if team_id not in _teams:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team not found",
            )

        members = [
            m for m in _memberships.values()
            if m["team_id"] == team_id
        ]
        # Sort by role hierarchy (owner first), then by joined_at
        members.sort(key=lambda m: (_role_rank(m["role"]), m["joined_at"]))
        return members

    def _team_response(self, team_id: str) -> dict[str, Any]:
        """Build a team response dict with computed member_count."""
        team = _teams[team_id]
        member_count = sum(
            1 for m in _memberships.values()
            if m["team_id"] == team_id
        )
        return {
            "id": team["id"],
            "name": team["name"],
            "created_at": team["created_at"],
            "member_count": member_count,
        }
