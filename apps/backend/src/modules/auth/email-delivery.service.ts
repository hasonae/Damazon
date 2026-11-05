import { Inject, Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { APP_CONFIGURATION, type AppConfiguration } from '../../config/environment.js';

export interface EmailDelivery {
  readonly isConfigured: boolean;
  sendActionLink(
    email: string,
    link: string,
    locale: 'ar' | 'en',
    action: 'verify' | 'recover',
    expiresInMinutes: number,
  ): Promise<void>;
}

export const EMAIL_DELIVERY = Symbol('EMAIL_DELIVERY');

@Injectable()
export class SmtpEmailDelivery implements EmailDelivery {
  public readonly isConfigured: boolean;

  private readonly transporter: Transporter | null;
  private readonly fromAddress: string | undefined;

  public constructor(@Inject(APP_CONFIGURATION) configuration: AppConfiguration) {
    const email = configuration.email;
    this.isConfigured = email.isConfigured;
    this.fromAddress = email.smtpFrom;
    this.transporter =
      email.isConfigured &&
      email.smtpHost !== undefined &&
      email.smtpUser !== undefined &&
      email.smtpPassword !== undefined &&
      email.smtpFrom !== undefined
        ? createTransport({
            host: email.smtpHost,
            port: email.smtpPort,
            secure: email.smtpSecure,
            requireTLS: !email.smtpSecure,
            auth: { user: email.smtpUser, pass: email.smtpPassword },
            tls: { minVersion: 'TLSv1.2' },
          })
        : null;
  }

  public async sendActionLink(
    email: string,
    link: string,
    locale: 'ar' | 'en',
    action: 'verify' | 'recover',
    expiresInMinutes: number,
  ): Promise<void> {
    if (!this.isConfigured || this.transporter === null) {
      throw new Error('SMTP email delivery is not configured');
    }

    const arabic = locale === 'ar';
    const subject =
      action === 'verify'
        ? arabic
          ? 'تأكيد البريد الإلكتروني في دامازون'
          : 'Verify your Damazon email'
        : arabic
          ? 'استعادة كلمة مرور دامازون'
          : 'Reset your Damazon password';
    const instruction =
      action === 'verify'
        ? arabic
          ? 'اضغط على الرابط أدناه لتأكيد بريدك الإلكتروني وإكمال إنشاء الحساب:'
          : 'Use the link below to verify your email address and finish creating your account:'
        : arabic
          ? 'اضغط على الرابط أدناه لتعيين كلمة مرور جديدة:'
          : 'Use the link below to set a new password:';
    const expiry = arabic
      ? `هذا الرابط صالح لمدة ${expiresInMinutes} دقيقة ويستخدم مرة واحدة.`
      : `This single-use link expires in ${expiresInMinutes} minutes.`;

    await this.transporter.sendMail({
      from: `Damazon <${this.fromAddress}>`,
      to: email,
      subject,
      text: `${instruction}\n\n${link}\n\n${expiry}\n${arabic ? 'إذا لم تطلب ذلك فتجاهل هذه الرسالة.' : 'If you did not request this, ignore this email.'}`,
      html: arabic
        ? `<div dir="rtl"><h1>${subject}</h1><p>${instruction}</p><p><a href="${link}">متابعة إلى دامازون</a></p><p>${expiry}</p><p>إذا لم تطلب ذلك فتجاهل هذه الرسالة.</p></div>`
        : `<div><h1>${subject}</h1><p>${instruction}</p><p><a href="${link}">Continue to Damazon</a></p><p>${expiry}</p><p>If you did not request this, ignore this email.</p></div>`,
    });
  }
}
