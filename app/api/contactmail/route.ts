export const runtime = "nodejs";         // ensure Node runtime (not Edge)
export const dynamic = "force-dynamic";  // avoid static caching for API

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const { fullName, modelNumber, phoneNumber, description } = await req.json();

    if (!fullName || !modelNumber || !phoneNumber) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    // ----- Derive domain / URL from headers -----
    const headers = req.headers;
    const referer = headers.get("referer") || "";
    const xfh = headers.get("x-forwarded-host") || "";
    const host = headers.get("host") || "";
    const proto =
      headers.get("x-forwarded-proto") ||
      (referer ? new URL(referer).protocol.replace(":", "") : "https");

    // Full site URL (origin) and bare domain (hostname)
    const siteOrigin = referer
      ? new URL(referer).origin
      : (xfh || host) ? `${proto}://${xfh || host}` : "";

    const siteDomain = siteOrigin ? new URL(siteOrigin).hostname : "Unknown Domain";

    // Show **either** exact page (referer) or just the origin
    const domainInfo = referer || siteOrigin || "Unknown Domain";

    // ----- Basic env sanity check (don’t log secrets) -----
    const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "MAIL_TO"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      console.error("Missing ENV keys:", missing.join(", "));
      return NextResponse.json({ success: false, error: "Email not configured" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true", // true for 465
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    // Verify connection first (helps surface config errors)
    try {
      await transporter.verify();
    } catch (e) {
      console.error("SMTP verify failed:", e);
      return NextResponse.json({ success: false, error: "Email transport failed" }, { status: 500 });
    }

    const subject = `Contact Form - ${modelNumber}`;
    const text =
      `Domain: ${domainInfo}\n` +
      `Host: ${siteDomain}\n` +
      `Full Name: ${fullName}\n` +
      `Model Number: ${modelNumber}\n` +
      `Phone Number: ${phoneNumber}\n\n` +
      `${description || ""}`;

    const html = `
      <h2>New Contact Query</h2>
      <p><strong>Domain:</strong> ${escapeHtml(domainInfo)}</p>
      <p><strong>Host:</strong> ${escapeHtml(siteDomain)}</p>
      <p><strong>Full Name:</strong> ${escapeHtml(fullName)}</p>
      <p><strong>Model Number:</strong> ${escapeHtml(modelNumber)}</p>
      <p><strong>Phone Number:</strong> ${escapeHtml(phoneNumber)}</p>
      <p><strong>Description:</strong></p>
      <p>${escapeHtml(description || "")}</p>
    `;

    await transporter.sendMail({
      from: `"Website Query" <${process.env.MAIL_FROM}>`,
      to: process.env.MAIL_TO,
      replyTo: process.env.REPLY_TO || undefined,
      subject,
      text,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("contactmail route error:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
