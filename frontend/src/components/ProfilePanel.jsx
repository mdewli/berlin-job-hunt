import { useEffect, useRef, useState } from 'react'
import JobCard from './JobCard.jsx'

// ── Tech skill dictionary used for extraction ────────────────────────────────
const TECH_SKILLS = [
  'python','javascript','typescript','react','node','nodejs','sql','java','go','golang','rust',
  'docker','kubernetes','k8s','aws','gcp','azure','terraform','git','linux','bash','shell',
  'django','fastapi','flask','express','nestjs','nextjs','next.js','nuxt','vue','angular',
  'postgresql','mysql','sqlite','mongodb','redis','elasticsearch','dynamodb','cassandra',
  'graphql','rest','grpc','websocket','kafka','rabbitmq','celery','airflow','dbt','spark',
  'hadoop','snowflake','bigquery','redshift','databricks','looker','tableau','powerbi','metabase',
  'machine learning','deep learning','nlp','computer vision','data science','mlops',
  'pytorch','tensorflow','keras','scikit-learn','sklearn','pandas','numpy','scipy','matplotlib',
  'flutter','swift','kotlin','react native','android','ios','objective-c',
  'c++','c#','ruby','rails','php','laravel','scala','r','perl','haskell','elixir','clojure',
  'html','css','sass','tailwind','bootstrap','webpack','vite','figma','sketch','zeplin',
  'jira','confluence','github','gitlab','bitbucket','jenkins','github actions','circleci','travis',
  'ansible','puppet','chef','vagrant','nginx','apache','prometheus','grafana','datadog','sentry',
  'supabase','firebase','vercel','netlify','heroku','railway','render',
  'agile','scrum','kanban','devops','devsecops','ci/cd','tdd','bdd',
  'product management','ux','ui','design','a/b testing','analytics','seo',
]

