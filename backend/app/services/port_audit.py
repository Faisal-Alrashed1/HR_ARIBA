"""The audit texts of their lib/audit.js, written by the server (decision 9: no browser queue / ariba_audit_add_many).
`employee_changes` is their logEmployeeSave field-by-field diff; `pay_edit` is logPayEdit."""
from __future__ import annotations

import json
import re
from typing import Any

MOD = {"employees": "الموظفون", "attendance": "الحضور والانصراف", "payroll": "مسير الرواتب", "leaves": "الإجازات", "requests": "الطلبات",
       "documents": "المستندات والنماذج", "settings": "الإعدادات", "locations": "مواقع البصمة", "security": "الصلاحيات والأمان",
       "settlement": "المخالصة", "insurance": "التأمينات"}
SET_LBL = {"insurance_rules": "تعديل نسب التأمينات الاجتماعية", "hr_signer": "تعديل مدير الموارد البشرية / التوقيع / الختم", "company_logo": "تغيير شعار الشركة",
           "company_names": "تغيير اسم الشركة", "letterhead": "تعديل الورق الرسمي", "country_system": "تغيير النظام (سعودي/مصري)",
           "leave_carry": "تعديل ترحيل الإجازات", "brand_colors": "تعديل ألوان الهوية"}
EL = {"salary": "الراتب الأساسي", "sal": "الراتب الأساسي", "housingAllowance": "بدل السكن", "transportAllowance": "بدل النقل", "projectAllowance": "بدل المشروع",
      "otherAllowance": "بدلات أخرى", "extraAllowance": "الإضافي", "currency": "العملة", "exchRate": "سعر الصرف", "nameAr": "الاسم", "nameEn": "الاسم بالإنجليزي",
      "employer": "جهة العمل", "dept": "القسم", "jobTitle": "الوظيفة", "nationality": "الجنسية", "iqamaNo": "رقم الإقامة", "iqamaExpiry": "انتهاء الإقامة",
      "passportNo": "رقم الجواز", "passportExpiry": "انتهاء الجواز", "contractJoin": "تاريخ المباشرة", "contractEnd": "انتهاء العقد", "iban": "الآيبان",
      "bank": "البنك", "insSystem": "نظام التأمينات", "mobile": "الجوال", "email": "البريد"}
EIGN = {"ts", "updatedAt", "insuranceSub", "insuranceComp", "netSalary", "salaryTotal", "tot", "photoData", "photoUrl", "password", "pw", "pwd", "pass",
        "passwordHash", "savedAt", "name_ar", "name_en", "job_title", "iqama_no", "join_date", "employee_id", "employeeId", "manager_id", "created_at", "updated_at"}
EREG = re.compile(r"^(net|insurance|total|calc|gosi|eosAcc|accrued|yearsOfService$|leaveBalance|leaveRemaining)", re.I)
PAYF = {"workDays": "أيام العمل", "insDays": "أيام التأمينات", "otHours": "ساعات الإضافي", "otAmount": "الإضافي", "leaveManual": "بدل أجازة (يدوي)",
        "otherAllow": "بدلات أخرى", "loanDeduct": "سلف / غياب", "otherDeduct": "خصومات أخرى", "payMethod": "طريقة الدفع", "notes": "ملاحظات",
        "reason": "سبب الإنهاء", "lastDay": "نهاية العقد / آخر يوم"}


def trim(s: Any, n: int) -> str:
    s = "" if s is None else str(s)
    return s[: n - 1] + "…" if len(s) > n else s


def _js(v: Any) -> str:
    """String(v) as the browser prints it (true/false, integers without .0)."""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def fv(v: Any) -> str:
    if v is None or v == "":
        return "—"
    if isinstance(v, bool):
        return "نعم" if v else "لا"
    if isinstance(v, list):
        return "، ".join(_js(x) for x in v)
    if isinstance(v, dict):
        return trim(json.dumps(v, ensure_ascii=False, separators=(",", ":")), 80)
    return trim(_js(v), 80)


def _pick(e: dict[str, Any] | None) -> dict[str, Any]:
    o: dict[str, Any] = {}
    for k, v in (e or {}).items():
        if k in EIGN or EREG.match(k) or k.startswith("_") or v is None or v == "":
            continue
        o[k] = json.dumps(v, ensure_ascii=False, separators=(",", ":")) if isinstance(v, (dict, list)) else v
    return o


def short_name(e: dict[str, Any] | None, eid: Any) -> str:
    e = e or {}
    return " ".join(str(e.get("nameAr") or e.get("nameEn") or eid).split(" ")[:3])


def employee_changes(old: dict[str, Any] | None, new: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    """(action, summary, details) exactly as logEmployeeSave; an unchanged save gives an empty action."""
    nmx = str(new.get("nameAr") or new.get("nameEn") or new.get("id"))
    if not old:
        summary = "إضافة موظف جديد: " + nmx + (" — " + str(new["jobTitle"]) if new.get("jobTitle") else "") + (" (" + str(new["employer"]) + ")" if new.get("employer") else "")
        return "إضافة موظف", summary, {"salary": new.get("salary"), "employer": new.get("employer")}
    a, b = _pick(old), _pick(new)
    keys = list(dict.fromkeys([*a.keys(), *b.keys()]))
    ch = [{"field": k, "label": EL.get(k, k), "old": a.get(k), "new": b.get(k)} for k in keys if _js(a.get(k)) != _js(b.get(k))]
    if not ch:
        return "", "", {}
    summary = nmx + ": " + "؛".join(c["label"] + " من " + fv(c["old"]) + " إلى " + fv(c["new"]) for c in ch[:6]) + (f" … (+{len(ch) - 6})" if len(ch) > 6 else "")
    return "تعديل بيانات موظف", summary, {"changes": ch}


def pay_edit(row: dict[str, Any], field: str, old: Any, new: Any, month: str, auto: bool = False) -> tuple[str, str, dict[str, Any]] | None:
    if _js(old) == _js(new) and not auto:
        return None
    n = " ".join(str(row.get("nameAr") or row.get("name") or row.get("id")).split(" ")[:3])
    label = PAYF.get(field, field)
    return ("رجوع للقيمة التلقائية في المسير" if auto else "تعديل يدوي في المسير",
            f"{n}: {label} من {fv(old)} إلى {fv(new)} (مسير {month})",
            {"field": field, "label": label, "old": old, "new": new, "month": month, "auto": bool(auto)})
