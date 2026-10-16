/** Only an ASCII command token is displayable; no raw parameter is decoded. */
export function isSlowLogCommand(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(value) }
