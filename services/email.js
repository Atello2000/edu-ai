const { Resend } = require('resend');
const logger = require('./logger');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || 'Jangalai <noreply@jangalai.app>';

function normalizeUrl(raw, fallback) {
  const value = String(raw || fallback || '').trim().replace(/^["']|["']$/g, '');
  return value
    .replace(/^ttps:\/\//i, 'https://')
    .replace(/^tps:\/\//i, 'https://')
    .replace(/^tp:\/\//i, 'http://')
    .replace(/\/+$/, '');
}

function getBackendUrl() {
  return normalizeUrl(
    process.env.BACKEND_URL || process.env.APP_URL || process.env.CLIENT_URL,
    'http://localhost:3001'
  );
}

function getClientUrl() {
  return normalizeUrl(
    process.env.CLIENT_URL || process.env.APP_URL || process.env.BACKEND_URL,
    'http://localhost:3001'
  );
}

function getVerifyUrl() {
  return normalizeUrl(
    process.env.VERIFY_URL || process.env.CLIENT_URL || process.env.APP_URL || process.env.BACKEND_URL,
    'http://localhost:3001'
  );
}

async function sendEmail({ to, subject, html, devUrl }) {
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is not configured');
    }
    logger.warn('Email provider not configured; email was not sent', {
      to,
      subject,
      link: devUrl,
    });
    return;
  }
  const result = await resend.emails.send({ from: FROM, to, subject, html });
  if (result?.error) {
    const message = result.error.message || result.error.name || 'Resend email delivery failed';
    throw new Error(message);
  }
  logger.info('Email sent', { to, subject, id: result?.data?.id });
}

function emailTemplate(body) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f0;font-family:'Outfit',Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
  <div style="background:#080c16;padding:28px 32px;">
    <p style="margin:0;font-family:'Georgia',serif;font-size:1.5rem;color:#fff;font-weight:300;">jangal<em style="color:#3d7eff;font-style:italic;">ai</em></p>
  </div>
  <div style="padding:32px;">${body}</div>
  <div style="padding:16px 32px;border-top:1px solid #e5e5e5;font-size:.78rem;color:#999;text-align:center;">
    &copy; ${new Date().getFullYear()} Jangalai - Plateforme IA pour vos cours
  </div>
</div></body></html>`;
}

exports.sendVerifyEmail = async (to, token) => {
  const url = `${getVerifyUrl()}/api/auth/verify/${token}`;
  await sendEmail({
    to,
    subject: 'Confirmez votre adresse email - Jangalai',
    devUrl: url,
    html: emailTemplate(`
      <h2 style="margin:0 0 12px;font-size:1.3rem;font-weight:600;color:#111;">Confirmez votre adresse email</h2>
      <p style="color:#555;line-height:1.6;">Cliquez sur le bouton ci-dessous pour activer votre compte Jangalai.</p>
      <a href="${url}" style="display:inline-block;margin:20px 0;background:#3d7eff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Confirmer mon email</a>
      <p style="color:#999;font-size:.82rem;">Ce lien expire dans 24 heures. Si vous n'avez pas cree de compte, ignorez cet email.</p>
    `),
  });
};

exports.sendResetEmail = async (to, token) => {
  const url = `${getClientUrl()}/reset-password?token=${token}`;
  await sendEmail({
    to,
    subject: 'Reinitialisation de votre mot de passe - Jangalai',
    devUrl: url,
    html: emailTemplate(`
      <h2 style="margin:0 0 12px;font-size:1.3rem;font-weight:600;color:#111;">R&#233;initialisez votre mot de passe</h2>
      <p style="color:#555;line-height:1.6;">Une demande de r&#233;initialisation a &#233;t&#233; effectu&#233;e pour votre compte.</p>
      <a href="${url}" style="display:inline-block;margin:20px 0;background:#3d7eff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">R&#233;initialiser mon mot de passe</a>
      <p style="color:#999;font-size:.82rem;">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    `),
  });
};

exports._private = { normalizeUrl, getBackendUrl, getClientUrl, getVerifyUrl };
