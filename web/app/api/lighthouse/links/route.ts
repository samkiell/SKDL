import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const search = searchParams.get('search') || ''
  const limit = 25
  const from = (page - 1) * limit
  const to = from + limit - 1

  try {
    let query = supabase
      .from('media')
      .select('*', { count: 'exact' })
      .order('requested_at', { ascending: false })
      .range(from, to)

    if (search) {
      query = query.or(`id.ilike.%${search}%,title.ilike.%${search}%`)
    }

    const { data, count, error } = await query

    if (error) throw error

    return NextResponse.json({
      links: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit)
    })
  } catch (error) {
    console.error('API Error /api/lighthouse/links:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
  }

  try {
    const { error } = await supabase
      .from('media')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error /api/lighthouse/links (DELETE):', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
