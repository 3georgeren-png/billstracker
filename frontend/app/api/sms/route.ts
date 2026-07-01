// app/api/sms/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // ✅ Check if credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('⚠️ Email credentials not configured in Vercel. SMS disabled.');
      return NextResponse.json({
        success: false,
        error: 'SMS service not configured. Please add EMAIL_USER and EMAIL_PASSWORD to environment variables.'
      });
    }

    console.log('📧 Sending email to trigger Zapier...');
    console.log('📝 Message:', message);

    // Clean the message (keep it readable)
    const cleanMessage = message.replace(/[^\x20-\x7E\n]/g, '').trim();

    // Create email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Send email - Zapier uses SUBJECT to find the email
    const info = await transporter.sendMail({
      from: `"Bill Reminder" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: 'Bill Reminder',
      text: cleanMessage,
    });

    console.log('✅ Email sent! Zapier will forward as SMS.');
    console.log('📧 Message ID:', info.messageId);
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('❌ Server error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