// ── Simple PDF text extraction (works for text-layer PDFs) ──────────────────
async function extractPdfText(file) {
  const buf   = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const raw   = new TextDecoder('latin1').decode(bytes)

  // Grab BT…ET blocks (PDF text objects)
  const blocks = raw.match(/BT[\s\S]*?ET/g) ?? []
  let text = ''
  for (const block of blocks) {
    // Parenthesised strings: (Hello World)
    const parens = block.match(/\(([^)\\]|\\.)*\)/g) ?? []
    for (const p of parens) {
      text += p.slice(1, -1).replace(/\\n/g, ' ').replace(/\\r/g, '') + ' '
    }
  }
  // strip non-ASCII artefacts
  return text.replace(/[^\x20-\x7E\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Pull skills from freeform text ──────────────────────────────────────────
function extractSkills(text) {
  const lower = text.toLowerCase()
  const found = new Set()
  for (const skill of TECH_SKILLS) {
    // word-boundary-ish check
    if (new RegExp(`(?<![a-z])${skill.replace('.', '\\.')}(?![a-z])`, 'i').test(lower)) {
      found.add(skill)
    }
  }
  return [...found].sort()
}

// ── Tabs ────────────────────────────────────────────────────────────────────
const TABS = ['saved', 'profile']

export default function ProfilePanel({
  open, onClose,
  user, savedJobs, savedIds, onSaveToggle, onQuickView,
  onFindBySkills, onLogout,
}) {
  const [tab,       setTab]       = useState('saved')
  const [rawText,   setRawText]   = useState('')
  const [skills,    setSkills]    = useState([])
  const [parsing,   setParsing]   = useState(false)
  const [parseMsg,  setParseMsg]  = useState('')
  const fileRef = useRef()

  // Persist skills across opens
  useEffect(() => {
    const saved = localStorage.getItem('bjh_skills')
    if (saved) setSkills(JSON.parse(saved))
  }, [])

  useEffect(() => {
    if (!open) return
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ── PDF / text file upload ────────────────────────────────────────────────
  const handleFile = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setParseMsg('')
    try {
      let text = ''
      if (file.type === 'application/pdf') {
        text = await extractPdfText(file)
        if (text.length < 50) {
          setParseMsg('Could not read this PDF (may be image-based). Paste your resume text below instead.')
          setParsing(false)
          return
        }
      } else {
        text = await file.text()
      }
      setRawText(text)
      const found = extractSkills(text)
      setSkills(found)
      localStorage.setItem('bjh_skills', JSON.stringify(found))
      setParseMsg(found.length > 0
        ? `Found ${found.length} skills in your resume.`
        : 'No tech skills detected automatically. Add them manually below.')
    } catch {
      setParseMsg('Error reading file. Try pasting your resume text instead.')
    }
    setParsing(false)
  }

  const handleExtractFromText = () => {
    const found = extractSkills(rawText)
    setSkills(found)
    localStorage.setItem('bjh_skills', JSON.stringify(found))
    setParseMsg(found.length > 0
      ? `Found ${found.length} skills.`
      : 'No recognised tech skills found. Try adding them manually.')
  }

  const removeSkill = skill => {
    const next = skills.filter(s => s !== skill)
    setSkills(next)
    localStorage.setItem('bjh_skills', JSON.stringify(next))
  }

  const addSkill = e => {
    if (e.key !== 'Enter') return
    const val = e.target.value.trim().toLowerCase()
    if (val && !skills.includes(val)) {
      const next = [...skills, val].sort()
      setSkills(next)
      localStorage.setItem('bjh_skills', JSON.stringify(next))
    }
    e.target.value = ''
  }

  const initials = user?.email?.split('@')[0]?.slice(0, 2)?.toUpperCase() ?? '?'
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-DE', { month: 'long', year: 'numeric' })
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(6,13,26,0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* Drawer */}
      <aside
        aria-label="Profile"
        className="fixed top-0 right-0 h-full w-full sm:w-[440px] z-50 flex flex-col"
        style={{
          background: 'rgba(8,16,32,0.92)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Tabs */}
          <div className="flex gap-1">
            {[
              { id: 'saved',   label: `♥ Saved${savedJobs.length > 0 ? ` (${savedJobs.length})` : ''}` },
              { id: 'profile', label: '👤 Profile' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: tab === t.id ? 'rgba(0,255,135,0.12)' : 'transparent',
                  border: tab === t.id ? '1px solid rgba(0,255,135,0.35)' : '1px solid transparent',
                  color: tab === t.id ? '#00FF87' : 'rgba(255,255,255,0.4)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none transition-colors p-1 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* ── Saved Jobs tab ──────────────────────────────────────── */}
        {tab === 'saved' && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {savedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center pb-20">
                <div className="text-5xl mb-4">🤍</div>
                <p className="font-semibold text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  No saved jobs yet
                </p>
                <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Click ♡ on any job card to save it here.
                </p>
              </div>
            ) : (
              savedJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSaved={savedIds.has(job.id)}
                  onSaveToggle={onSaveToggle}
                  onQuickView={j => { onQuickView?.(j); onClose() }}
                />
              ))
            )}
          </div>
        )}

        {/* ── Profile tab ─────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

            {/* Avatar + info */}
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,255,135,0.25), rgba(109,40,160,0.2))',
                  border: '1px solid rgba(0,255,135,0.3)',
                  color: '#00FF87',
                }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  {user?.email}
                </p>
                {memberSince && (
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Member since {memberSince}
                  </p>
                )}
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {savedJobs.length} saved {savedJobs.length === 1 ? 'job' : 'jobs'}
                </p>
              </div>
            </div>

            <div className="divider" />

            {/* ── Resume / Skills section ──────────────────────── */}
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#00FF87' }}>
                Resume & Skill Matching
              </p>

              {/* Upload button */}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                onChange={handleFile}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={parsing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all mb-3"
                style={{
                  border: '1px dashed rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.55)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,255,135,0.4)'
                  e.currentTarget.style.color = '#00FF87'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                }}
              >
                <span>{parsing ? '⏳' : '📄'}</span>
                <span>{parsing ? 'Reading resume…' : 'Upload resume (PDF or .txt)'}</span>
              </button>

              {parseMsg && (
                <p className="text-xs mb-3 px-1" style={{ color: parseMsg.startsWith('Found') ? '#34d399' : '#fb923c' }}>
                  {parseMsg}
                </p>
              )}

              {/* OR paste text */}
              <p className="text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Or paste resume / skill list:
              </p>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="Paste your resume text, LinkedIn summary, or just list skills like: Python, React, SQL, Docker..."
                rows={4}
                className="glass-input w-full text-xs rounded-xl resize-none mb-2"
                style={{ lineHeight: 1.6 }}
              />
              <button
                onClick={handleExtractFromText}
                disabled={!rawText.trim()}
                className="btn-dim w-full text-xs py-2 mb-4 disabled:opacity-30"
              >
                Extract skills from text
              </button>

              {/* Extracted skill chips */}
              {skills.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Detected skills — click to remove:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map(s => (
                      <button
                        key={s}
                        onClick={() => removeSkill(s)}
                        className="chip transition-all group"
                        style={{
                          background: 'rgba(0,255,135,0.08)',
                          color: '#00FF87',
                          borderColor: 'rgba(0,255,135,0.25)',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(244,63,94,0.12)'
                          e.currentTarget.style.color = '#fb7185'
                          e.currentTarget.style.borderColor = 'rgba(244,63,94,0.3)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(0,255,135,0.08)'
                          e.currentTarget.style.color = '#00FF87'
                          e.currentTarget.style.borderColor = 'rgba(0,255,135,0.25)'
                        }}
                        title="Click to remove"
                      >
                        {s} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add skill manually */}
              <input
                type="text"
                placeholder="Add a skill manually (press Enter)"
                onKeyDown={addSkill}
                className="glass-input w-full text-xs rounded-xl mb-4"
              />

              {/* Find matching jobs */}
              {skills.length > 0 && (
                <button
                  onClick={() => {
                    onFindBySkills?.(skills)
                    onClose()
                  }}
                  className="btn-gold w-full justify-center py-2.5"
                  style={{ borderRadius: '0.75rem', fontSize: '0.8125rem' }}
                >
                  🔍 Find jobs matching my skills
                </button>
              )}
            </div>

            <div className="divider" />

            {/* Sign out */}
            <button
              onClick={() => { onLogout?.(); onClose() }}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.20)',
                color: '#fb7185',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(244,63,94,0.16)'
                e.currentTarget.style.borderColor = 'rgba(244,63,94,0.40)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(244,63,94,0.08)'
                e.currentTarget.style.borderColor = 'rgba(244,63,94,0.20)'
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
