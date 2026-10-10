/* GO Workout full-screen splash regression checks.
 * Run: node apps/member-app-prototype/workout/splash.test.cjs
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'styles.css'),'utf8');
const svg=fs.readFileSync(path.join(__dirname,'assets/branding/goworkout-splash-scene.svg'),'utf8');
const start=css.indexOf('/* GO Workout brand system + launch splash');
const end=css.indexOf('/* Replaces the old gold GO tile',start);
assert.ok(start>=0&&end>start,'Splash styling exists');
const splash=css.slice(start,end);
assert.match(svg,/<svg[^>]+viewBox="0 0 1080 1920"/,'Vector scene has a full-resolution portrait canvas');
assert.match(svg,/<\/svg>/,'Scene is a complete SVG document');
assert.ok(!svg.includes('<image'),'Sharp artwork must not embed another low-res raster');
assert.match(html,/rel="preload" as="image" href="\.\/assets\/branding\/goworkout-splash-scene\.svg"/);
assert.match(html,/class="goworkout-splash-art" src="\.\/assets\/branding\/goworkout-splash-scene\.svg"/);
assert.ok(!html.includes('goworkout-splash.webp'),'Remove the old 220px blurry foreground image');
assert.match(splash,/\.goworkout-splash-art \{[^}]*object-fit: cover;/,'Splash scene must fill the viewport');
assert.match(splash,/\.goworkout-splash \{[^}]*height: 100dvh;/,'Use dynamic visual viewport height');
assert.ok(!/filter:\s*blur\s*\(/i.test(splash),'Splash must not intentionally blur anything');
assert.ok(!/object-fit:\s*contain/i.test(splash),'No letterboxing around image');
assert.ok(!splash.includes('goworkout-splash-backdrop'),'No low-resolution blurred background duplicate');
assert.match(html,/class="goworkout-splash-brand"/,'Brand overlay must be real high-resolution text');
assert.match(html,/Training built around you\./,'Retain launch message');
assert.match(html,/embedded-workout/,'Embedded workout bypass remains');
assert.match(html,/goworkout-splash-loader/,'Progress loader preserved');
assert.match(html,/styles\.css\?v=20261010-sharp-fullscreen-splash/,'Invalidate older cached stylesheets');
console.log('GO Workout splash: full-bleed, crisp vector, logo and mobile viewport checks passed.');
