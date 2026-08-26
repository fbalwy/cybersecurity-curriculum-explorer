from __future__ import annotations

import json
from pathlib import Path
from types import ModuleType


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / ".codex_work" / "build_knowledge_base.py"
RAW = ROOT / ".codex_work" / "raw_workbooks.json"
OUTPUT = Path(__file__).resolve().parents[1] / "src" / "data" / "plans.generated.json"

module = ModuleType("knowledge_builder")
source_code = SOURCE.read_text(encoding="utf-8")
definitions, separator, _ = source_code.partition("\nraw = json.loads(RAW_PATH.read_text")
if not separator:
    raise RuntimeError(f"Unable to isolate definitions in {SOURCE}")
exec(compile(definitions, str(SOURCE), "exec"), module.__dict__)

raw = json.loads(RAW.read_text(encoding="utf-8"))

plan_meta = {
    "old": {
        "label": "Old Plan",
        "track": "1444 AH",
        "sourceFile": "Final_Study_Plan.xlsx",
        "warnings": [
            "The source instructs students to select three courses for the CYB1, CYB2, and CYB3 slots.",
            "CYB386 is Field Experience / Internship in this plan. It requires 100 earned credit hours and is recommended for the summer term.",
        ],
    },
    "developed": {
        "label": "Developed Plan",
        "track": "1446 AH",
        "sourceFile": "Copy of ne Cybersecurity Developed 2-12-2024.xlsx",
        "warnings": [
            "The plan contains four specialization slots (CYB1–CYB4), while the source instruction says to select only three courses for CYB1–CYB3. This remains unresolved.",
            "CYB486 requires 145 earned credit hours. Its own credit cell is blank, while Level 10 totals 6 credits.",
        ],
    },
}

category_labels = {
    "university": "University requirements",
    "college": "College requirements",
    "math-science": "Mathematics & science",
    "cybersecurity": "Cybersecurity core",
    "project-training": "Projects & training",
    "elective": "Specialization elective",
}

distribution_labels = {
    "متطلبات الجامعة": "University requirements",
    "متطلبات الكلية": "College requirements",
    "الاختيارات الحرة": "Free electives",
    "متطلبات التخصص": "Major requirements",
    "المقررات المساندة للتخصص": "Supporting requirements",
    "اختيارات التخصص": "Specialization electives",
    "المشروع": "Project",
    "التدريب العملي": "Practical training",
}

project_training = {
    "old": {"CYB386", "CYB487", "CYB488"},
    "developed": {"CYB388", "CYB479", "CYB486"},
}


def category_group(key: str, course: dict) -> str:
    code = course["code"]
    if course["kind"] == "elective_option" or (code.startswith("CYB") and code[3:].isdigit() and int(code[3:]) < 10):
        return "elective"
    if code in project_training[key]:
        return "project-training"
    raw_category = course["category"]
    if raw_category in {"GEN", "PRP"}:
        return "university"
    if raw_category in {"MTH", "SCI"}:
        return "math-science"
    if raw_category in {"CS", "CIS"}:
        return "college"
    return "cybersecurity"


def sanitize(value):
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


payload = {"generatedFrom": "CYB_STUDY_PLANS_KNOWLEDGE_BASE.md", "plans": {}}

for key in ("old", "developed"):
    plan = module.build_plan(raw, key)
    cfg = module.CONFIG[key]
    courses = []
    for course in plan["required"] + plan["electives"]:
        group = category_group(key, course)
        courses.append(
            {
                "code": course["code"],
                "name": course["name"].strip() if isinstance(course["name"], str) else course["name"],
                "kind": course["kind"],
                "level": course["level"],
                "requirementRaw": course["requirement_raw"],
                "requirementStatus": course["requirement_status"],
                "prerequisites": course["prerequisite_courses"],
                "creditThreshold": course["credit_threshold"],
                "requirementLogic": course["logic"],
                "categoryRaw": course["category"],
                "categoryGroup": group,
                "categoryLabel": category_labels[group],
                "lectureHours": sanitize(course["lecture_hours"]),
                "labHours": sanitize(course["lab_hours"]),
                "creditHours": sanitize(course["credit_hours"]),
                "sourceRange": f"CYB!{course['source_range']}",
            }
        )

    unresolved = [
        {
            "course": item["course"],
            "missing": item["missing"],
            "raw": item["raw"],
        }
        for item in plan["unresolved"]
    ]

    payload["plans"][key] = {
        "id": cfg["plan_id"],
        "key": key,
        **plan_meta[key],
        "totalCredits": sanitize(plan["grand_total"]),
        "programCredits": sanitize(plan["program_total"]),
        "levelTotals": {str(level): sanitize(total) for level, total in plan["level_totals"].items()},
        "distribution": [
            {"label": distribution_labels[label], "credits": sanitize(value), "sourceCell": f"CYB!{ref}"}
            for label, ref, value in plan["breakdown"]
        ],
        "electiveInstruction": plan["elective_instruction"],
        "warnings": plan_meta[key]["warnings"],
        "unresolved": unresolved,
        "courses": courses,
    }

OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {OUTPUT}")
