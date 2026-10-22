# UI/UX Improvements, 21–22 October 2026 — تحسينات الواجهة وتجربة الاستخدام

# English

Scope: what was improved or added to the employee app (Expo) and the HR site on 21–22 October 2026, and is live on `main`.
Only the final, kept state is listed.

## 1. Employee app: new look (829364e)
- New visual identity: slanted brand-green planes, large page titles, brand colours.
- Light and dark appearance follow the device setting; the user can also pick one in the profile.
- Light haptic feedback on taps, tab changes, sending a request and errors (native only).

## 2. Navigation (829364e, bffb5d6)
- Bottom dock with five places: Home, My requests, a centre "+" button, Salary, More.
- "+" opens one request sheet for every request type (see section 4).
- "More" tab lists every other screen so no feature is hidden: attendance log, team, goals, overtime, documents, approvals, profile.
- Header shows the page title with refresh and notification buttons.

## 3. Home hero card (0b32cc8)
- The card background is a gradient with slanted ribbons, drawn at the card's measured size, so it is never cut or mis-sized.
- Live clock with seconds, date, and the main punch button.

## 4. Request sheet (829364e)
- Three steps: choose the type (grouped: leave, permission and punch, finance, ...), fill the details, confirmation.
- Drag down to close.
- Same request rules as the old forms.

## 5. Signing and returning (d67ca5f)
- The page stays still while drawing a signature (no scroll while the finger is on the pad).
- An "X" button on every section opened from "More" returns to "More".

## 6. All devices: phones and tablets (7dd8bc7)
- One place decides sizes from the screen width: `src/lib/responsive.ts`.
- Home tiles and request-type tiles are measured from the real width: 3 per row on phones, 4 on tablets (fixes the two-column layout with empty space).
- On tablets the content, the bottom dock and the request sheet have a maximum width and stay centred.
- Side margins adapt to small phones.
- Text size follows the device setting but is capped (1.25×) so layouts do not break.
- Right-to-left layout is forced on devices (also in Expo Go).

## 7. Time picker (7d1bc6e, 1141d0f)
- 12-hour clock with AM/PM instead of a 24-hour grid of buttons.
- Hour and minute are picked by scrolling a wheel, minute by minute.
- On phones and tablets it uses the system's own wheels (smooth, snapping, follows light/dark); on Android the system time dialog. The browser preview uses custom wheels.
- The saved value is unchanged (`HH:MM`, 24-hour), so the server and other screens are not affected.

## 8. Quality fixes (8fe625a)
- Removed the red React warnings in the employee app.

## 9. HR site (8fe625a)
- New "All requests" log card on the requests page.
- Arabic labels for request and document types that appeared in English (permission, IBAN letter, employee upload, unpaid leave).

---

# العربية

النطاق: ما تم تحسينه أو إضافته في تطبيق الموظف (Expo) وموقع HR يومي 21 و22 أكتوبر 2026، وهو منشور على `main`.
المذكور هنا الحالة النهائية المعتمدة فقط.

## 1. تطبيق الموظف: مظهر جديد (829364e)
- هوية بصرية جديدة: مسطحات خضراء مائلة بألوان العلامة، وعناوين صفحات كبيرة.
- المظهر الفاتح والليلي يتبع إعداد الجهاز، ويمكن للمستخدم اختيار مظهر من الملف الشخصي.
- اهتزاز خفيف عند النقر وتغيير التبويب وإرسال الطلب وعند الأخطاء (على الجوال فقط).

## 2. التنقل (829364e، bffb5d6)
- شريط سفلي بخمسة أماكن: الرئيسية، طلباتي، زر «+» في الوسط، الراتب، المزيد.
- زر «+» يفتح نافذة واحدة لكل أنواع الطلبات (القسم 4).
- تبويب «المزيد» يضم باقي الشاشات حتى لا تُخفى أي ميزة: سجل الحضور، فريقي، أهدافي، العمل الإضافي، مستنداتي، الموافقات، الملف الشخصي.
- الترويسة تعرض عنوان الصفحة مع زري التحديث والإشعارات.

## 3. بطاقة الرئيسية (0b32cc8)
- خلفية البطاقة تدرّج لوني مع شرائط مائلة، تُرسم بحجم البطاقة الفعلي فلا تُقص ولا يختلف حجمها.
- ساعة مباشرة بالثواني، والتاريخ، وزر البصمة الرئيسي.

## 4. نافذة الطلب (829364e)
- ثلاث خطوات: اختيار النوع (مجمّعاً: إجازات، استئذان وبصمة، مالية، ...)، ثم التفاصيل، ثم التأكيد.
- السحب لأسفل يغلقها.
- قواعد الطلب نفسها كما في النماذج القديمة.

## 5. التوقيع والرجوع (d67ca5f)
- الصفحة تثبت أثناء رسم التوقيع (لا تمرير والإصبع على لوحة التوقيع).
- زر «X» في كل قسم مفتوح من «المزيد» يرجع إلى «المزيد».

## 6. كل الأجهزة: الجوالات والآيباد (7dd8bc7)
- مكان واحد يحدد الأحجام حسب عرض الشاشة: `src/lib/responsive.ts`.
- بطاقات الرئيسية وأنواع الطلبات تُقاس بالعرض الفعلي: 3 في الصف على الجوال و4 على الآيباد (يحل مشكلة العمودين مع فراغ).
- على الآيباد للمحتوى والشريط السفلي ونافذة الطلب عرض أقصى، وتبقى في المنتصف.
- الهوامش الجانبية تتكيف مع الجوالات الصغيرة.
- حجم الخط يتبع إعداد الجهاز لكن بسقف 1.25 حتى لا تنكسر الواجهة.
- الاتجاه من اليمين لليسار مفروض على الأجهزة (حتى في Expo Go).

## 7. منتقي الوقت (7d1bc6e، 1141d0f)
- نظام 12 ساعة مع ص/م بدل شبكة أزرار 24 ساعة.
- الساعة والدقيقة تُختاران بتمرير عجلة، دقيقة بدقيقة.
- على الجوال والآيباد يستخدم عجلات النظام نفسها (سلسة وتثبت على القيمة وتتبع الوضع الفاتح والليلي)، وعلى أندرويد نافذة وقت النظام. معاينة المتصفح تستخدم عجلات مخصصة.
- القيمة المحفوظة لم تتغير (`HH:MM` بنظام 24 ساعة)، فلا يتأثر الخادم ولا باقي الشاشات.

## 8. إصلاحات الجودة (8fe625a)
- إزالة تحذيرات React الحمراء في تطبيق الموظف.

## 9. موقع HR (8fe625a)
- بطاقة جديدة «كل الطلبات» في صفحة الطلبات تعرض سجلها.
- تسميات عربية لأنواع طلبات ومستندات كانت تظهر بالإنجليزية (استئذان، خطاب IBAN، رفع الموظف، إجازة بدون راتب).
