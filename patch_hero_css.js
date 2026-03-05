const fs = require('fs');
const f = 'C:/Users/User/AI Project/FORWARD/VERSION/Forward/css/layout.css';
let c = fs.readFileSync(f, 'utf8');

// 1. Wordmark
c = c.replace(
"      font-style: normal;\n      font-size: clamp(28px, 5vw, 44px);\n      text-transform: lowercase;\n      letter-spacing: 4px;\n      color: var(--warm);\n      opacity: 0.7;\n      margin-bottom: 12px;",
"      font-style: italic;\n      font-size: clamp(22px, 4.5vw, 36px);\n      text-transform: uppercase;\n      letter-spacing: 8px;\n      color: var(--warm);\n      opacity: 0.82;\n      margin-bottom: 10px;"
);

// 2. Orb wrap size
c = c.replace(
"      width: 130px;\n      height: 130px;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      cursor: pointer;\n      margin-bottom: 7vh;\n      opacity: 0;",
"      width: 220px;\n      height: 220px;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      cursor: pointer;\n      margin-bottom: 0;\n      flex-shrink: 0;\n      opacity: 0;"
);

// 3. Ring - add box shadow
c = c.replace(
"      border: 1.5px solid rgba(196, 149, 106, 0.3);\n      animation: ringBreathe 4s ease-in-out infinite;\n      transition: border-color 0.3s;\n    }",
"      border: 1px solid rgba(196, 149, 106, 0.28);\n      box-shadow: 0 0 22px rgba(196, 149, 106, 0.1), inset 0 0 22px rgba(196, 149, 106, 0.05);\n      animation: ringBreathe 4s ease-in-out infinite;\n      transition: border-color 0.3s;\n    }"
);

// 4. Ring 2 inset
c = c.replace(
"      inset: 10px;\n      border-radius: 50%;\n      border: 1px solid rgba(196, 149, 106, 0.12);",
"      inset: 36px;\n      border-radius: 50%;\n      border: 1px solid rgba(196, 149, 106, 0.18);"
);

// 5. Halo — stronger
c = c.replace(
"      inset: -14px;\n      border-radius: 50%;\n      background: radial-gradient(circle, rgba(196, 149, 106, 0.07), transparent 70%);",
"      inset: -36px;\n      border-radius: 50%;\n      background: radial-gradient(circle, rgba(196, 149, 106, 0.2) 0%, rgba(196, 149, 106, 0.08) 40%, transparent 68%);"
);

// 6. Inner orb — bigger, brighter
c = c.replace(
"      width: 72px;\n      height: 72px;\n      border-radius: 50%;\n      background: radial-gradient(circle at 40% 38%, rgba(196, 149, 106, 0.32), rgba(196, 149, 106, 0.06) 70%);\n      box-shadow:\n        0 0 28px rgba(196, 149, 106, 0.14),\n        inset 0 1px 1px rgba(255, 255, 255, 0.06);",
"      width: 110px;\n      height: 110px;\n      border-radius: 50%;\n      background: radial-gradient(circle at 40% 36%,\n        rgba(240, 185, 115, 0.92) 0%,\n        rgba(210, 158, 90, 0.78) 22%,\n        rgba(170, 115, 50, 0.5) 48%,\n        rgba(120, 75, 20, 0.18) 70%,\n        transparent 86%\n      );\n      box-shadow:\n        0 0 55px rgba(196, 149, 106, 0.48),\n        0 0 110px rgba(196, 149, 106, 0.2),\n        inset 0 2px 4px rgba(255, 220, 150, 0.22);"
);

// 7. Active orb inner
c = c.replace(
"      background: radial-gradient(circle at 40% 38%, rgba(196, 149, 106, 0.52), rgba(196, 149, 106, 0.12) 70%);\n      box-shadow: 0 0 44px rgba(196, 149, 106, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.08);\n      transform: scale(0.93);",
"      background: radial-gradient(circle at 40% 36%,\n        rgba(255, 200, 130, 0.95) 0%,\n        rgba(220, 165, 95, 0.82) 22%,\n        rgba(180, 125, 55, 0.55) 48%,\n        rgba(130, 85, 25, 0.22) 70%,\n        transparent 86%\n      );\n      box-shadow: 0 0 75px rgba(196, 149, 106, 0.55), 0 0 130px rgba(196, 149, 106, 0.25), inset 0 2px 4px rgba(255, 230, 160, 0.3);\n      transform: scale(0.95);"
);

// 8. Active halo
c = c.replace(
"      background: radial-gradient(circle, rgba(196, 149, 106, 0.18), transparent 70%);\n    }\n\n    .momentum-bar {",
"      background: radial-gradient(circle, rgba(196, 149, 106, 0.32) 0%, rgba(196, 149, 106, 0.12) 40%, transparent 68%);\n    }\n\n    .momentum-bar {"
);

// 9. Momentum wrap margin
c = c.replace(
"      margin: 16px auto 7vh;\n      text-align: center;\n    }\n\n    .momentum-bar {",
"      margin: 14px auto 5vh;\n      text-align: center;\n    }\n\n    .momentum-bar {"
);

// 10. Capture hint margin-top
c = c.replace(
"      animation: fadeUp 0.8s ease 0.85s forwards;\n      margin-bottom: 0;\n    }\n\n    /* Swipe direction hints",
"      animation: fadeUp 0.8s ease 0.85s forwards;\n      margin-top: 22px;\n      margin-bottom: 0;\n    }\n\n    /* Swipe direction hints"
);

// 11. Insert hero-bg-glow and hero-horizon rules before swipe hints
const insertBefore = "    /* Swipe direction hints \u2014 fade in late */";
const newRules = `    /* Background warm glow behind orb */
    .hero-bg-glow {
      position: absolute;
      top: 12%;
      left: 50%;
      transform: translateX(-50%);
      width: 380px;
      height: 380px;
      border-radius: 50%;
      background: radial-gradient(circle,
        rgba(150, 70, 10, 0.38) 0%,
        rgba(120, 55, 8, 0.22) 35%,
        rgba(80, 35, 5, 0.1) 60%,
        transparent 75%
      );
      filter: blur(45px);
      pointer-events: none;
      z-index: 0;
      flex-shrink: 0;
    }

    /* Horizon divider \u2014 warm shimmer line */
    .hero-horizon {
      width: 100%;
      height: 1px;
      background: linear-gradient(90deg,
        transparent 0%,
        rgba(196, 149, 106, 0.45) 18%,
        rgba(210, 165, 110, 0.7) 50%,
        rgba(196, 149, 106, 0.45) 82%,
        transparent 100%
      );
      box-shadow: 0 0 12px rgba(196, 149, 106, 0.22);
      flex-shrink: 0;
      margin-top: 18px;
    }

`;

c = c.replace(insertBefore, newRules + insertBefore);

fs.writeFileSync(f, c, 'utf8');
console.log('CSS patch OK');
