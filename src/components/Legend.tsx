const items = [
  ['university', 'University requirements'],
  ['college', 'College requirements'],
  ['math-science', 'Mathematics & science'],
  ['cybersecurity', 'Cybersecurity core'],
  ['project-training', 'Projects & training'],
  ['elective', 'Specialization elective'],
] as const

export function Legend() {
  return (
    <footer className="legend-bar">
      <div className="legend-items" aria-label="Course category legend">
        {items.map(([category, label]) => (
          <span key={category}>
            <i className={`legend-swatch category-${category}`} />
            {label}
          </span>
        ))}
      </div>
      <span aria-hidden="true" className="legend-divider" />
      <div className="legend-relationships" aria-label="Relationship color legend">
        <span className="legend-relationship legend-relationship--upstream">
          <ArrowRight aria-hidden="true" size={19} strokeWidth={2.6} />
          Prerequisite path
        </span>
        <span className="legend-relationship legend-relationship--downstream">
          <ArrowRight aria-hidden="true" size={19} strokeWidth={2.6} />
          Unlock path
        </span>
      </div>
    </footer>
  )
}
import { ArrowRight } from 'lucide-react'
