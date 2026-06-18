export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[sms] Twilio not configured — would send:", body.slice(0, 80));
    } else {
      console.warn("[sms] Twilio not configured — SMS skipped");
    }
    return false;
  }

  const normalized = to.replace(/\D/g, "");
  const phone = normalized.startsWith("1") ? `+${normalized}` : `+1${normalized}`;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: from, Body: body.slice(0, 160) }),
    }
  );
  return res.ok;
}
