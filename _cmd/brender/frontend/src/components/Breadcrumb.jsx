import React from 'react'

export default function Breadcrumb({ items }) {
  return (
    <div className="breadcrumb">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="breadcrumb-sep">›</span>}
          {item.onClick
            ? <button className="breadcrumb-link" onClick={item.onClick}>{item.label}</button>
            : <span>{item.label}</span>
          }
        </React.Fragment>
      ))}
    </div>
  )
}
