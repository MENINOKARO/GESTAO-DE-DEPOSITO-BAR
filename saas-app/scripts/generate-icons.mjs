import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = process.cwd();
const svgPath = path.join(root, 'public', 'icon.svg');
const buildDir = path.join(root, 'build');
const publicDir = path.join(root, 'public');

fs.mkdirSync(buildDir, { recursive: true });

const svgBuffer = fs.readFileSync(svgPath);

await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(buildDir, 'icon.png'));
await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));
await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));

const ico256 = await sharp(svgBuffer).resize(256, 256).png().toBuffer();
const icoBuf = await pngToIco([ico256]);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuf);

const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(androidRes)) {
  const densities = [
    { dir: 'mipmap-mdpi', launcher: 48, fg: 108 },
    { dir: 'mipmap-hdpi', launcher: 72, fg: 162 },
    { dir: 'mipmap-xhdpi', launcher: 96, fg: 216 },
    { dir: 'mipmap-xxhdpi', launcher: 144, fg: 324 },
    { dir: 'mipmap-xxxhdpi', launcher: 192, fg: 432 }
  ];
  for (const d of densities) {
    const outDir = path.join(androidRes, d.dir);
    if (!fs.existsSync(outDir)) continue;
    await sharp(svgBuffer).resize(d.launcher, d.launcher).png().toFile(path.join(outDir, 'ic_launcher.png'));
    await sharp(svgBuffer).resize(d.launcher, d.launcher).png().toFile(path.join(outDir, 'ic_launcher_round.png'));
    await sharp(svgBuffer).resize(d.fg, d.fg).png().toFile(path.join(outDir, 'ic_launcher_foreground.png'));
  }
}

console.log('Ícones gerados com sucesso em build/icon.ico, build/icon.png, public/icon-*.png e Android res');
