export function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const result: Record<string, unknown>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const row: Record<string, unknown> = {}
    for (let j = 0; j < headers.length; j++) {
      const value = values[j] ?? ''
      row[headers[j]] = tryParseNumber(value)
    }
    result.push(row)
  }

  return result
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current.trim())
  return result
}

function tryParseNumber(value: string): string | number {
  if (value === '') return value
  const num = Number(value)
  return isNaN(num) ? value : num
}

export function parseExcel(buffer: ArrayBuffer): Record<string, unknown>[] {
  // Placeholder for XLSX parsing.
  // In production, integrate a library such as xlsx (SheetJS):
  //   const workbook = XLSX.read(buffer, { type: 'array' })
  //   const sheet = workbook.Sheets[workbook.SheetNames[0]]
  //   return XLSX.utils.sheet_to_json(sheet)
  //
  // Falls back to treating the buffer as UTF-8 text and parsing as CSV.
  const decoder = new TextDecoder('utf-8')
  const text = decoder.decode(buffer)
  return autoParse(text)
}

export function autoParse(text: string): Record<string, unknown>[] {
  // Try CSV first (comma-separated)
  const csvResult = parseCSV(text)
  if (csvResult.length > 0 && Object.keys(csvResult[0]).length >= 2) {
    return csvResult
  }

  // Fall back to tab-separated
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const tabHeaders = lines[0].split('\t').map((h) => h.trim())
  if (tabHeaders.length < 2) return []

  const result: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = line.split('\t')
    const row: Record<string, unknown> = {}
    for (let j = 0; j < tabHeaders.length; j++) {
      const value = values[j] ?? ''
      row[tabHeaders[j]] = tryParseNumber(value)
    }
    result.push(row)
  }

  return result
}
