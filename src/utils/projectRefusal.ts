// readRefusal (J1c-1, R-J1C-2/3) — turns one refused api response into what a
// Projects screen shows: one banner text, the errors of the fields the form
// really has, and the machine code.
//
// The server's `detail` is the banner. The machine code is read from
// "error_code", or from the older "code" key, and only when it is a string —
// so it is never mistaken for an error of a form field named "code". A field
// error is a list of messages; the first one goes under its field. An error of
// a field the form does not have is shown in the banner, so nothing the server
// said is dropped.
export interface Refusal {
  banner: string | null;
  code: string | null;
  fields: Record<string, string>;
}

type RefusedResponse = { status?: number; data?: unknown } | null | undefined;

const MACHINE_KEYS = ['error_code', 'code'];

export const readRefusal = (
  res: RefusedResponse,
  fallback: string,
  known: string[] = [],
): Refusal => {
  const data = res?.data;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { banner: fallback, code: null, fields: {} };
  }
  const body = data as Record<string, unknown>;

  const codeKey = MACHINE_KEYS.find((key) => typeof body[key] === 'string');
  const code = codeKey ? (body[codeKey] as string) : null;

  const fields: Record<string, string> = {};
  const banner: string[] = [];
  if (typeof body.detail === 'string' && body.detail) banner.push(body.detail);

  for (const [key, value] of Object.entries(body)) {
    if (key === 'detail' || !Array.isArray(value)) continue;
    const first = value.find((message) => typeof message === 'string');
    if (typeof first !== 'string') continue;
    if (known.includes(key)) fields[key] = first;
    else banner.push(`${key}: ${first}`);
  }

  if (banner.length === 0 && Object.keys(fields).length === 0) banner.push(fallback);
  return { banner: banner.length ? banner.join(' ') : null, code, fields };
};
