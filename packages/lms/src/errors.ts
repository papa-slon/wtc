/**
 * LMS domain errors. Routes map these to HTTP/JSX: EntitlementDenied/OwnershipDenied → 403,
 * LmsNotFound → 404, LmsConflict → 409. Never leak internals in the message at the route layer.
 */
export class LmsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LmsError';
  }
}
export class EntitlementDenied extends LmsError {
  readonly code = 'ENTITLEMENT_DENIED' as const;
}
export class OwnershipDenied extends LmsError {
  readonly code = 'OWNERSHIP_DENIED' as const;
}
export class LmsNotFound extends LmsError {
  readonly code = 'NOT_FOUND' as const;
}
export class LmsConflict extends LmsError {
  readonly code = 'CONFLICT' as const;
}
