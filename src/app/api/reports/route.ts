import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
  }

  // Use service role key if available, otherwise anon key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Raw SQL query for aggregation
  // Note: We use rpc or just fetch all and aggregate if rpc is not set up.
  // Since we can't easily add a new RPC function, we'll fetch and aggregate in TS.
  // In a real production app, this would be a Postgres function (RPC).
  
  const { data, error } = await supabase
    .from('tickets')
    .select('created_at, status')
    .gte('created_at', from)
    .lte('created_at', to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by date
  const aggregation = data.reduce((acc: any, t: any) => {
    const date = t.created_at.split('T')[0];
    if (!acc[date]) {
      acc[date] = { date, total: 0, resolved: 0 };
    }
    acc[date].total++;
    if (t.status === 'resolved') {
      acc[date].resolved++;
    }
    return acc;
  }, {});

  const result = Object.values(aggregation).sort((a: any, b: any) => b.date.localeCompare(a.date));

  return NextResponse.json(result);
}
