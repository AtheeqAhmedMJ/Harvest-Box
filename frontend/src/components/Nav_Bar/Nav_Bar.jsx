import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import "./Nav_Bar.css";
import Icon from "../Icon/Icon";

const NAV = [
  {
    path: "/", end: true, label: "Dashboard",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    path: "/field-setup", label: "Field Setup",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  },
  {
    path: "/analytics", label: "Analytics",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  },
  {
    path: "/user", label: "Profile",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
];

export default function Nav_Bar() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("sidebar-expanded", expanded);
  }, [expanded]);

  return (
    <nav
      className={`sidebar${expanded ? " expanded" : ""}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <ul className="sidebar-nav">
        {/* Logo */}
        <div className="nav-item logo-item">
          <div className="nav-icon-wrap"><Icon size={28} /></div>
          <span className="nav-label" style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-dark)" }}>
            Harvest Box
          </span>
        </div>

        {NAV.map(({ path, label, icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <div className="nav-icon-wrap">{icon}</div>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}

        <div className="nav-spacer" />
      </ul>
    </nav>
  );
}
