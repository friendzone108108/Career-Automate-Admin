import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createFrontendServiceClient } from '@/lib/supabase';

// SMTP Configuration from environment variables
const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_APP_PASSWORD;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASSWORD?.replace(/\s/g, '') // Remove spaces from app password if any
    }
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { subject, message, notificationType, targetAudience, recipientEmail, recipientId } = body;

        if (!subject || !message) {
            return NextResponse.json(
                { error: 'Subject and message are required' },
                { status: 400 }
            );
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                        <img src="https://i.postimg.cc/1RvV7gcX/CA_logo_banner_transparent.png" alt="Career Automate" style="height: 50px; margin-bottom: 10px;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">${notificationType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</h1>
                    </div>
                    <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">${subject}</h2>
                        <div style="color: #555; line-height: 1.6; white-space: pre-wrap;">${message}</div>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="color: #888; font-size: 12px; text-align: center;">
                            This email was sent by Career Automate.<br>
                            © ${new Date().getFullYear()} Career Automate. All rights reserved.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;

        let emailsSent = 0;

        if (targetAudience === 'single' && recipientEmail) {
            // Send to single user
            await transporter.sendMail({
                from: `"Career Automate" <${SMTP_EMAIL}>`,
                to: recipientEmail,
                subject: subject,
                html: htmlContent
            });
            emailsSent = 1;
        } else if (targetAudience === 'all') {
            // Fetch all users with primary_email
            const frontendClient = createFrontendServiceClient();

            const { data: profiles } = await frontendClient
                .from('profiles')
                .select('primary_email')
                .not('primary_email', 'is', null);

            const { data: users } = await frontendClient
                .from('users')
                .select('email');

            // Collect all unique emails
            const emails = new Set<string>();

            profiles?.forEach(p => {
                if (p.primary_email) emails.add(p.primary_email);
            });

            users?.forEach(u => {
                if (u.email) emails.add(u.email);
            });

            const emailList = Array.from(emails);

            // Send emails in batches (to avoid rate limiting)
            const batchSize = 10;
            for (let i = 0; i < emailList.length; i += batchSize) {
                const batch = emailList.slice(i, i + batchSize);

                await Promise.all(batch.map(async (email) => {
                    try {
                        await transporter.sendMail({
                            from: `"Career Automate" <${SMTP_EMAIL}>`,
                            to: email,
                            subject: subject,
                            html: htmlContent
                        });
                        emailsSent++;
                    } catch (err) {
                        console.error(`Failed to send to ${email}:`, err);
                    }
                }));

                // Small delay between batches
                if (i + batchSize < emailList.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        return NextResponse.json({
            success: true,
            emailsSent,
            message: `Successfully sent ${emailsSent} email(s)`
        });

    } catch (error: any) {
        console.error('Error sending email:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to send email' },
            { status: 500 }
        );
    }
}
