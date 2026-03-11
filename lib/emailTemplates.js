const theme = {
    background: "#f4f4f7",
    container: "#ffffff",
    text: "#111827",
    muted: "#6b7280",
    border: "#e5e7eb",
    brand: "#2563eb",
    buttonText: "#ffffff",
};

const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

const renderParagraphs = (body) => {
    const parts = Array.isArray(body)
        ? body
        : String(body ?? "").split(/\r?\n\r?\n/);
    return parts
        .filter((item) => item !== undefined && item !== null && String(item).trim() !== "")
        .map(
            (item) =>
                `<p style="margin: 0 0 16px; color: ${theme.text}; font-size: 16px; line-height: 1.6;">${escapeHtml(
                    item
                )}</p>`
        )
        .join("");
};

const renderGeneralEmail = (options = {}) => {
    const {
        title = "Hello",
        preheader = "",
        greeting = "Hi there,",
        body = "",
        ctaText = "",
        ctaUrl = "",
        footerText = "Thanks for being part of the hackathon.",
    } = options;
    const ctaHtml =
        ctaText && ctaUrl
            ? `<tr>
					<td align="center" style="padding: 8px 0 24px;">
						<a href="${escapeHtml(ctaUrl)}" style="background: ${theme.brand}; color: ${theme.buttonText}; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
							${escapeHtml(ctaText)}
						</a>
					</td>
				</tr>`
            : "";

    return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="X-UA-Compatible" content="IE=edge" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>${escapeHtml(title)}</title>
	</head>
	<body style="margin: 0; padding: 0; background: ${theme.background};">
		<span style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">
			${escapeHtml(preheader)}
		</span>
		<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: ${theme.background}; padding: 24px 0;">
			<tr>
				<td align="center">
					<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width: 100%; max-width: 600px; background: ${theme.container}; border-radius: 8px; border: 1px solid ${theme.border};">
						<tr>
							<td style="padding: 32px 32px 16px;">
								<h1 style="margin: 0 0 8px; font-size: 24px; line-height: 1.3; color: ${theme.text};">${escapeHtml(
        title
    )}</h1>
								<p style="margin: 0 0 16px; color: ${theme.muted}; font-size: 14px;">${escapeHtml(
        greeting
    )}</p>
							</td>
						</tr>
						<tr>
							<td style="padding: 0 32px 8px;">
								${renderParagraphs(body)}
							</td>
						</tr>
						${ctaHtml}
						<tr>
							<td style="padding: 0 32px 32px; border-top: 1px solid ${theme.border};">
								<p style="margin: 16px 0 0; color: ${theme.muted}; font-size: 12px; line-height: 1.6;">
									${escapeHtml(footerText)}
								</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;
};

module.exports = {
    theme,
    renderGeneralEmail,
};
