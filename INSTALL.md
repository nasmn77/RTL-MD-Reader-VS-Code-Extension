# تثبيت الإضافة على أجهزة أخرى

كل ما تحتاجه هو ملف واحد: **`rtl-md-reader.vsix`** (١٫٨ ميجابايت).

الملف مكتفٍ ذاتياً — يحتوي على كل المكتبات والخطوط ومحرّك Mermaid و KaTeX بداخله.
لا يحتاج الجهاز الهدف إلى إنترنت ولا Node.js ولا npm.

---

## الطريقة ١: من داخل VS Code (الأسهل)

1. انسخ ملف `rtl-md-reader.vsix` إلى الجهاز الآخر (USB، بريد، شبكة… أي وسيلة).
2. افتح VS Code على ذلك الجهاز.
3. اضغط <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> لفتح لوحة **Extensions**.
4. اضغط زر **`...`** أعلى اللوحة (النقاط الثلاث).
5. اختر **Install from VSIX…**
6. حدّد ملف `rtl-md-reader.vsix` ← **Install**.
7. أعد تشغيل VS Code.

---

## الطريقة ٢: من سطر الأوامر

إن كان أمر `code` متاحاً في الطرفية:

```bash
code --install-extension rtl-md-reader.vsix
```

ثم أعد تشغيل VS Code.

> **إن لم يعمل الأمر `code`:** افتح VS Code ← <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> ←
> `Shell Command: Install 'code' command in PATH` ← ثم أعد فتح الطرفية.

---

## الطريقة ٣: النسخ المباشر (بدون VS Code CLI)

انسخ مجلد الإضافة المثبّت كما هو إلى الجهاز الآخر:

| النظام | المسار |
|--------|--------|
| Windows | `%USERPROFILE%\.vscode\extensions\` |
| macOS / Linux | `~/.vscode/extensions/` |

انسخ المجلد `nasmn.rtl-md-reader-1.0.0` بالكامل إلى المسار أعلاه، ثم أعد تشغيل VS Code.

> تنجح هذه الطريقة لأن الإضافة لا تحتوي على أي مكوّنات مبنيّة لنظام تشغيل
> معيّن (native modules) — كلها JavaScript خالص.

---

## بعد التثبيت على الجهاز الجديد

الإضافة تعمل فوراً، لكن **إعداد "الافتراضي" لا ينتقل مع الملف** — فهو إعداد
في VS Code لا في الإضافة. لتفعيله على الجهاز الجديد:

اضغط <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd> ← **تفعيل**

أو أضف هذا يدوياً إلى `settings.json` على الجهاز الجديد:

```json
"workbench.editorAssociations": {
  "*.md": "rtlMd.reader",
  "*.markdown": "rtlMd.reader"
}
```

---

## المزامنة التلقائية بين أجهزتك (Settings Sync)

إن كنت تستخدم نفس الحساب على عدة أجهزة، يمكن لـ VS Code نقل الإضافة
وإعداداتها تلقائياً:

1. على الجهاز الأصلي: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> ← `Settings Sync: Turn On`
2. سجّل الدخول بحساب Microsoft أو GitHub.
3. فعّل **Extensions** و **Settings** ضمن خيارات المزامنة.
4. على الجهاز الآخر: سجّل الدخول بالحساب نفسه.

> **تنبيه:** المزامنة تنقل الإضافات المثبّتة من **المتجر** بشكل موثوق.
> الإضافات المثبّتة يدوياً من ملف VSIX قد لا تُنقل في بعض إصدارات VS Code —
> جرّبها، وإن لم تنتقل فاستخدم الطريقة ١ يدوياً على كل جهاز.
> أما إعداد `workbench.editorAssociations` فينتقل دائماً مع مزامنة **Settings**.

---

## متطلبات الجهاز الهدف

| المتطلب | القيمة |
|---------|--------|
| VS Code | الإصدار 1.85 أو أحدث |
| نظام التشغيل | Windows / macOS / Linux (أي منها) |
| إنترنت | غير مطلوب |
| Node.js | غير مطلوب |

للتحقق من إصدار VS Code: **Help ← About**.

---

## إعادة بناء ملف VSIX بعد أي تعديل

من مجلد المشروع:

```bash
npm install
npm run compile
npx @vscode/vsce package -o rtl-md-reader.vsix
```

> **ملاحظة على هذا المشروع تحديداً:** مسار المجلد يحتوي على مسافات
> (`RTL MD Reader Extension`)، وأداة `vsce` تفشل مع المسارات التي بها مسافات
> لأنها تستدعي `npm` داخلياً دون اقتباس المسار. الحل: انسخ المشروع مؤقتاً
> إلى مسار بلا مسافات (مثل `C:\build\rtl-md`) ونفّذ الأمر هناك.

---

## نشرها للعموم (اختياري)

لتثبيتها بالبحث المباشر داخل VS Code على أي جهاز، انشرها في المتجر:

```bash
npx @vscode/vsce publish
```

يتطلب ذلك حساب ناشر على [Azure DevOps](https://dev.azure.com) ورمز وصول
شخصي (Personal Access Token). عندها يصبح التثبيت على أي جهاز:
بحث في لوحة Extensions عن `RTL Markdown Reader` ← Install.
