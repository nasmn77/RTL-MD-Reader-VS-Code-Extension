# RTL Markdown Reader — قارئ ماركداون عربي

إضافة لـ VS Code تعرض ملفات Markdown **بالكامل من اليمين إلى اليسار**، مع دعم كل خصائص Markdown — وعلى رأسها **الجداول**.

---

## المميزات

| الميزة | الحالة |
|--------|:------:|
| الجداول (بما فيها المحاذاة `:---:` والدمج rowspan/colspan) | ✅ |
| القوائم المرتبة وغير المرتبة (العلامات على اليمين) | ✅ |
| قوائم المهام `- [x]` | ✅ |
| الاقتباسات (الخط الجانبي على اليمين) | ✅ |
| كتل الكود (تبقى LTR كما يجب) | ✅ |
| المعادلات الرياضية KaTeX | ✅ |
| مخططات Mermaid | ✅ |
| الحواشي السفلية | ✅ |
| قوائم التعريف، `~~حذف~~`، `==تمييز==`، `<ins>` | ✅ |
| الصور المحلية والروابط النسبية | ✅ |
| مزامنة التمرير مع المحرر | ✅ |
| فهرس محتويات جانبي | ✅ |
| تصدير HTML وطباعة PDF | ✅ |

### معالجة ذكية للاتجاه

- كل خلية جدول وكل فقرة تحصل على `dir="auto"` — فالنص الإنجليزي داخل جدول عربي يبقى LTR، وعلامات الترقيم لا تقفز إلى الجهة الخاطئة.
- كتل الكود والمعادلات تبقى LTR دائماً مع `unicode-bidi: isolate`.
- المحاذاة الصريحة في المصدر (`|:---:|`) لها الأولوية على الاتجاه العام.

---

## التثبيت

الإضافة منشورة على متجر VS Code:

### 🔗 [**RTL Markdown Reader على المتجر**](https://marketplace.visualstudio.com/items?itemName=naseralmadi.rtl-md-reader)

**من داخل VS Code:** اضغط <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> وابحث عن
`RTL Markdown Reader` ← **Install**.

**أو من سطر الأوامر:**

```bash
code --install-extension naseralmadi.rtl-md-reader
```

### التثبيت اليدوي (بدون متجر)

