const launchCanvas = document.getElementById('launch-scene');
const launchCtx = launchCanvas.getContext('2d');
const launchGrainCanvas = document.getElementById('launch-grain');
const launchGCtx = launchGrainCanvas.getContext('2d');
const launchWordmark = document.getElementById('launch-wordmark');
const launchTagline = document.getElementById('launch-tagline');
const launchScreen = document.getElementById('launch-screen');

let launchW, launchH, launchDpr;
let launchRaf;

function resizeLaunch() {
    launchDpr = Math.min(window.devicePixelRatio || 1, 2);
    launchW = window.innerWidth; launchH = window.innerHeight;
    launchCanvas.width = launchW * launchDpr; launchCanvas.height = launchH * launchDpr;
    launchCtx.setTransform(launchDpr, 0, 0, launchDpr, 0, 0);
    launchGrainCanvas.width = launchW * launchDpr; launchGrainCanvas.height = launchH * launchDpr;
    launchGCtx.setTransform(launchDpr, 0, 0, launchDpr, 0, 0);
    drawLaunchGrain();
}

function drawLaunchGrain() {
    const img = launchGCtx.createImageData(launchW, launchH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    launchGCtx.putImageData(img, 0, 0);
}

resizeLaunch();
window.addEventListener('resize', resizeLaunch);

// ── PARTICLES ──
class LaunchParticle {
    constructor() { this.active = false; }
    spawn(x, y, vx, vy, life, size, type) {
        Object.assign(this, { x, y, vx, vy, life, maxLife: life, size, active: true, type });
    }
    update(dt) {
        if (!this.active) return;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.type === 'rise') {
            this.vy -= 0.008 * dt;
        } else {
            this.vy += 0.0005 * dt;
            this.vx *= 0.9985;
        }
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw() {
        if (!this.active) return;
        const frac = this.life / this.maxLife;
        const alpha = this.type === 'rise'
            ? Math.pow(frac, 0.7) * 0.75
            : Math.pow(frac, 0.5) * 0.28;
        launchCtx.beginPath();
        launchCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        launchCtx.fillStyle = this.type === 'dust'
            ? `rgba(175,140,90,${alpha})`
            : `rgba(220,180,120,${alpha})`;
        launchCtx.fill();
    }
}

const LAUNCH_POOL = 240;
const launchParticles = Array.from({ length: LAUNCH_POOL }, () => new LaunchParticle());
let launchPIdx = 0;

function emitLaunchRise(x, y, spread, speed, life, size) {
    const p = launchParticles[launchPIdx++ % LAUNCH_POOL];
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const s = speed * (0.5 + Math.random() * 0.5);
    p.spawn(x + (Math.random() - 0.5) * 16, y,
        Math.cos(angle) * s, Math.sin(angle) * s,
        life * (0.6 + Math.random() * 0.4),
        size * (0.4 + Math.random() * 0.6), 'rise');
}

function emitLaunchDust(horizonBase, cx, intensity) {
    const p = launchParticles[launchPIdx++ % LAUNCH_POOL];
    const xOff = (Math.random() - 0.5) * launchW * 0.85;
    const yOff = (Math.random() - 0.5) * 14;
    const dir = Math.random() > 0.5 ? 1 : -1;
    p.spawn(
        cx + xOff, horizonBase + yOff,
        dir * (0.018 + Math.random() * 0.055) * intensity,
        (Math.random() - 0.3) * 0.008,
        3500 + Math.random() * 3000,
        0.3 + Math.random() * 1.1,
        'dust'
    );
}

function launchHY(x, t, baseY, amp, phase) {
    const p = phase || 0;
    return baseY
        + Math.sin(x * 0.004 + t * 0.0003 + p) * amp
        + Math.sin(x * 0.007 - t * 0.0005 + p) * amp * 0.5
        + Math.sin(x * 0.012 + t * 0.0002 + p) * amp * 0.25;
}

const launchEaseOutCubic = t => 1 - Math.pow(1 - t, 3);
const launchEaseInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const launchEaseOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const launchClamp01 = t => Math.max(0, Math.min(1, t));

const launchStartTime = performance.now();
let launchLastTime = launchStartTime;
let launchWordmarkState = 'hidden';
let launchEnded = false;

function setLaunchWordmark(state) {
    if (state === launchWordmarkState) return;
    launchWordmarkState = state;
    launchWordmark.classList.remove('visible', 'state-alive');
    launchTagline.classList.remove('visible', 'state-alive');
    if (state === 'default') {
        launchWordmark.classList.add('visible');
        launchTagline.classList.add('visible');
    } else if (state === 'alive') {
        launchWordmark.classList.add('visible', 'state-alive');
        launchTagline.classList.add('visible', 'state-alive');
    }
}

function renderLaunch(now) {
    if (launchEnded) return;
    const dt = Math.min(now - launchLastTime, 50);
    launchLastTime = now;
    const t = now - launchStartTime;

    launchCtx.fillStyle = 'rgb(14,11,9)';
    launchCtx.fillRect(0, 0, launchW, launchH);

    const cx = launchW / 2;
    const horizonBase = launchH * 0.50;
    const orbRadius = Math.min(launchW, launchH) * 0.042;
    const maxRise = launchH * 0.26;

    const horizonAlpha = launchEaseOutCubic(launchClamp01((t - 600) / 900));
    const orbEmerge = launchEaseOutCubic(launchClamp01((t - 1000) / 1300));
    const riseProgress = launchEaseInOutSine(launchClamp01((t - 2000) / 1800));
    const glowStrength = launchEaseOutExpo(launchClamp01((t - 1200) / 2800));

    const orbY = horizonBase - orbRadius * orbEmerge - maxRise * riseProgress;
    const orbScale = orbEmerge * (0.88 + riseProgress * 0.12);
    const r = orbRadius * orbScale;

    if (t > 2600 && launchWordmarkState === 'hidden') setLaunchWordmark('default');
    if (t > 3400 && launchWordmarkState === 'default') setLaunchWordmark('alive');

    // Fade out animation entirely after 5.5s
    if (t > 5500 && !launchEnded) {
        launchScreen.style.opacity = '0';
        launchScreen.style.pointerEvents = 'none';
        setTimeout(() => {
            launchEnded = true;
            cancelAnimationFrame(launchRaf);
            launchScreen.remove();
            window.removeEventListener('resize', resizeLaunch);
        }, 1500); // Wait for CSS opacity transition
    }

    // ── ATMOSPHERIC HAZE ──
    if (glowStrength > 0.01 && orbScale > 0.01) {
        const hz = launchCtx.createRadialGradient(cx, orbY, 0, cx, orbY, Math.max(launchW, launchH) * 1.1);
        hz.addColorStop(0, `rgba(110,78,35,${0.09 * glowStrength * orbScale})`);
        hz.addColorStop(0.3, `rgba(80,55,22,${0.05 * glowStrength * orbScale})`);
        hz.addColorStop(1, 'rgba(14,11,9,0)');
        launchCtx.fillStyle = hz;
        launchCtx.fillRect(0, 0, launchW, launchH);
    }

    // ── WARM AMBIENT GLOW ──
    if (glowStrength > 0.005 && orbScale > 0.01) {
        const glowR = Math.max(launchW, launchH) * (0.25 + glowStrength * 0.5);
        const ag = launchCtx.createRadialGradient(cx, orbY, 0, cx, orbY, glowR);
        ag.addColorStop(0, `rgba(200,155,90,${0.18 * orbScale * glowStrength})`);
        ag.addColorStop(0.4, `rgba(160,110,50,${0.07 * orbScale * glowStrength})`);
        ag.addColorStop(1, 'rgba(14,11,9,0)');
        launchCtx.fillStyle = ag;
        launchCtx.fillRect(0, 0, launchW, launchH);
    }

    // ── HORIZON: DEPTH LAYERS + MIST + MAIN (no bloom) ──
    if (horizonAlpha > 0.005) {
        const segs = Math.ceil(launchW / 2);
        const ampMain = 2.5 + riseProgress * 9;

        // Far ridge
        launchCtx.save();
        launchCtx.beginPath();
        for (let i = 0; i <= segs; i++) {
            const x = (i / segs) * launchW;
            const y = launchHY(x, t * 0.35, horizonBase - 20, 1.8, 0.8);
            i === 0 ? launchCtx.moveTo(x, y) : launchCtx.lineTo(x, y);
        }
        launchCtx.strokeStyle = `rgba(155,115,65,${horizonAlpha * 0.10})`;
        launchCtx.lineWidth = 0.7;
        launchCtx.stroke();
        launchCtx.restore();

        // Mid ridge
        launchCtx.save();
        launchCtx.beginPath();
        for (let i = 0; i <= segs; i++) {
            const x = (i / segs) * launchW;
            const y = launchHY(x, t * 0.60, horizonBase - 9, 2.8 + riseProgress * 2, 2.1);
            i === 0 ? launchCtx.moveTo(x, y) : launchCtx.lineTo(x, y);
        }
        launchCtx.strokeStyle = `rgba(178,132,75,${horizonAlpha * 0.18})`;
        launchCtx.lineWidth = 0.9;
        launchCtx.stroke();
        launchCtx.restore();

        // Mist band
        launchCtx.save();
        const mist = launchCtx.createLinearGradient(0, horizonBase - 28, 0, horizonBase + 32);
        mist.addColorStop(0, 'rgba(14,11,9,0)');
        mist.addColorStop(0.38, `rgba(135,95,50,${horizonAlpha * 0.065 * (0.3 + riseProgress * 0.7)})`);
        mist.addColorStop(0.62, `rgba(90,62,28,${horizonAlpha * 0.04})`);
        mist.addColorStop(1, 'rgba(14,11,9,0)');
        launchCtx.fillStyle = mist;
        launchCtx.fillRect(0, horizonBase - 28, launchW, 60);
        launchCtx.restore();

        // Main horizon line — no bloom pass
        launchCtx.save();
        launchCtx.beginPath();
        for (let i = 0; i <= segs; i++) {
            const x = (i / segs) * launchW;
            const y = launchHY(x, t, horizonBase, ampMain);
            i === 0 ? launchCtx.moveTo(x, y) : launchCtx.lineTo(x, y);
        }
        const cA = horizonAlpha * (0.55 + riseProgress * 0.42);
        const hLg = launchCtx.createLinearGradient(0, horizonBase, launchW, horizonBase);
        hLg.addColorStop(0, `rgba(140,100,55,${horizonAlpha * 0.07})`);
        hLg.addColorStop(0.28, `rgba(205,158,102,${cA * 0.68})`);
        hLg.addColorStop(0.5, `rgba(240,196,132,${cA})`);
        hLg.addColorStop(0.72, `rgba(205,158,102,${cA * 0.68})`);
        hLg.addColorStop(1, `rgba(140,100,55,${horizonAlpha * 0.07})`);
        launchCtx.strokeStyle = hLg;
        launchCtx.lineWidth = 1.5 + riseProgress * 0.5;
        launchCtx.stroke();
        launchCtx.restore();

        // Ground warmth
        launchCtx.save();
        launchCtx.beginPath();
        for (let i = 0; i <= segs; i++) {
            const x = (i / segs) * launchW;
            const y = launchHY(x, t, horizonBase, ampMain);
            i === 0 ? launchCtx.moveTo(x, y) : launchCtx.lineTo(x, y);
        }
        launchCtx.lineTo(launchW, launchH); launchCtx.lineTo(0, launchH); launchCtx.closePath();
        const tg = launchCtx.createRadialGradient(cx, horizonBase, 0, cx, horizonBase + launchH * 0.28, launchW * 0.52);
        tg.addColorStop(0, `rgba(95,60,25,${horizonAlpha * 0.11 * (0.3 + riseProgress * 0.7)})`);
        tg.addColorStop(0.5, `rgba(50,30,10,${horizonAlpha * 0.04})`);
        tg.addColorStop(1, 'rgba(14,11,9,0)');
        launchCtx.fillStyle = tg;
        launchCtx.fill();
        launchCtx.restore();
    }

    // ── PARTICLES ──
    if (orbEmerge > 0.3) {
        const pAct = launchClamp01((orbEmerge - 0.3) / 0.7);

        // Rise sparks — while orb is climbing
        if (riseProgress < 0.90) {
            const rate = (0.35 + riseProgress * 1.7) * pAct;
            const count = Math.floor(rate * dt / 16);
            for (let i = 0; i < count; i++) {
                emitLaunchRise(cx, orbY + r * 0.95,
                    0.55 + riseProgress * 0.4,
                    0.09 + riseProgress * 0.19,
                    1800 + Math.random() * 1400,
                    0.6 + Math.random() * 1.3);
            }
        }

        // Dust — settles along horizon after orb has risen
        if (riseProgress > 0.45) {
            const dustAmt = launchClamp01((riseProgress - 0.45) / 0.45);
            const dustCount = Math.floor((0.7 * dustAmt * pAct) * dt / 16);
            for (let i = 0; i < dustCount; i++) {
                emitLaunchDust(horizonBase, cx, dustAmt);
            }
        }
    }
    for (const p of launchParticles) { p.update(dt); p.draw(); }

    // ── ORB — original version ──
    if (orbScale > 0.005) {

        // Outer glow
        const og = launchCtx.createRadialGradient(cx, orbY, r * 0.8, cx, orbY, r * 4.5);
        og.addColorStop(0, `rgba(220,170,100,${0.25 * orbScale})`);
        og.addColorStop(0.5, `rgba(180,130,60,${0.08 * orbScale})`);
        og.addColorStop(1, 'rgba(14,11,9,0)');
        launchCtx.fillStyle = og;
        launchCtx.fillRect(0, 0, launchW, launchH);

        // Mid glow
        const mg = launchCtx.createRadialGradient(cx, orbY, 0, cx, orbY, r * 2.2);
        mg.addColorStop(0, `rgba(255,220,160,${0.4 * orbScale})`);
        mg.addColorStop(0.5, `rgba(220,170,100,${0.15 * orbScale})`);
        mg.addColorStop(1, 'rgba(14,11,9,0)');
        launchCtx.fillStyle = mg;
        launchCtx.beginPath(); launchCtx.arc(cx, orbY, r * 2.2, 0, Math.PI * 2); launchCtx.fill();

        // Body
        const bg = launchCtx.createRadialGradient(cx - r * 0.2, orbY - r * 0.2, 0, cx, orbY, r);
        bg.addColorStop(0, `rgba(255,235,200,${0.95 * orbScale})`);
        bg.addColorStop(0.4, `rgba(255,210,140,${0.9 * orbScale})`);
        bg.addColorStop(0.75, `rgba(230,175,100,${0.85 * orbScale})`);
        bg.addColorStop(1, `rgba(196,149,106,${0.6 * orbScale})`);
        launchCtx.beginPath(); launchCtx.arc(cx, orbY, r, 0, Math.PI * 2);
        launchCtx.fillStyle = bg; launchCtx.fill();

        // Inner highlight
        const ig = launchCtx.createRadialGradient(cx - r * 0.15, orbY - r * 0.15, 0, cx, orbY, r * 0.5);
        ig.addColorStop(0, `rgba(255,248,230,${0.5 * orbScale})`);
        ig.addColorStop(1, 'rgba(255,248,230,0)');
        launchCtx.fillStyle = ig;
        launchCtx.beginPath(); launchCtx.arc(cx, orbY, r * 0.5, 0, Math.PI * 2); launchCtx.fill();
    }

    if (!launchEnded) {
        launchRaf = requestAnimationFrame(renderLaunch);
    }
}

// Start launch animation
launchRaf = requestAnimationFrame(renderLaunch);
