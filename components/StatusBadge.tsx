type Props = { status: string | null }

export default function StatusBadge({ status }: Props) {
  if (!status) return <span className="text-xs" style={{ color: '#bdb29f' }}>—</span>

  const key = status.toLowerCase()

  let bg = '#E3EDEC'
  let color = '#004455'

  if (key.includes('converted') || key.includes('scheduled')) {
    bg = '#E3EDEC'; color = '#004455'
  } else if (key.includes('matched') || key.includes('progress')) {
    bg = '#EBE4F0'; color = '#615171'
  } else if (key.includes('unreachable') || key.includes('cancel')) {
    bg = '#FEF3C7'; color = '#92400E'
  } else if (key.includes('closed') || key.includes('inactive')) {
    bg = '#F5F0E8'; color = '#8E4F17'
  } else if (key.includes('new') || key.includes('open')) {
    bg = '#DBEAFE'; color = '#1E40AF'
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: bg, color }}>
      {status}
    </span>
  )
}
