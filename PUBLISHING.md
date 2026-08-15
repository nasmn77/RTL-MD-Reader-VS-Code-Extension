# النشر على متجر VS Code

دليل مفصّل لنشر الإضافة على [VS Code Marketplace](https://marketplace.visualstudio.com).

> **ملاحظة:** كل الخطوات التي تتطلب حساباً أو رمزاً شخصياً يجب أن تنفّذها بنفسك.
> لا تشارك رمز الوصول (PAT) مع أي شخص أو أداة — من يملكه ينشر باسمك.

---

## قبل البدء: حالة المشروع

| البند | القيمة |
|------|--------|
| معرّف الإضافة | `naseralmadi.rtl-md-reader` |
| الناشر | `naseralmadi` |
| الإصدار | `1.0.0` |
| حجم الحزمة | ١٫٧٩ ميجابايت |

كل الشروط الإلزامية مستوفاة: `name` بأحرف صغيرة، `version` بصيغة SemVer،
`publisher` و `engines.vscode` موجودان، الأيقونة PNG لا SVG، والكلمات
المفتاحية ٧ (الحد ٣٠).

---

## الخطوة ١: أنشئ منظمة Azure DevOps

المتجر يعتمد على Azure DevOps للمصادقة، لا على GitHub.

1. افتح <https://dev.azure.com>
2. سجّل الدخول بحساب Microsoft (يصلح `nasmn77@gmail.com`).
3. إن لم تكن لديك منظمة، أنشئ واحدة — الاسم لا يهم ولن يظهر للمستخدمين.

---

## الخطوة ٢: أنشئ الناشر

1. افتح <https://marketplace.visualstudio.com/manage>
2. اضغط **Create publisher** في اللوحة اليمنى.
3. املأ الحقلين:

| الحقل | القيمة | ملاحظة |
|------|--------|--------|
| **ID** | `naseralmadi` | يجب أن يطابق `package.json` تماماً — **لا يمكن تغييره لاحقاً** |
| **Name** | `Naser Almadi` | اسم العرض الذي يراه الناس |

---

## الخطوة ٣: أنشئ رمز وصول شخصي (PAT)

1. في <https://dev.azure.com>، اضغط أيقونة المستخدم (أعلى اليمين) ←
   **Personal access tokens**
2. اضغط **New Token**
3. املأ النافذة بدقة:

| الحقل | القيمة المطلوبة |
|------|------------------|
| **Name** | أي اسم تريده (مثل `vsce-publish`) |
| **Organization** | **All accessible organizations** ⚠️ |
| **Expiration** | حسب رغبتك |
| **Scopes** | **Custom defined** ← اضغط **Show all scopes** ← انزل إلى **Marketplace** ← فعّل **Manage** |

4. اضغط **Create** وانسخ الرمز **فوراً** — لن يظهر مرة أخرى.

> ⚠️ **أكثر خطأين شيوعاً** (وهما سبب أخطاء 401/403):
> - اختيار منظمة محددة بدل **All accessible organizations**
> - عدم ضبط الصلاحية على **Marketplace → Manage**

---

## الخطوة ٤: جهّز مساراً بلا مسافات

أداة `vsce` تفشل مع المسارات التي تحتوي مسافات، لأنها تستدعي `npm` داخلياً
دون اقتباس المسار. ومسار مشروعك الحالي فيه مسافات:

```
C:\MyProjects\getHub\RTL MD Reader Extension
                        ↑ مسافات
```

انسخ المشروع إلى مسار نظيف:

```bash
git clone https://github.com/nasmn77/RTL-MD-Reader-VS-Code-Extension.git C:/build/rtl-md
cd C:/build/rtl-md
npm install
npm run compile
```

---

## الخطوة ٥: سجّل الدخول وانشر

من المسار النظيف:

```bash
npx @vscode/vsce login naseralmadi
```

سيطلب الرمز — الصقه واضغط Enter. ثم:

```bash
npx @vscode/vsce publish
```

بعد **٥–١٠ دقائق** تصبح الإضافة قابلة للتثبيت بالبحث عن
`RTL Markdown Reader` داخل VS Code.

### بديل: النشر دون تسجيل دخول

```bash
npx @vscode/vsce publish -p <YOUR_TOKEN>
```

أو عبر متغيّر بيئة (أنظف — لا يبقى الرمز في سجل الأوامر):

```bash
export VSCE_PAT=<YOUR_TOKEN>
npx @vscode/vsce publish
```

---

## إصدار تحديث لاحقاً

`vsce` يرفع رقم الإصدار ويعدّل `package.json` وينشر، دفعة واحدة:

```bash
npx @vscode/vsce publish patch    # 1.0.0 → 1.0.1  (إصلاحات)
npx @vscode/vsce publish minor    # 1.0.0 → 1.1.0  (ميزات جديدة)
npx @vscode/vsce publish major    # 1.0.0 → 2.0.0  (تغييرات جذرية)
```

أو حدّد الرقم صراحة:

```bash
npx @vscode/vsce publish 1.2.0
```

> داخل مستودع git، ينشئ الأمر **commit ووسم (tag)** للإصدار تلقائياً.
> لا تنسَ تحديث `CHANGELOG.md` قبل النشر.

### سحب إصدار

```bash
npx @vscode/vsce unpublish naseralmadi.rtl-md-reader
```

---

## ⚠️ مهم: رموز PAT ستتوقف في ١ ديسمبر ٢٠٢٦

وثائق Microsoft الرسمية تنص على أن رموز PAT العامة في Azure DevOps
**ستُلغى في ١ ديسمبر ٢٠٢٦**. البديل هو المصادقة عبر **Microsoft Entra ID**:

```bash
npx @vscode/vsce publish --azure-credential
```

(يتطلب `vsce` إصدار 2.26.1 أو أحدث)

للنشر اليدوي من جهازك الآن، طريقة PAT تعمل بلا مشكلة. لكن إن أعددت نشراً
آلياً عبر GitHub Actions، فابنِه على `--azure-credential` من البداية بدل
PAT — وإلا سيتوقف لاحقاً.

---

## الأخطاء الشائعة

| الخطأ | السبب والحل |
|------|-------------|
| `401 Unauthorized` / `403 Forbidden` | الرمز خاطئ، أو لم تختر **All accessible organizations**، أو الصلاحية ليست **Marketplace → Manage** |
| `The extension 'name' already exists` | الاسم محجوز لناشر آخر — غيّر `name` في `package.json` |
| `Invalid publisher name` | `publisher` يحتوي مسافات أو أحرفاً كبيرة — يجب أن يكون معرّفاً بأحرف صغيرة |
| `'C:\MyProjects\getHub\RTL' is not recognized` | مسار المشروع فيه مسافات — انظر الخطوة ٤ |
| `You exceeded the number of allowed tags of 30` | قلّل `keywords` (لدينا ٧ حالياً) |
| فشل بسبب SVG | المتجر يرفض صور SVG من المستخدم — أيقونتنا PNG ✅ |

---

## بعد النشر

- **صفحة الإضافة**: `https://marketplace.visualstudio.com/items?itemName=naseralmadi.rtl-md-reader`
- **لوحة الإدارة**: <https://marketplace.visualstudio.com/manage/publishers/naseralmadi>
  (إحصاءات التثبيت، التقييمات، الأسئلة)
- **التثبيت للمستخدمين**: بحث عن `RTL Markdown Reader` في لوحة Extensions

### الناشر الموثّق (Verified Publisher)

الشارة الزرقاء تتطلب:

- مرور **٦ أشهر** على وجود إضافة لك في المتجر
- ملكية نطاق عمره **٦ أشهر** على الأقل (نطاق رئيسي، لا نطاق فرعي مثل
  `username.github.io`)
- إضافة سجل TXT في DNS، ثم مراجعة من فريق المتجر خلال ٥ أيام عمل

> تغيير اسم العرض للناشر **يلغي** الشارة.
