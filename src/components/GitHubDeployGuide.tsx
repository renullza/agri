import React, { useState } from 'react';
import { Copy, Check, Terminal, GitBranch, Globe, FileCode } from 'lucide-react';

export const GitHubDeployGuide: React.FC = () => {
  const [githubUser, setGithubUser] = useState<string>('renullza');
  const [repoName, setRepoName] = useState<string>('agri');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deployMethod, setDeployMethod] = useState<'actions' | 'gh-pages'>('actions');

  const cleanRepo = repoName.trim().replace(/^\/+|\/+$/g, '') || 'azarkesht-sentinel';
  const cleanUser = githubUser.trim() || 'your-username';
  const liveUrl = `https://${cleanUser}.github.io/${cleanRepo}/`;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const viteConfigSnippet = `import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // نام ریپازیتوری گیت‌هاب شما برای مسیردهی صحیح فایل‌ها در GitHub Pages
  base: '/${cleanRepo}/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});`;

  const githubActionWorkflowSnippet = `name: Deploy React Sentinel App to GitHub Pages

on:
  push:
    branches: ['main']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Normalize package.json for public npm & Install
        run: |
          node -e '
            const fs = require("fs");
            const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
            pkg.dependencies = {
              "react": "^19.0.0",
              "react-dom": "^19.0.0",
              "lucide-react": "^0.475.0"
            };
            pkg.devDependencies = {
              "@tailwindcss/vite": "^4.0.9",
              "@types/node": "^22.10.0",
              "@types/react": "^19.0.0",
              "@types/react-dom": "^19.0.0",
              "@vitejs/plugin-react": "^4.3.4",
              "tailwindcss": "^4.0.9",
              "typescript": "^5.7.3",
              "vite": "^6.2.0"
            };
            fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
          '
          rm -f bun.lock package-lock.json
          npm install --legacy-peer-deps

      - name: Build production bundle with base path
        run: npx vite build --base=./

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload build artifact (dist)
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`;

  const ghPagesCliSnippet = `# ۱. نصب پکیج gh-pages در پروژه
npm install --save-dev gh-pages

# ۲. افزودن اسکریپت‌های predeploy و deploy به package.json:
# "predeploy": "vite build --base=/${cleanRepo}/",
# "deploy": "gh-pages -d dist"

# ۳. اتصال به مخزن گیت‌هاب و انتشار روی شاخه gh-pages
git init
git add .
git commit -m "Initial commit: AzarKesht Sentinel Precision Ag App"
git branch -M main
git remote add origin https://github.com/${cleanUser}/${cleanRepo}.git
git push -u origin main

# ۴. دیپلوی مستقیم روی GitHub Pages
npm run deploy`;

  return (
    <div className="space-y-6">
      {/* Header & Interactive Repo Customizer */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              مرکز استقرار و دیپلوی خودکار روی GitHub Pages
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              این وب‌اپلیکیشن به صورت ۱۰۰٪ سمت کاربر (Client-Side SPA) طراحی شده و بدون نیاز به سرور بک‌اند، مستقیماً روی GitHub Pages میزبانی می‌شود.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono bg-[#0B0F17] border border-slate-800 px-3.5 py-2 rounded text-emerald-400" dir="ltr">
            <Globe className="w-4 h-4 shrink-0" />
            <span className="truncate">{liveUrl}</span>
          </div>
        </div>

        {/* Inputs for GitHub Username and Repo Name */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              نام کاربری گیت‌هاب شما (GitHub Username)
            </label>
            <input
              type="text"
              dir="ltr"
              value={githubUser}
              onChange={(e) => setGithubUser(e.target.value)}
              placeholder="e.g. ali-tabrizi"
              className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              نام مخزن پروژه (Repository Name)
            </label>
            <input
              type="text"
              dir="ltr"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="e.g. azarkesht-sentinel"
              className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              روش استقرار (Deployment Method)
            </label>
            <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded">
              <button
                onClick={() => setDeployMethod('actions')}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  deployMethod === 'actions'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                روش ۱: GitHub Actions (توصیه‌شده)
              </button>
              <button
                onClick={() => setDeployMethod('gh-pages')}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  deployMethod === 'gh-pages'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                روش ۲: پکیج gh-pages
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Code & Configuration Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: vite.config.ts */}
        <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>گام اول: تنظیم مسیر پایه در فایل vite.config.ts</span>
            </div>
            <button
              onClick={() => handleCopy('vite-cfg', viteConfigSnippet)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center gap-1.5 transition-colors"
            >
              {copiedId === 'vite-cfg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'vite-cfg' ? 'کپی شد' : 'کپی کد'}</span>
            </button>
          </div>
          <div className="p-4 text-xs text-slate-400 border-b border-slate-800/80">
            در گیت‌هاب پیجز، آدرس پروژه به شکل <code className="text-emerald-400 font-mono">/{cleanRepo}/</code> است؛ بنابراین اضافه کردن <code className="text-emerald-400 font-mono">base: '/{cleanRepo}/'</code> در فایل <code className="text-slate-200 font-mono">vite.config.ts</code> باعث می‌شود تمام تصاویر ماهواره‌ای و فایل‌های جاوااسکریپت به درستی بارگذاری شوند.
          </div>
          <pre className="p-4 bg-[#070A0F] text-xs font-mono text-slate-300 overflow-x-auto flex-1 leading-relaxed" dir="ltr">
            {viteConfigSnippet}
          </pre>
        </div>

        {/* Step 2: Workflow or CLI */}
        {deployMethod === 'actions' ? (
          <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <GitBranch className="w-4 h-4 text-cyan-400" />
                <span>گام دوم: فایل .github/workflows/deploy.yml</span>
              </div>
              <button
                onClick={() => handleCopy('gh-action', githubActionWorkflowSnippet)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center gap-1.5 transition-colors"
              >
                {copiedId === 'gh-action' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'gh-action' ? 'کپی شد' : 'کپی ورک‌فلو'}</span>
              </button>
            </div>
            <div className="p-4 text-xs text-slate-400 border-b border-slate-800/80">
              این فایل از قبل در مسیر <code className="text-cyan-400 font-mono">.github/workflows/deploy.yml</code> پروژه شما ایجاد شده است! با هر بار <code className="text-slate-200 font-mono">git push</code> روی شاخه <code className="text-slate-200 font-mono">main</code>، گیت‌هاب به طور خودکار پروژه را Build و منتشر می‌کند.
            </div>
            <pre className="p-4 bg-[#070A0F] text-xs font-mono text-slate-300 overflow-x-auto max-h-[300px] leading-relaxed" dir="ltr">
              {githubActionWorkflowSnippet}
            </pre>
          </div>
        ) : (
          <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span>گام دوم: دستورات ترمینال با پکیج gh-pages</span>
              </div>
              <button
                onClick={() => handleCopy('gh-cli', ghPagesCliSnippet)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center gap-1.5 transition-colors"
              >
                {copiedId === 'gh-cli' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'gh-cli' ? 'کپی شد' : 'کپی دستورات'}</span>
              </button>
            </div>
            <div className="p-4 text-xs text-slate-400 border-b border-slate-800/80">
              اگر تمایل دارید از روی سیستم خودتان با یک دستور خروجی را روی شاخه <code className="text-amber-400 font-mono">gh-pages</code> بفرستید، دستورات زیر را در ترمینال اجرا کنید:
            </div>
            <pre className="p-4 bg-[#070A0F] text-xs font-mono text-slate-300 overflow-x-auto flex-1 leading-relaxed" dir="ltr">
              {ghPagesCliSnippet}
            </pre>
          </div>
        )}
      </div>

      {/* Final Checklist in GitHub Repository Settings */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">
          ۰۳. تنظیم نهایی در پنل GitHub (فقط یک‌بار پس از ساخت ریپازیتوری)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="p-3.5 bg-[#0B0F17] border border-slate-800 rounded">
            <div className="font-semibold text-emerald-400 mb-1">۱. ایجاد ریپازیتوری Public</div>
            <p className="text-slate-400 leading-relaxed">
              در اکانت گیت‌هاب خود یک Repository جدید با نام <code className="font-mono text-slate-200">{cleanRepo}</code> به صورت Public بسازید و کدهای پروژه را Push کنید.
            </p>
          </div>
          <div className="p-3.5 bg-[#0B0F17] border border-slate-800 rounded">
            <div className="font-semibold text-emerald-400 mb-1">۲. فعال‌سازی بخش Pages</div>
            <p className="text-slate-400 leading-relaxed">
              وارد تب <code className="font-mono text-slate-200">Settings &rarr; Pages</code> در مخزن گیت‌هاب شوید و در قسمت <code className="font-mono text-slate-200">Build and deployment</code>، گزینه Source را روی <code className="font-mono text-emerald-300">GitHub Actions</code> قرار دهید.
            </p>
          </div>
          <div className="p-3.5 bg-[#0B0F17] border border-slate-800 rounded">
            <div className="font-semibold text-emerald-400 mb-1">۳. مشاهده لینک آنلاین</div>
            <p className="text-slate-400 leading-relaxed">
              پس از حدود ۶۰ ثانیه که تیک سبز در تب <code className="font-mono text-slate-200">Actions</code> ظاهر شد، وب‌اپلیکیشن شما روی آدرس <code className="font-mono text-emerald-300">{liveUrl}</code> در دسترس کشاورزان خواهد بود.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
