import logger from '../../infrastructure/logging/logger.js';

export interface BrevoEmailConfig {
  apiKey: string;
  senderEmail: string;
  senderName?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class BrevoEmailService {
  private config: BrevoEmailConfig;
  private apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(config: BrevoEmailConfig) {
    this.config = config;
    logger.info({
      senderEmail: config.senderEmail,
      senderName: config.senderName,
    }, 'Initializing Brevo email service');
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const startTime = Date.now();
    try {
      logger.info({ to: options.to, subject: options.subject }, 'Attempting to send email via Brevo API');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.config.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            email: this.config.senderEmail,
            name: this.config.senderName || this.config.senderEmail,
          },
          to: [
            {
              email: options.to,
            },
          ],
          subject: options.subject,
          htmlContent: options.html,
          textContent: options.text,
        }),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error({
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          to: options.to,
          duration: `${duration}ms`,
        }, 'Failed to send email via Brevo API');
        return false;
      }

      const result = await response.json();
      logger.info({
        messageId: result.messageId,
        to: options.to,
        duration: `${duration}ms`,
      }, 'Email sent successfully via Brevo API');
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error({
        error: error.message,
        to: options.to,
        duration: `${duration}ms`,
      }, 'Failed to send email via Brevo API');
      return false;
    }
  }

  async sendPasswordResetOtp(email: string, otp: string, userName?: string): Promise<boolean> {
    const greeting = userName ? `Halo ${userName},` : 'Halo,';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kode OTP Reset Password</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f8f9fa;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa;">
          <tr>
            <td style="padding: 20px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background-color: #004e92; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">Reset Password</h2>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 30px; background-color: #ffffff;">
                    
                    <!-- Greeting -->
                    <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #004e92; font-family: Arial, Helvetica, sans-serif;">${greeting}</p>
                    
                    <!-- Main message -->
                    <p style="margin: 0 0 16px 0; color: #333333; font-size: 15px; line-height: 1.5; font-family: Arial, Helvetica, sans-serif;">
                      Kami menerima permintaan untuk mereset password akun Anda di <strong>Survey Issue Tracker</strong>. Gunakan kode OTP berikut untuk melanjutkan proses reset password:
                    </p>
                    
                    <!-- OTP Container -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                      <tr>
                        <td style="background-color: #f0f0ff; border: 2px dashed #004e92; border-radius: 8px; padding: 30px; text-align: center;">
                          <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; color: #666666; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, Helvetica, sans-serif;">
                            KODE OTP ANDA
                          </p>
                          <p style="margin: 0; font-size: 36px; font-weight: 700; color: #004e92; letter-spacing: 6px; font-family: 'Courier New', monospace;">
                            ${otp}
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Info Box -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
                      <tr>
                        <td style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 16px 20px;">
                          <p style="margin: 6px 0; color: #1e40af; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">
                            <strong>Kode OTP berlaku selama 10 menit</strong>
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Final message -->
                    <p style="margin: 24px 0 0 0; color: #333333; font-size: 15px; line-height: 1.5; font-family: Arial, Helvetica, sans-serif;">
                      Jika Anda tidak meminta reset password, abaikan email ini.
                    </p>
                    
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                    <p style="margin: 8px 0; font-size: 13px; color: #1f2937; font-weight: 700; font-family: Arial, Helvetica, sans-serif;">
                      Survey Issue Tracker
                    </p>
                    <p style="margin: 8px 0; font-size: 13px; color: #6b7280; font-family: Arial, Helvetica, sans-serif;">
                      Email ini dikirim secara otomatis, mohon jangan membalas.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `
      Reset Password - Survey Issue Tracker
      
      ${greeting}
      
      Kode OTP Anda: ${otp}
      
      Kode ini akan expired dalam 10 menit.
      Jangan bagikan kode ini kepada siapapun!
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Kode OTP Reset Password - Survey Issue Tracker',
      html,
      text,
    });
  }
}
