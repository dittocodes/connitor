"""Transactional email templates for Connitor."""

from html import escape


def build_login_otp_email(
    otp: str,
    *,
    company_name: str = "Connitor",
    product_name: str = "Hospital Visitor Tracking System",
    validity_minutes: int = 3,
) -> tuple[str, str, str]:
    """Return (subject, plain_text, html_body) for login OTP emails."""
    safe_otp = escape(otp)
    subject = f"{company_name} — Your sign-in code"

    text_body = (
        f"{company_name}\n"
        f"{product_name}\n\n"
        f"Your one-time sign-in code is: {otp}\n\n"
        f"This code expires in {validity_minutes} minutes.\n"
        "Do not share it with anyone. If you did not request this code, "
        "you can safely ignore this email.\n\n"
        f"— {company_name}"
    )

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0f4f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);">
                Secure sign-in
              </p>
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                {escape(company_name)}
              </h1>
              <p style="margin:10px 0 0;font-size:13px;color:rgba(255,255,255,0.9);">
                {escape(product_name)}
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="margin:0 0 8px;font-size:16px;line-height:1.5;color:#334155;">
                Hello,
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#64748b;">
                Use the verification code below to complete your sign-in. This code is valid for
                <strong style="color:#0f766e;">{validity_minutes} minutes</strong>.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="background-color:#f0fdfa;border:2px dashed #99f6e4;border-radius:10px;padding:24px 16px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0d9488;">
                      Your verification code
                    </p>
                    <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.35em;color:#0f172a;font-family:'Courier New',Courier,monospace;padding-left:0.35em;">
                      {safe_otp}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
                For your security, never share this code. {escape(company_name)} will never ask for it by phone or chat.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                Didn't request this? You can ignore this email — your account stays secure.
              </p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;text-align:center;">
                &copy; {escape(company_name)} &middot; {escape(product_name)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return subject, text_body, html_body


def build_registration_otp_email(
    otp: str,
    *,
    company_name: str = "Connitor",
    product_name: str = "Hospital Visitor Tracking System",
    validity_minutes: int = 10,
) -> tuple[str, str, str]:
    """Return (subject, plain_text, html_body) for registration email verification."""
    safe_otp = escape(otp)
    subject = f"{company_name} — Verify your email to complete registration"

    text_body = (
        f"{company_name}\n"
        f"{product_name}\n\n"
        f"Your email verification code is: {otp}\n\n"
        f"This code expires in {validity_minutes} minutes.\n"
        "Enter it on the registration page to activate your account. "
        "After that you can sign in with email OTP.\n\n"
        f"— {company_name}"
    )

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0f4f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);">
                Email verification
              </p>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">{escape(company_name)}</h1>
              <p style="margin:10px 0 0;font-size:13px;color:rgba(255,255,255,0.9);">Complete your registration</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#64748b;">
                Enter this code on the registration page to verify your email and activate your account.
                Valid for <strong style="color:#0f766e;">{validity_minutes} minutes</strong>.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="background-color:#f0fdfa;border:2px dashed #99f6e4;border-radius:10px;padding:24px 16px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0d9488;">
                      Verification code
                    </p>
                    <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.35em;color:#0f172a;font-family:monospace;padding-left:0.35em;">
                      {safe_otp}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return subject, text_body, html_body
