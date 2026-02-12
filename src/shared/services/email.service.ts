import logger from '../../infrastructure/logging/logger.js';

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private config: EmailConfig;
  private apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(config: EmailConfig) {
    this.config = config;
    
    
    logger.info({
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      hasApiKey: !!config.apiKey,
    }, 'Initializing email service');
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const startTime = Date.now();
    try {
      if (!this.config.apiKey) {
        logger.error({ to: options.to }, 'BREVO_API_KEY is not set, cannot send email');
        return false;
      }

      if (!this.config.fromEmail) {
        logger.error({ to: options.to }, 'BREVO_FROM is not set, cannot send email');
        return false;
      }

      logger.info({ to: options.to, subject: options.subject }, 'Attempting to send email via Brevo API');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); 

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: this.config.fromName
            ? { email: this.config.fromEmail, name: this.config.fromName }
            : { email: this.config.fromEmail },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html,
          ...(options.text ? { textContent: options.text } : {}),
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            to: options.to,
            duration: `${duration}ms`,
            error: errorText,
          },
          'Failed to send email via Brevo API'
        );
        return false;
      }

      const resultText = await response.text().catch(() => '');
      logger.info(
        { to: options.to, duration: `${duration}ms`, result: resultText },
        'Email accepted by Brevo'
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error({ 
        error: error.message, 
        to: options.to,
        duration: `${duration}ms`,
      }, 'Failed to send email');
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
                      Kami menerima permintaan untuk mereset password akun Anda di <strong>MadPro</strong>. Gunakan kode OTP berikut untuk melanjutkan proses reset password:
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
                    
                    <!-- Divider -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0;">
                      <tr>
                        <td style="height: 1px; background-color: #e5e7eb;"></td>
                      </tr>
                    </table>
                    
                    <!-- Info Box -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
                      <tr>
                        <td style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 16px 20px;">
                          <p style="margin: 6px 0; color: #1e40af; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">
                            <strong>Langkah selanjutnya:</strong>
                          </p>
                          <p style="margin: 6px 0; color: #1e40af; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">
                            Masukkan kode OTP ini di halaman reset password untuk membuat password baru Anda.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Final message -->
                    <p style="margin: 24px 0 0 0; color: #333333; font-size: 15px; line-height: 1.5; font-family: Arial, Helvetica, sans-serif;">
                      Jika Anda tidak meminta reset password, abaikan email ini dan pastikan akun Anda tetap aman.
                    </p>
                    
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                    <p style="margin: 8px 0; font-size: 13px; color: #1f2937; font-weight: 700; font-family: Arial, Helvetica, sans-serif;">
                      MadPro
                    </p>
                    <p style="margin: 8px 0; font-size: 13px; color: #6b7280; font-family: Arial, Helvetica, sans-serif;">
                      Email ini dikirim secara otomatis, mohon jangan membalas email ini.
                    </p>
                    <p style="margin: 8px 0; font-size: 13px; color: #6b7280; font-family: Arial, Helvetica, sans-serif;">
                      Untuk keamanan, kode OTP hanya berlaku selama 10 menit.
                    </p>
                    ${userName ? `<p style="margin: 8px 0; font-size: 13px; color: #6b7280; font-family: Arial, Helvetica, sans-serif;">Email ini dikirim untuk akun: <span style="font-weight: 600; color: #004e92;">${userName}</span></p>` : ''}
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
      Reset Password - MadPro
      
      ${greeting}
      
      Kami menerima permintaan untuk reset password akun Anda.
      Kode OTP Anda: ${otp}
      
      Kode ini akan expired dalam 10 menit.
      Jangan bagikan kode ini kepada siapapun!
      
      Jika Anda tidak meminta reset password, abaikan email ini.
      ${userName ? `\nEmail ini dikirim untuk akun: ${userName}` : ''}
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Kode OTP Reset Password - MadPro',
      html,
      text,
    });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      if (!this.config.apiKey) return false;

      const response = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: {
          'api-key': this.config.apiKey,
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.error(
          { status: response.status, statusText: response.statusText, body },
          'Brevo connection verification failed'
        );
        return false;
      }

      logger.info('Brevo API key verified successfully');
      return true;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Brevo connection verification failed');
      return false;
    }
  }
}