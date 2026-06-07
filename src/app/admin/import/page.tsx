'use client'
import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface CSVRow { roll_no: string; name: string; gender: string }

export default function ImportPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CSVRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const parseFile = (file: File) => {
    setParsing(true)
    setFileName(file.name)
    setRows([])
    setErrors([])

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      // fix: use regex to replace ALL spaces/underscores variants in headers
      transformHeader: (h) => h.trim().toLowerCase().replace(/[\s]+/g, '_'),
      complete: (results) => {
        const valid = results.data.filter(r => r.roll_no?.trim() && r.name?.trim())
        setRows(valid)
        if (results.errors.length) {
          setErrors(results.errors.slice(0, 5).map(e => e.message))
        }
        setParsing(false)
      },
      error: (err) => {
        setErrors([err.message])
        setParsing(false)
      }
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) parseFile(file)
    else toast.error('Please upload a .csv file')
  }, [])

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
        roll_no: r.roll_no.trim().toUpperCase(),
        name: r.name.trim(),
        gender: ['M', 'F', 'O'].includes((r.gender || '').trim().toUpperCase())
          ? (r.gender.trim().toUpperCase() as 'M' | 'F' | 'O')
          : 'O' as const,
        registered: false,
        current_status: 'unregistered' as const,
      }))
      const { error } = await supabase.from('participants').upsert(toInsert, { onConflict: 'roll_no', ignoreDuplicates: false })
      if (error) errs.push(error.message)
      else count += batch.length
      setImported(count)
    }

    if (errs.length) setErrors(errs)
    if (count > 0) toast.success(`✅ Imported ${count} participants successfully!`)
    setImporting(false)
  }

  const clearFile = () => {
    setRows([])
    setFileName(null)
    setErrors([])
    setImported(0)
    const input = document.getElementById('csv-file-input') as HTMLInputElement
    if (input) input.value = ''
  }

  const importProgress = rows.length ? Math.round((imported / rows.length) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Import Participants</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Upload a CSV file — preview shown instantly before saving</p>
      </div>

      {/* Format hint */}
      <div className="card" style={{ background: 'var(--pink-subtle)', border: '1px solid rgba(255,45,120,0.2)', padding: '14px 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pink)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Required CSV Format
        </div>
        <pre style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
{`Roll No,Name,Gender
CS24B001,Rahul Kumar,M
CS24B002,Anjali Sharma,F
CS24B003,Sam Thomas,O`}
        </pre>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Gender accepts: M, F, O — anything else defaults to O. Column names are case-insensitive.
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !parsing && document.getElementById('csv-file-input')?.click()}
        id="csv-drop-zone"
        style={{
          border: `2px dashed ${isDragging ? 'var(--pink)' : parsing ? 'var(--teal)' : rows.length ? 'var(--teal)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '36px 24px',
          textAlign: 'center',
          background: isDragging ? 'var(--pink-subtle)' : parsing ? 'rgba(0,212,170,0.04)' : rows.length ? 'rgba(0,212,170,0.04)' : 'var(--bg-secondary)',
          transition: 'all 0.2s',
          cursor: parsing ? 'wait' : 'pointer',
          position: 'relative',
        }}
      >
        <input
          id="csv-file-input"
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }}
        />

        {parsing ? (
          /* ── Parsing state ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
            <div style={{ fontWeight: 700, color: 'var(--teal)' }}>Reading {fileName}...</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Parsing CSV — this takes less than a second</div>
          </div>
        ) : rows.length > 0 ? (
          /* ── File loaded state ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 36 }}>✅</div>
            <div style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 15 }}>{fileName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {rows.length.toLocaleString()} valid rows detected
            </div>
            <button
              onClick={e => { e.stopPropagation(); clearFile() }}
              style={{
                marginTop: 4, background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '4px 12px',
                color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              }}
            >
              × Clear & choose different file
            </button>
          </div>
        ) : (
          /* ── Default state ── */
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15 }}>Drop CSV here or click to browse</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Supports .csv files up to any size</div>
          </>
        )}
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div>
          {/* Header row with count + import button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{rows.length.toLocaleString()} rows ready to import</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
                (showing first {Math.min(rows.length, 20)})
              </span>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing}
              id="import-btn"
            >
              {importing
                ? `Importing... ${imported}/${rows.length}`
                : `⬆ Import ${rows.length.toLocaleString()} Participants`}
            </button>
          </div>

          {/* Progress bar (only during import) */}
          {importing && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${importProgress}%`,
                  background: 'linear-gradient(90deg, var(--pink), var(--teal))',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {importProgress}% complete — {imported} of {rows.length} saved
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="table-container" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
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
                        fontSize: 11, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 100,
                        background: r.gender?.toUpperCase() === 'M' ? 'rgba(99,179,237,0.15)' : r.gender?.toUpperCase() === 'F' ? 'rgba(255,45,120,0.12)' : 'rgba(152,152,184,0.15)',
                        color: r.gender?.toUpperCase() === 'M' ? '#63b3ed' : r.gender?.toUpperCase() === 'F' ? 'var(--pink)' : 'var(--text-muted)',
                      }}>
                        {r.gender?.toUpperCase() || 'O'}
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
            ⚠️ Issues detected:
          </div>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>• {e}</div>
          ))}
        </div>
      )}
    </div>
  )
}
