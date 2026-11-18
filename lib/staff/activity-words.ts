// Plain words for audit-trail actions, shared by the case page and the console workspace.
export const ACTIVITY_WORDS: Record<string, string> = {
  consent_recorded: "Consent recorded", check_in_completed: "Check-in completed", red_flag_raised: "Red flag raised",
  contact_shared: "Contact details shared", callback_requested: "Call-back requested", case_viewed: "Case opened",
  task_acknowledged: "Task acknowledged", task_closed: "Task closed", task_escalated: "Escalated to supervisor",
  proposal_accept: "Proposal accepted", proposal_override: "Proposal overridden", summary_edited: "Summary edited",
  summary_signed: "Summary signed", receipt_booked: "Marked booked", receipt_first_contact_confirmed: "First contact confirmed",
  contact_logged: "Contact logged", safety_screen_completed: "Safety questions answered", referred: "Referred to a service", follow_up_started: "Follow-up started", follow_up_link_created: "Follow-up link given", not_on_track: "Not on track", deletion_requested: "Patient asked to delete their data", coping_not_helping: "Coping card not helping", history_added: "History added", history_self_reported: "History self-reported",
  safety_check_asked: "Safety check asked", safety_check_answered_no: "Safety check answered no",
  ai_reply_blocked: "AI reply blocked by guardrail", ai_unavailable_fallback: "AI unavailable, questionnaire used", urgency_changed: "Urgency changed", case_reviewed: "Marked reviewed", patient_message_sent: "Message sent to patient",
  manual_escalation: "Escalated by a clinician", data_deleted: "Data deleted", check_in_paused: "Paused to finish later", about_you_saved: "Answered About you (fairness only)", referral_created: "Referred to a service", referral_booked: "Appointment booked",
  referral_first_contact: "First contact with the service", referral_closed: "Hand-off closed", referral_not_booked_yet: "Patient: not booked yet",
  referral_help_requested: "Patient asked for help booking", referral_not_attended: "Patient: didn't see them yet", referral_remind: "Booking reminder shown",
  referral_stall: "Hand-off stalled (not booked in time)", referral_ask_attendance: "Asked: did you see them?", referral_urgent_requeue: "Urgent hand-off back in queue", consent_granted: "Patient turned a choice on", consent_revoked: "Patient turned a choice off",
  physical_health_shared: "Physical health shared", gp_summary_downloaded: "GP summary downloaded", adverse_event_reported: "Adverse event reported", patient_message_received: "Patient sent a message",
  contact_preferences_saved: "Contact preferences saved", check_in_felt_easy: "Said the check-in felt easy", check_in_felt_ok: "Said the check-in felt OK",
  check_in_felt_hard: "Said the check-in felt hard",
};
export const actorWord = (actor: string) => (actor.startsWith("clinician") ? "Clinician" : actor.startsWith("supervisor") ? "Supervisor" : actor === "patient" ? "Patient" : "System");
