'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface CSVRow { roll_no: string; name: string; gender: string }

// Parse CSV text manually — no PapaParse dependency issues
function parseCSVText(text: string): CSVRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Normalize headers: trim + lowercase + replace spaces/underscores
  const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s_]+/g, '_'))

  // Find column indices flexibly
  const rollIdx = rawHeaders.findIndex(h => h.includes('roll'))
  const nameIdx = rawHeaders.findIndex(h => h.includes('name'))
  const genderIdx = rawHeaders.findIndex(h => h.includes('gender') || h.includes('sex'))

  if (rollIdx === -1 || nameIdx === -1) return []

  const rows: CSVRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const roll = cols[rollIdx]?.trim()
    const name = cols[nameIdx]?.trim()
    if (!roll || !name) continue
    const gender = genderIdx >= 0 ? (cols[genderIdx]?.trim().toUpperCase() || 'O') : 'O'
    rows.push({
      roll_no: roll.toUpperCase(),
      name,
      gender: ['M', 'F', 'O'].includes(gender) ? gender : 'O',
    })
  }
  return rows
}

export default function ImportPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CSVRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = (file: File) => {
    // Immediately show feedback
    setParsing(true)
    setFileName(file.name)
    setRows([])
    setErrors([])
    setImported(0)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = parseCSVText(text)
        if (parsed.length === 0) {
          setErrors(['No valid rows found. Check that your CSV has Roll No, Name, Gender columns.'])
        }
        setRows(parsed)
      } catch (err) {
        setErrors([`Parse error: ${err}`])
      } finally {
        setParsing(false)
      }
    }
    reader.onerror = () => {
      setErrors(['Failed to read file.'])
      setParsing(false)
    }
    reader.readAsText(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (!files || files.length === 0) {
      toast.error('No file detected')
      return
    }
    const file = files[0]
    // Accept any file — let the parser decide if it's valid CSV
    processFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleImport = async () => {
    if (!rows.length) return
    setImporting(true)
    setErrors([])
    let count = 0
    const errs: string[] = []
    const BATCH = 50

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const toInsert = batch.map(r => ({
        roll_no: r.roll_no,
        name: r.name,
        gender: r.gender as 'M' | 'F' | 'O',
        registered: false,
        current_status: 'unregistered' as const,
      }))
      const { error } = await supabase
        .from('participants')
        .upsert(toInsert, { onConflict: 'roll_no', ignoreDuplicates: false })
      if (error) errs.push(error.message)
      else count += batch.length
      setImported(prev => prev + batch.length)
    }

    if (errs.length) setErrors(errs)
    if (count > 0) toast.success(`✅ ${count} participants imported!`)
    setImporting(false)
  }

  const clearFile = () => {
    setRows([])
    setFileName(null)
    setErrors([])
    setImported(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const importProgress = rows.length > 0 ? Math.round((imported / rows.length) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Import Participants</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Drop a CSV file — preview appears instantly
        </p>
      </div>

      {/* Format hint */}
      <div className="card" style={{ background: 'var(--pink-subtle)', border: '1px solid rgba(255,45,120,0.2)', padding: '14px 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pink)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Required CSV Format
        </div>
        <pre style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
{`Roll No,Name,Gender
CS24B001,Rahul Kumar,M
CS24B002,Anjali Sharma,F`}
        </pre>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Column names are detected automatically — order doesn't matter. Gender: M/F/O (defaults to O if missing).
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        id="csv-drop-zone"
        style={{
          border: `2px dashed ${isDragging ? 'var(--pink)' : parsing ? 'var(--teal)' : rows.length ? 'var(--teal)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '40px 24px',
          textAlign: 'center',
          background: isDragging
            ? 'var(--pink-subtle)'
            : parsing ? 'rgba(0,212,170,0.05)'
            : rows.length ? 'rgba(0,212,170,0.05)'
            : 'var(--bg-secondary)',
          transition: 'all 0.2s',
          cursor: parsing ? 'wait' : 'pointer',
          userSelect: 'none',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />

        {parsing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
            <div style={{ fontWeight: 700, color: 'var(--teal)' }}>Reading {fileName}…</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Parsing CSV rows</div>
          </div>
        ) : rows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 36 }}>✅</div>
            <div style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 15 }}>{fileName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {rows.length.toLocaleString()} valid rows ready
            </div>
            <button
              onClick={e => { e.stopPropagation(); clearFile() }}
              style={{
                marginTop: 4, background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '4px 14px',
                color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              }}
            >
              × Choose a different file
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 15 }}>
              Drop CSV here or click to browse
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Any .csv file — no size limit
            </div>
          </>
        )}
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {rows.length.toLocaleString()} rows ready to import
              </span>
              {rows.length > 20 && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
                  (showing first 20)
                </span>
              )}
            </div>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing}
              id="import-btn"
            >
              {importing
                ? `Importing… ${imported}/${rows.length}`
                : `⬆ Import ${rows.length.toLocaleString()} Participants`}
            </button>
          </div>

          {/* Progress bar */}
          {importing && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${importProgress}%`,
                  background: 'linear-gradient(90deg, var(--pink), var(--teal))',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {importProgress}% — {imported} of {rows.length} saved
              </div>
            </div>
          )}

          {/* Table */}
          <div className="table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Roll No</th>
                  <th>Name</th>
                  <th>Gender</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.roll_no}</td>
                    <td>{r.name}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                        background: r.gender === 'M' ? 'rgba(99,179,237,0.15)' : r.gender === 'F' ? 'rgba(255,45,120,0.12)' : 'rgba(152,152,184,0.15)',
                        color: r.gender === 'M' ? '#63b3ed' : r.gender === 'F' ? 'var(--pink)' : 'var(--text-muted)',
                      }}>
                        {r.gender}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length > 20 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '12px 0', fontStyle: 'italic' }}>
                      ···  and {(rows.length - 20).toLocaleString()} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="card" style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.3)', padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 6, fontSize: 13 }}>
            ⚠️ Issues found:
          </div>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>• {e}</div>
          ))}
        </div>
      )}
    </div>
  )
}
