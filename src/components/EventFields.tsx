import { input, label } from "@/components/ui";

type EventValues = {
  name?: string;
  venue_name?: string;
  venue_address?: string;
  starts_on?: string;
  ends_on?: string;
  entries_open_on?: string | null;
  entries_close_on?: string | null;
  music_due_on?: string | null;
  contact_email?: string;
  contact_phone?: string;
  description?: string;
};

function Field({ name, text, type = "text", value, required }: { name: string; text: string; type?: string; value?: string | null; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className={label}>{text}</label>
      <input id={name} name={name} type={type} defaultValue={value ?? ""} required={required} className={input} />
    </div>
  );
}

/** The inputs for an event's details, used on both "new event" and "edit event". */
export function EventFields({ values = {} }: { values?: EventValues }) {
  return (
    <>
      <Field name="name" text="Event name" value={values.name} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="starts_on" text="First day" type="date" value={values.starts_on} required />
        <Field name="ends_on" text="Last day" type="date" value={values.ends_on} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="venue_name" text="Venue" value={values.venue_name} />
        <Field name="venue_address" text="Venue address" value={values.venue_address} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="entries_open_on" text="Entries open" type="date" value={values.entries_open_on} />
        <Field name="entries_close_on" text="Entries close" type="date" value={values.entries_close_on} />
        <Field name="music_due_on" text="Music upload due" type="date" value={values.music_due_on} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="contact_email" text="Contact email" type="email" value={values.contact_email} />
        <Field name="contact_phone" text="Contact phone" type="tel" value={values.contact_phone} />
      </div>
      <div>
        <label htmlFor="description" className={label}>Information for competitors (shown on the public page)</label>
        <textarea id="description" name="description" rows={4} defaultValue={values.description ?? ""} className={input} />
      </div>
    </>
  );
}
