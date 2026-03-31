import React from "react";

const style = `
  @keyframes breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }

  .logo-wrap {
    border-radius: 50%;
    background: transparent;

    /* clean outer shadow only */
    box-shadow: 0 8px 30px rgba(0,0,0,0.01);

    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-svg {
    animation: breathe 6s ease-in-out infinite;
  }
    .icon-svg {
  filter: drop-shadow(0 4px 10px rgba(0,0,0,0.08));
}
`;

export default function Icon({ size = 96 }) {
  return (
    <>
      <style>{style}</style>

      <div
        className="logo-wrap"
        style={{ width: size, height: size }}
      >
        <svg
          className="icon-svg"
          width={size * 0.98}
          height={size * 0.98}
          viewBox="0 0 168 168"
          fill="none"
        >
          {/* WiFi arcs */}
          <path d="M24 66C44 34 124 34 144 66" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" opacity="0.35"/>
          <path d="M40 78C56 50 112 50 128 78" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" opacity="0.55"/>
          <path d="M56 90C68 68 100 68 112 90" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" opacity="0.75"/>
          <path d="M72 102C78 86 90 86 96 102" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round"/>

          {/* Leaf */}
          <g transform="translate(0 14) rotate(-180 84 120)">
            <path
              d="
                M84 158
                C74 148, 66 138, 64 122
                C63 110, 74 100, 84 104
                C94 100, 105 110, 104 122
                C102 138, 94 148, 84 158
                Z
              "
              fill="#4ade80"
            />

            {/* veins */}
            <path d="M84 106 L84 148" stroke="#166534" strokeWidth="1.4" strokeLinecap="round" opacity="0.7"/>
            <path d="M84 122 L72 132" stroke="#166534" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
            <path d="M84 122 L96 132" stroke="#166534" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
          </g>
        </svg>
      </div>
    </>
  );
}