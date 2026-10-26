"""Tender case lifecycle: New -> Analysis -> Review Required -> Proposal Draft
-> Approved -> Completed.

Manual transitions through ``PATCH /tender-cases/{id}`` are validated here.
``approved`` can only be reached through the proposal approval endpoint, which
enforces the approval gate. Some moves happen automatically (document upload,
extraction, proposal editing).
"""
from __future__ import annotations

from app.models import TenderCaseStatus as S
from app.models import UserRole

# Forward progress plus sensible step-backs (e.g. re-open analysis).
MANUAL_TRANSITIONS: dict[S, set[S]] = {
    S.NEW: {S.ANALYSIS},
    S.ANALYSIS: {S.NEW, S.REVIEW_REQUIRED},
    S.REVIEW_REQUIRED: {S.ANALYSIS, S.PROPOSAL_DRAFT},
    S.PROPOSAL_DRAFT: {S.REVIEW_REQUIRED},
    S.APPROVED: {S.PROPOSAL_DRAFT, S.COMPLETED},
    S.COMPLETED: set(),
}

# Re-opening an approved proposal is an approver decision.
APPROVER_ONLY: set[tuple[S, S]] = {(S.APPROVED, S.PROPOSAL_DRAFT)}

READ_ONLY = {S.APPROVED, S.COMPLETED}


class TransitionError(Exception):
    def __init__(self, message: str, status_code: int = 409) -> None:
        super().__init__(message)
        self.status_code = status_code


def allowed_transitions(current: S, role: UserRole) -> list[S]:
    targets = MANUAL_TRANSITIONS.get(current, set())
    result = []
    for target in targets:
        if (current, target) in APPROVER_ONLY and role not in {UserRole.ADMIN, UserRole.REVIEWER}:
            continue
        result.append(target)
    order = list(S)
    return sorted(result, key=order.index)


def validate_transition(current: S, target: S, role: UserRole) -> None:
    if current == target:
        return
    if target == S.APPROVED:
        raise TransitionError(
            "Use the proposal approval endpoint to approve a case "
            "(POST /tender-cases/{id}/proposal/approve).",
            status_code=400,
        )
    if target not in MANUAL_TRANSITIONS.get(current, set()):
        raise TransitionError(
            f"Invalid lifecycle transition: {current.value} -> {target.value}."
        )
    if (current, target) in APPROVER_ONLY and role not in {UserRole.ADMIN, UserRole.REVIEWER}:
        raise TransitionError(
            "Only an administrator or reviewer can re-open an approved proposal.",
            status_code=403,
        )
