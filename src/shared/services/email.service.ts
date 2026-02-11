import nodemailer from 'nodemailer';
import logger from '../../infrastructure/logging/logger.js';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, 
      auth: {
        user: config.user,
        pass: config.pass,
      },
      // Add timeout and connection settings for Railway/production
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000, // 10 seconds
      socketTimeout: 15000, // 15 seconds
      pool: true, // Use connection pooling
      maxConnections: 5,
      maxMessages: 100,
      // Retry settings
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.config.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      // Add timeout wrapper (20 seconds total)
      const sendPromise = this.transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email send timeout after 20 seconds')), 20000);
      });

      const result = await Promise.race([sendPromise, timeoutPromise]) as any;
      logger.info({ messageId: result.messageId, to: options.to }, 'Email sent successfully');
      return true;
    } catch (error: any) {
      logger.error({ error: error.message, to: options.to }, 'Failed to send email');
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
                      Survey Issue Tracker
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
      Reset Password - Survey Issue Tracker
      
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
      subject: 'Kode OTP Reset Password - Survey Issue Tracker',
      html,
      text,
    });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error({ error }, 'SMTP connection failed:');
      return false;
    }
  }
}