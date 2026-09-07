from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models.db_models import BlockPlan

def approve_block_plan(db: Session, block_id: str) -> Dict[str, Any]:
    """Approve a proposed block plan, marking it as official/final."""
    block = db.query(BlockPlan).filter_by(block_id=block_id).first()
    if not block:
        raise ValueError(f"Block plan with id {block_id} not found.")

    block.status = "Approved"
    block.rejection_reason = None
    db.commit()

    return {
        "block_id": block.block_id,
        "status": block.status,
        "message": f"Block {block_id} approved by human planner."
    }

def reject_block_plan(db: Session, block_id: str, reason: str) -> Dict[str, Any]:
    """Reject a proposed block plan with mandatory machine-audited reason."""
    block = db.query(BlockPlan).filter_by(block_id=block_id).first()
    if not block:
        raise ValueError(f"Block plan with id {block_id} not found.")

    if not reason or len(reason.strip()) < 3:
        raise ValueError("A valid rejection reason must be provided.")

    block.status = "Rejected"
    block.rejection_reason = reason.strip()
    db.commit()

    return {
        "block_id": block.block_id,
        "status": block.status,
        "rejection_reason": block.rejection_reason,
        "message": f"Block {block_id} rejected."
    }
