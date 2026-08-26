import { formatTime } from "@/utils/format";

// Staff write a send time for the appointment reminder into the booking's
// free-text note, as SENDAT_8:30AM, because there is nowhere else to put it.
// A note nobody reads is the same as no note at all, so the Upcoming tab reads
// the marker back out and shows it to whoever is about to press Send.
//
// Parsing is deliberately forgiving. This is a convention typed in a hurry, not
// a syntax: SENDAT_8:30AM, SEND AT 8:30, sendat-08:30 and SENDAT_8PM all mean
// the same thing, and a note that is nearly right should not read as no note.
const SEND_AT = /send\s*at[_:\s-]*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;

// Whether the note is *trying* to name a send time, readable or not. Worth
// telling apart from a note with no marker at all: a mistyped time that
// silently disappears is worse than no note, because whoever wrote it believes
// it was seen. The separator or digit is what keeps ordinary prose ("client
// will send at some point") from tripping it.
const SEND_AT_MARKER = /send\s*at\s*[_:-]|send\s*at\s+\d/i;

export interface SendAtNote {
  /** 0-23, so it can drive a scheduled send later, not only a label. */
  hour: number;
  minute: number;
  /** How it reads in the UI, formatted like every other time in the app. */
  label: string;
}

/** The send time a booking note asks for, or null when it names none. */
export function parseSendAtNote(
  notes: string | null | undefined,
): SendAtNote | null {
  if (!notes) return null;
  const match = SEND_AT.exec(notes);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    // 12 AM is midnight and 12 PM is noon: the one hour where the conversion
    // is not "add twelve for the afternoon".
    if (meridiem === "am") hour = hour === 12 ? 0 : hour;
    else if (hour !== 12) hour += 12;
  } else if (hour > 23) {
    return null;
  }

  const at = new Date();
  at.setHours(hour, minute, 0, 0);
  return { hour, minute, label: formatTime(at.toISOString()) };
}

/** True when the note carries the marker, whether or not the time parsed. */
export function hasSendAtNote(notes: string | null | undefined): boolean {
  return notes != null && SEND_AT_MARKER.test(notes);
}
