export type FormState = { error?: string; ok?: string; at?: number } | null;

export function fail(error: string): FormState {
  return { error, at: Date.now() };
}

export function done(ok: string): FormState {
  return { ok, at: Date.now() };
}

/** Turn database errors into plain-language messages. */
export function friendlyDbError(message: string): string {
  if (message.includes("duplicate key") && message.includes("item_number")) {
    return "That item number is already used in this program.";
  }
  if (message.includes("duplicate key") && message.includes("sections_event_id_code")) {
    return "That section number is already used in this event.";
  }
  if (message.includes("duplicate key") && message.includes("event_sessions_event_id_name")) {
    return "A session with that name already exists.";
  }
  if (message.includes("row-level security")) {
    return "You don't have permission to do that.";
  }
  if (message.includes("events_check")) {
    return "The end date can't be before the start date.";
  }
  return message;
}
