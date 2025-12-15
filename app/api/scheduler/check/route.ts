import { NextResponse } from 'next/server';
import { checkScheduledBlasts } from '@/lib/scheduler/blast-scheduler';

export async function GET() {
  try {
    await checkScheduledBlasts();
    return NextResponse.json({ success: true, message: 'Scheduler check completed' });
  } catch (error) {
    console.error('[Scheduler-API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Scheduler check failed' },
      { status: 500 }
    );
  }
}

