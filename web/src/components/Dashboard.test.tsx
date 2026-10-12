import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { Dashboard } from './Dashboard'

const mocks = vi.hoisted(() => ({
  from: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn(), auth: { signOut: vi.fn() },
  realtimeHandlers: [] as Array<{ filter: { table: string }; callback: () => void }>,
  sessionStatus: 'open' as 'open' | 'finished',
}))
vi.mock('../lib/supabase', () => ({ supabase: mocks }))

function queryResult(table:string) {
  const data=()=>table==='seasons'?[{id:'season-1',start_year:2026,status:'open'}]:table==='sessions'?[{id:'session-1',season_id:'season-1',played_at:'2026-10-01',status:mocks.sessionStatus,configuration_snapshot:{buy_in:10,chips:[]}}]:[]
  const builder:any={select:vi.fn(()=>builder),eq:vi.fn(()=>builder),order:vi.fn(()=>builder),single:vi.fn(async()=>table==='profiles'?{data:{role:'organizer'},error:null}:{data:{season_id:'season-1',buy_in:10,chips:[],payout_table:{},points_by_rank:{}},error:null}),then:(resolve:any)=>Promise.resolve({data:data(),error:null}).then(resolve)}
  return builder
}

describe('Dashboard',()=>{
  beforeEach(()=>{
    mocks.realtimeHandlers.length=0
    mocks.sessionStatus='open'
    mocks.from.mockImplementation((table:string)=>queryResult(table))
    mocks.channel.mockImplementation(()=>({on(_event:string,filter:{table:string},callback:()=>void){mocks.realtimeHandlers.push({filter,callback});return this},subscribe(){return this},unsubscribe(){return Promise.resolve('ok')}}))
    mocks.rpc.mockResolvedValue({data:[],error:null})
  })

  it('loads organizer dashboard and responds to realtime',async()=>{
    render(<Dashboard session={{user:{id:'user-1'}} as never}/>)
    expect(await screen.findByRole('option',{name:/En cours/})).toBeTruthy()
    await waitFor(()=>expect(mocks.from).toHaveBeenCalledWith('seasons'))
    expect(mocks.channel).toHaveBeenCalledWith('championship-updates')
  })

  it('refreshes selected day status when the session changes over realtime',async()=>{
    render(<Dashboard session={{user:{id:'user-1'}} as never}/>)
    expect(await screen.findByRole('option',{name:/En cours/})).toBeTruthy()
    mocks.sessionStatus='finished'
    const sessionUpdate=mocks.realtimeHandlers.find((handler)=>handler.filter.table==='sessions')
    expect(sessionUpdate).toBeTruthy()
    await act(async()=>{sessionUpdate!.callback()})
    expect(await screen.findByRole('option',{name:/Terminée/})).toBeTruthy()
  })
})
