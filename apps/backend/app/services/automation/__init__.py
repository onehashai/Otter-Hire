"""
Automation execution system.

This module handles the execution of automations when triggers fire.
"""

from app.services.automation.executor import execute_automations_for_trigger

__all__ = ["execute_automations_for_trigger"]