نزّل ملف `rtl-md-reader.vsix` من صفحة
[**Releases**](https://github.com/nasmn77/RTL-MD-Reader-VS-Code-Extension/releases/latest)،
ثم من داخل VS Code: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> ← قائمة `...` ←
**Install from VSIX…** ← اختر الملف ← أعد تشغيل VS Code.

الملف مكتفٍ ذاتياً (١٫٨ ميجابايت) — لا يحتاج إنترنت ولا Node.js على الجهاز الهدف،
ويعمل على Windows و macOS و Linux.

### البناء من المصدر

```bash
npm install
npm run compile
npx @vscode/vsce package -o rtl-md-reader.vsix
```

---

## الاستخدام

### فتح المعاينة

| الطريقة | كيف |
|---------|-----|
| اختصار | <kbd>Ctrl</kbd>+<kbd>K</kbd> ثم <kbd>V</kbd> (فتح المعاينة) |
| اختصار | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd> (جعلها الافتراضية) |
| زر | أيقونة المعاينة أعلى يمين المحرر |
| لوحة الأوامر | `RTL Markdown: فتح المعاينة` |
| المستكشف | كليك يمين على الملف ← `RTL Markdown: فتح المعاينة` |

### جعلها الافتراضية

**المقصود بـ "الافتراضي":** عادةً عند النقر المزدوج على ملف `.md` يفتحه VS Code في **محرر النص**. بعد التفعيل، سيفتحه مباشرةً في **قارئ RTL** بدل ذلك.

**الخطوات:**

1. افتح أي ملف `.md` (مثل [sample/نموذج.md](sample/نموذج.md) المرفق).
2. اضغط <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd>.
   أو من لوحة الأوامر <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> ← اكتب `RTL Markdown` ← اختر **جعلها المعاينة الافتراضية لملفات MD**.
3. ستظهر نافذة تأكيد تشرح ما سيحدث ← اضغط **تفعيل**.
4. سيُعاد فتح الملف الحالي في القارئ فوراً لترى النتيجة.

**كيف أرجع للتحرير بعد التفعيل؟**

- زر **✎ تحرير** في شريط الأدوات أعلى القارئ، أو
- كليك يمين على الملف في المستكشف ← **Open With…** ← **Text Editor**.

**للتراجع نهائياً:** لوحة الأوامر ← `RTL Markdown: إلغاء جعلها الافتراضية`.
(أو اضغط <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd> مرة أخرى — سينبّهك أنها مفعّلة ويعرض زر الإلغاء.)

**ماذا يتغيّر تقنياً؟** يضيف الأمر هذا إلى إعداداتك:

```json
"workbench.editorAssociations": {
  "*.md": "rtlMd.reader",
  "*.markdown": "rtlMd.reader"
}
```

> **للتحرير بعد جعلها افتراضية:** اضغط زر **✎ تحرير** في شريط الأدوات، أو كليك يمين على الملف ← **Open With…** ← **Text Editor**.
>
> للتراجع: `RTL Markdown: إلغاء جعلها الافتراضية`.

### المعاينة المدمجة في VS Code

الإضافة تجعل معاينة Markdown **المدمجة** في VS Code تعمل بالاتجاه RTL أيضاً — تلقائياً ودون أي إعداد. لتعطيل ذلك:

```json
"rtlMd.applyToBuiltinPreview": false
```

---

## الإعدادات

| الإعداد | الافتراضي | الوصف |
|---------|:---------:|-------|
| `rtlMd.direction` | `rtl` | `rtl` / `ltr` / `auto` (كشف تلقائي من محتوى الملف) |
| `rtlMd.applyToBuiltinPreview` | `true` | تطبيق RTL على المعاينة المدمجة |
| `rtlMd.fontFamily` | `""` | خط النص (فارغ = خط مناسب للعربية) |
| `rtlMd.fontSize` | `16` | حجم الخط بالبكسل |
| `rtlMd.lineHeight` | `1.9` | ارتفاع السطر |
| `rtlMd.maxContentWidth` | `980px` | أقصى عرض للمحتوى |
| `rtlMd.codeBlockDirection` | `ltr` | اتجاه كتل الكود |
| `rtlMd.tableHeaderAlign` | `auto` | محاذاة رؤوس الجداول |
| `rtlMd.enableMermaid` | `true` | مخططات Mermaid |
| `rtlMd.enableMath` | `true` | معادلات KaTeX |
| `rtlMd.enableTaskLists` | `true` | قوائم المهام |
| `rtlMd.enableFootnotes` | `true` | الحواشي السفلية |
| `rtlMd.syncScroll` | `true` | مزامنة التمرير |
| `rtlMd.showToolbar` | `true` | شريط الأدوات |
| `rtlMd.showToc` | `false` | فتح الفهرس تلقائياً |

مثال — وضع الكشف التلقائي (ملفات عربية RTL وإنجليزية LTR):

```json
{
  "rtlMd.direction": "auto",
  "rtlMd.fontSize": 17,
  "rtlMd.fontFamily": "'Dubai', 'Segoe UI'"
}
```

---

## شريط الأدوات

| الزر | الوظيفة |
|------|---------|
| ✎ تحرير | فتح الملف في المحرر النصي |
| ⇄ RTL/LTR | تبديل الاتجاه فوراً |
| ⎙ طباعة | طباعة أو حفظ PDF |
| ☰ الفهرس | إظهار/إخفاء فهرس المحتويات |
| − / + | تصغير/تكبير (أو <kbd>Ctrl</kbd>+<kbd>-</kbd> / <kbd>Ctrl</kbd>+<kbd>+</kbd>) |

---

## ملف تجريبي

`sample/نموذج.md` يحتوي على أمثلة لكل الخصائص المدعومة — افتحه للتأكد من أن كل شيء يعمل.

---

## التطوير

```bash
npm install      # تثبيت التبعيات
npm run compile  # بناء TypeScript
npm run package  # إنتاج ملف VSIX
```

للتجربة أثناء التطوير: افتح المجلد في VS Code واضغط <kbd>F5</kbd>.

### البنية

| الملف | الدور |
|-------|-------|
| `src/extension.ts` | نقطة الدخول، الأوامر، لوحات المعاينة |
| `src/editorProvider.ts` | المحرر المخصص (يتيح جعلها الافتراضية) |
| `src/renderer.ts` | إعداد markdown-it وقواعد الاتجاه وكشف RTL |
| `src/webviewHtml.ts` | بناء HTML وأنماط CSS الكاملة للـ RTL |
| `src/markdownItHook.ts` | توسعة المعاينة المدمجة في VS Code |
| `media/builtin-preview-rtl.css` | أنماط RTL للمعاينة المدمجة |

---

## الترخيص

MIT
