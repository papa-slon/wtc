/**
 * Live bot control safety gate. See docs/BOT_CONTROL_SAFETY_MODEL.md.
 * Control is HARD-disabled: it requires BOTH the feature flag AND an explicit audited approval,
 * and even then "stop" must never imply "close positions". By default everything throws.
 */
export class BotControlDisabledError extends Error {
  constructor(action: string) {
    super(
      `Bot control "${action}" is disabled. Live control requires FEATURE_LIVE_BOT_CONTROL=true ` +
        `AND a completed security + bot-integration audit. "stop" never closes positions.`,
    );
    this.name = 'BotControlDisabledError';
  }
}

export function assertBotControlAllowed(action: string, flagEnabled: boolean, auditApproved: boolean): void {
  if (!flagEnabled || !auditApproved) throw new BotControlDisabledError(action);
}
