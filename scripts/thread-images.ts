/**
 * Prepare curated 循迹 images: resize to ≤1200 px (JPEG q≈80 via macOS `sips`), name
 * xj-<thread>-<slug>-<sha16>.jpg, upload to the local R2 bucket, and print the VM commands.
 *   bun run scripts/thread-images.ts <dir> [--target=local]
 * <dir> holds files named <thread>-<slug>.jpg (e.g. zhangqian-cover.jpg). Prints the /img/ src for each.
 * Env XJ_QUALITY (default 80) sets the JPEG quality.
 */
import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const dir = process.argv[2]
if (!dir) { console.error("usage: bun run scripts/thread-images.ts <dir>"); process.exit(1) }
const quality = Number(process.env.XJ_QUALITY || 80)
const out = join(dir, "out"); mkdirSync(out, { recursive: true })
const vm: string[] = []
for (const f of readdirSync(dir).filter((x) => /^[a-z0-9-]+\.(jpe?g|png|webp)$/i.test(x)).sort()) {
  const base = f.replace(/\.[a-z]+$/i, "")
  const tmp = join(out, base + ".jpg")
  execSync(`sips -s format jpeg -s formatOptions ${quality} -Z 1200 ${JSON.stringify(join(dir, f))} --out ${JSON.stringify(tmp)}`, { stdio: "ignore" })
  const sha = createHash("sha256").update(readFileSync(tmp)).digest("hex").slice(0, 16)
  const key = `xj-${base}-${sha}.jpg`
  execSync(`mv ${JSON.stringify(tmp)} ${JSON.stringify(join(out, key))}`)
  execSync(`bunx wrangler r2 object put museum-images/${key} --file ${JSON.stringify(join(out, key))} --content-type image/jpeg --local`, { stdio: "ignore" })
  console.log(`${f} → /img/${key}  (${Math.round(statSync(join(out, key)).size / 1024)} KB)`)
  vm.push(`docker cp /tmp/xj/${key} museum-map-web-1:/tmp/${key} && docker compose -f deploy/vm/docker-compose.yml exec -T web bunx wrangler r2 object put museum-images/${key} --file /tmp/${key} --content-type image/jpeg --local --persist-to /data/state`)
}
console.log("\n# VM (after scp -r " + out + "/* xian@VM:/tmp/xj/):\n" + vm.join("\n"))
