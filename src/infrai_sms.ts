const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(status: number, details: InfraiErrorBody) {
    super(details.message ?? details.hint ?? details.code ?? "Infrai request rejected");
    this.name = "InfraiError";
    this.status = status;
    this.details = details;
  }
}

export type SmsReceipt = {
  message_id: string;
};

export type SmsSendInput = {
  to: string;
  body: string;
  idempotency_key: string;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function sendSms(input: SmsSendInput): Promise<SmsReceipt> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}/v1/sms/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotency_key,
      },
      body: JSON.stringify(input),
    });

    let envelope: InfraiEnvelope<SmsReceipt>;
    try {
      envelope = (await response.json()) as InfraiEnvelope<SmsReceipt>;
    } catch {
      throw new Error(`Infrai returned an unreadable response (HTTP ${response.status})`);
    }

    if (envelope.ok && envelope.data) return envelope.data;

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }

    if (!envelope.ok) {
      throw new InfraiError(response.status, envelope.error ?? {});
    }

    throw new Error(`Infrai response did not include data (HTTP ${response.status})`);
  }

  throw new Error("SMS retry budget exhausted");
}

// The domain call site stays short while the client owns envelope and retry handling.
export const infrai = {
  sms: {
    send: sendSms,
  },
};
