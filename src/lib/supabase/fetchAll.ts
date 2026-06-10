import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helper to fetch all rows from a Supabase table, bypassing the default 1000 row limit.
 */
export async function fetchAllParticipants(
  supabase: SupabaseClient<any, "public", any>,
  selectQuery: string = '*',
  options?: {
    eq?: { column: string; value: any },
    order?: { column: string; ascending?: boolean; nullsFirst?: boolean }
  }
) {
  let allData: any[] = []
  let from = 0
  const step = 1000

  while (true) {
    let query = supabase.from('participants').select(selectQuery).range(from, from + step - 1)
    
    if (options?.eq) {
      query = query.eq(options.eq.column, options.eq.value)
    }
    if (options?.order) {
      query = query.order(options.order.column, { 
        ascending: options.order.ascending ?? true, 
        nullsFirst: options.order.nullsFirst ?? false 
      })
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching participants:', error)
      break
    }

    if (!data || data.length === 0) break

    allData.push(...data)

    if (data.length < step) break

    from += step
  }

  return allData
}
