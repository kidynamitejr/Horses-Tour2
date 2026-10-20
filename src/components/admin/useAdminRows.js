import { useCallback, useEffect, useState } from "react"
import { adminData, deleteAdminRow, saveAdminRow } from "../../data/liveScoring"

// Loads one of the sheet's tabs fresh for an Admin editor, and saves rows.
export function useAdminRows(sheet) {
  const [data, setData] = useState(null)
  const [error, setError] = useState("")

  const reload = useCallback(
    () => adminData(sheet)
      .then((d) => {
        setData(d)
        setError("")
      })
      .catch((err) => setError(/unknown action/i.test(err.message)
        ? "Update the Google Apps Script to use this editor."
        : err.message)),
    [sheet],
  )

  useEffect(() => {
    reload()
  }, [reload])

  async function save(key, fields) {
    const result = await saveAdminRow(sheet, key, fields)
    await reload()
    return result
  }

  async function remove(key) {
    await deleteAdminRow(sheet, key)
    await reload()
  }

  return {
    rows: data?.rows || [],
    header: data?.header || [],
    keyField: data?.key || "",
    loaded: Boolean(data),
    error,
    reload,
    save,
    remove,
  }
}

// "10/25/26" -> Date, for sorting.
export function sheetDate(text) {
  const parts = String(text || "").split("/").map((p) => p.trim())
  if (parts.length !== 3) return null
  const year = parts[2].length === 2 ? 2000 + Number(parts[2]) : Number(parts[2])
  const date = new Date(year, Number(parts[0]) - 1, Number(parts[1]))
  return isNaN(date) ? null : date
}

// Fields for one row, in order; columns not in `fields` are shown as
// plain text fields so nothing on the sheet is hidden.
export function rowFields(header, fields, skip = []) {
  const known = new Set(fields.map((f) => f.name))
  const extra = header
    .filter((h) => !known.has(h) && !skip.includes(h))
    .map((h) => ({ name: h }))
  return [...fields.filter((f) => header.includes(f.name)), ...extra]
}
