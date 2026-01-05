type Task = { id:number; status:string; type:string; result_urls?:string[]; video_url?:string; last_frame_url?:string }

export default function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
      {tasks.map(t=> (
        <div key={t.id} style={{ background:'#1a1a1a', padding:12, border:'1px solid #333' }}>
          <div>#{t.id} · {t.type} · {t.status}</div>
          {t.type==='image' && t.result_urls && (
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              {t.result_urls.map((u,i)=> (<img key={i} src={u} style={{ width:120, height:120, objectFit:'cover' }} />))}
            </div>
          )}
          {t.type==='video' && t.video_url && (
            <video src={t.video_url} controls style={{ width:'100%', marginTop:8 }} />
          )}
        </div>
      ))}
    </div>
  )
}
