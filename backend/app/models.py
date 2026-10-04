"""Every table and enum.

Conventions:
- UUID primary keys, created_at / updated_at on every table.
- deleted_at (soft delete) where history matters.
- Money is Numeric(12, 2); rates/percentages Numeric(6, 3); never floats.
- Enums are stored by value (lowercase strings) and render as native Postgres ENUM types.
"""

import enum
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

MONEY = Numeric(12, 2)
RATE = Numeric(6, 3)
DAYS = Numeric(7, 2)


class Base(DeclarativeBase):
    pass


def pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    return Enum(
        enum_cls,
        name=name,
        native_enum=True,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )


class IdMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# --------------------------------------------------------------------------- enums


class Role(str, enum.Enum):
    employee = "employee"
    manager = "manager"
    finance = "finance"
    hr = "hr"
    ceo = "ceo"
    admin = "admin"


class EmployeeCategory(str, enum.Enum):
    active = "active"
    tamheer = "tamheer"
    training = "training"
    consultant = "consultant"
    hourly = "hourly"


class WpsType(str, enum.Enum):
    wps = "wps"
    trainee = "trainee"
    tamheer = "tamheer"
    external = "external"
    consultant = "consultant"
    no_wps = "no_wps"
    remote = "remote"


class GosiSystem(str, enum.Enum):
    matching = "matching"  # "new" system in the prototype
    non_matching = "non_matching"  # "old" system
    non_saudi = "non_saudi"


class Currency(str, enum.Enum):
    SAR = "SAR"
    USD = "USD"
    EUR = "EUR"
    EGP = "EGP"


class PaymentMethod(str, enum.Enum):
    mudad = "mudad"
    bank_transfer = "bank_transfer"
    international_transfer = "international_transfer"
    cash = "cash"


class ContractNature(str, enum.Enum):
    fixed = "fixed"
    indefinite = "indefinite"


class Gender(str, enum.Enum):
    male = "male"
    female = "female"


class Religion(str, enum.Enum):
    muslim = "muslim"
    other = "other"


class MaritalStatus(str, enum.Enum):
    single = "single"
    married = "married"
    divorced = "divorced"
    widowed = "widowed"


class TerminationArticle(str, enum.Enum):
    art_84 = "art_84"  # end of contract / employer termination
    art_74 = "art_74"  # contract ended by agreement / term
    art_74_death = "art_74_death"  # 74(3) death or disability
    art_74_retirement = "art_74_retirement"  # 74(4) retirement age
    art_85 = "art_85"  # resignation (indefinite contract)
    art_75 = "art_75"  # resignation with notice
    art_77 = "art_77"  # termination without valid reason
    art_80 = "art_80"  # dismissal for cause
    art_53 = "art_53"  # termination during probation


class DependentRelation(str, enum.Enum):
    wife = "wife"
    husband = "husband"
    son = "son"
    daughter = "daughter"
    father = "father"
    mother = "mother"


class LocationType(str, enum.Enum):
    hq = "hq"
    project = "project"
    remote = "remote"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    late = "late"
    absent = "absent"
    leave = "leave"
    remote = "remote"


class AttendanceSource(str, enum.Enum):
    app = "app"
    manual = "manual"


class RequestType(str, enum.Enum):
    annual = "annual"
    sick = "sick"
    emergency = "emergency"
    death = "death"
    marriage = "marriage"
    maternity = "maternity"
    paternity = "paternity"
    umrah = "umrah"
    hajj = "hajj"
    remote = "remote"
    permission = "permission"
    maternity_permission = "maternity_permission"
    early_leave = "early_leave"
    advance = "advance"
    mission = "mission"
    forgot_punch = "forgot_punch"
    overtime = "overtime"


class RequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class WorkflowStage(str, enum.Enum):
    manager = "manager"
    hr = "hr"
    ceo = "ceo"
    completed = "completed"


class StepAction(str, enum.Enum):
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    override_approved = "override_approved"


class PunchKind(str, enum.Enum):
    check_in = "in"
    check_out = "out"
    both = "both"


class LeaveField(str, enum.Enum):
    entitlement = "entitlement"
    used = "used"
    adjustment = "adjustment"
    year_end = "year_end"
    carry = "carry"


class PayrollStatus(str, enum.Enum):
    draft = "draft"
    approved = "approved"


class SettlementItemKind(str, enum.Enum):
    addition = "addition"
    deduction = "deduction"


class DocumentType(str, enum.Enum):
    iqama = "iqama"
    passport = "passport"
    insurance = "insurance"
    contract = "contract"
    graduation_certificate = "graduation_certificate"
    experience_certificate = "experience_certificate"
    gosi_certificate = "gosi_certificate"
    cv = "cv"
    national_address = "national_address"
    photo = "photo"
    letter = "letter"
    other = "other"


class TemplateType(str, enum.Enum):
    commencement = "commencement"
    custody = "custody"
    probation_extension = "probation_extension"
    probation_end = "probation_end"
    clearance = "clearance"
    experience_certificate = "experience_certificate"
    probation_evaluation = "probation_evaluation"


class TemplateStatus(str, enum.Enum):
    sent = "sent"
    acknowledged = "acknowledged"
    rejected = "rejected"


class ExclusionReason(str, enum.Enum):
    never_joined = "never_joined"
    engagement_ended = "engagement_ended"
    other = "other"


# --------------------------------------------------------------------------- reference data


class Workplace(IdMixin, TimestampMixin, Base):
    __tablename__ = "workplaces"
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name_ar: Mapped[str] = mapped_column(String(120))
    name_en: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")


class Department(IdMixin, TimestampMixin, Base):
    __tablename__ = "departments"
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name_ar: Mapped[str] = mapped_column(String(120))
    name_en: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")


class Nationality(IdMixin, TimestampMixin, Base):
    __tablename__ = "nationalities"
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name_ar: Mapped[str] = mapped_column(String(120))
    name_en: Mapped[str] = mapped_column(String(120))
    is_saudi: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class CompanySettings(IdMixin, TimestampMixin, Base):
    """Single row."""

    __tablename__ = "company_settings"
    company_name_ar: Mapped[str] = mapped_column(String(200))
    company_name_en: Mapped[str] = mapped_column(String(200))
    labour_law_country: Mapped[str] = mapped_column(String(2), default="SA", server_default="SA")


class AttendanceSettings(IdMixin, TimestampMixin, Base):
    """Single row."""

    __tablename__ = "attendance_settings"
    work_start: Mapped[time] = mapped_column(Time)
    tolerance_minutes: Mapped[int] = mapped_column(Integer)
    flexible_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    shift_hours: Mapped[Decimal] = mapped_column(Numeric(4, 2))
    window_start: Mapped[time] = mapped_column(Time)
    window_end: Mapped[time] = mapped_column(Time)
    remote_days_per_year: Mapped[int] = mapped_column(Integer)


class GosiRule(IdMixin, TimestampMixin, Base):
    """Effective-dated GOSI rates. The rule in force for a month is the latest effective_from <= month."""

    __tablename__ = "gosi_rules"
    __table_args__ = (UniqueConstraint("effective_from", "system", name="uq_gosi_rules_effective_system"),)
    effective_from: Mapped[date] = mapped_column(Date)
    system: Mapped[GosiSystem] = mapped_column(pg_enum(GosiSystem, "gosi_system"))
    employee_rate: Mapped[Decimal] = mapped_column(RATE)
    employer_rate: Mapped[Decimal] = mapped_column(RATE)
    employee_rate_senior: Mapped[Decimal] = mapped_column(RATE)
    employer_rate_senior: Mapped[Decimal] = mapped_column(RATE)
    senior_age: Mapped[int] = mapped_column(Integer, default=55, server_default="55")
    wage_cap: Mapped[Decimal] = mapped_column(MONEY)


class WorkflowRule(IdMixin, TimestampMixin, Base):
    """Which approval stages a request type goes through."""

    __tablename__ = "workflow_rules"
    request_type: Mapped[RequestType] = mapped_column(pg_enum(RequestType, "request_type"), unique=True)
    requires_manager: Mapped[bool] = mapped_column(Boolean)
    requires_hr: Mapped[bool] = mapped_column(Boolean)
    requires_ceo: Mapped[bool] = mapped_column(Boolean)


class Holiday(IdMixin, TimestampMixin, Base):
    __tablename__ = "holidays"
    name_ar: Mapped[str] = mapped_column(String(120))
    name_en: Mapped[str] = mapped_column(String(120))
    start_date: Mapped[date] = mapped_column(Date, index=True)
    days: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")


# --------------------------------------------------------------------------- people


class Employee(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "employees"
    __table_args__ = (
        Index("ix_employees_national_id_expiry", "national_id_expiry"),
        Index("ix_employees_passport_expiry", "passport_expiry"),
        Index("ix_employees_insurance_expiry", "insurance_expiry"),
        Index("ix_employees_contract_end_date", "contract_end_date"),
    )

    # Identity
    emp_no: Mapped[str] = mapped_column(String(20), unique=True)
    name_ar: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str | None] = mapped_column(String(200))
    photo_path: Mapped[str | None] = mapped_column(String(500))
    birth_date: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[Gender | None] = mapped_column(pg_enum(Gender, "gender"))
    religion: Mapped[Religion | None] = mapped_column(pg_enum(Religion, "religion"))
    marital_status: Mapped[MaritalStatus | None] = mapped_column(pg_enum(MaritalStatus, "marital_status"))
    mobile: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(200))
    national_address: Mapped[str | None] = mapped_column(Text)
    nationality_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("nationalities.id"), index=True)

    # Job
    workplace_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("workplaces.id"), index=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"), index=True)
    job_title: Mapped[str | None] = mapped_column(String(200))
    manager_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"), index=True)
    sponsor: Mapped[str | None] = mapped_column(String(200))

    # Classification
    category: Mapped[EmployeeCategory] = mapped_column(
        pg_enum(EmployeeCategory, "employee_category"), default=EmployeeCategory.active, index=True
    )
    wps_type: Mapped[WpsType] = mapped_column(pg_enum(WpsType, "wps_type"), default=WpsType.wps)

    # Bank
    bank_name: Mapped[str | None] = mapped_column(String(120))
    iban: Mapped[str | None] = mapped_column(String(34))

    # Documents
    national_id: Mapped[str | None] = mapped_column(String(20), index=True)
    national_id_expiry: Mapped[date | None] = mapped_column(Date)
    passport_no: Mapped[str | None] = mapped_column(String(30))
    passport_expiry: Mapped[date | None] = mapped_column(Date)
    insurance_company: Mapped[str | None] = mapped_column(String(120))
    insurance_class: Mapped[str | None] = mapped_column(String(30))
    insurance_card_no: Mapped[str | None] = mapped_column(String(60))
    insurance_expiry: Mapped[date | None] = mapped_column(Date)

    # Contract
    contract_nature: Mapped[ContractNature] = mapped_column(
        pg_enum(ContractNature, "contract_nature"), default=ContractNature.indefinite
    )
    contract_duration_months: Mapped[int | None] = mapped_column(Integer)
    join_date: Mapped[date | None] = mapped_column(Date)
    contract_end_date: Mapped[date | None] = mapped_column(Date)
    annual_leave_days: Mapped[int] = mapped_column(Integer, default=21, server_default="21")

    # Pay
    basic_salary: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    housing_allowance: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    transport_allowance: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    project_allowance: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    other_allowances: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    # "إضافي" in the prototype: kept apart from the payroll total (see BUSINESS_RULES open question 4).
    extra_allowance: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    other_deductions: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    currency: Mapped[Currency] = mapped_column(pg_enum(Currency, "currency"), default=Currency.SAR)
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=1, server_default="1")
    gosi_system: Mapped[GosiSystem] = mapped_column(
        pg_enum(GosiSystem, "gosi_system"), default=GosiSystem.non_saudi
    )
    payment_method: Mapped[PaymentMethod] = mapped_column(
        pg_enum(PaymentMethod, "payment_method"), default=PaymentMethod.mudad
    )

    # Flags
    exclude_from_payroll: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    exclude_from_eos: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    # Termination
    termination_date: Mapped[date | None] = mapped_column(Date, index=True)
    termination_article: Mapped[TerminationArticle | None] = mapped_column(
        pg_enum(TerminationArticle, "termination_article")
    )
    termination_reason: Mapped[str | None] = mapped_column(Text)

    notes: Mapped[str | None] = mapped_column(Text)

    nationality: Mapped[Nationality | None] = relationship(lazy="joined")
    workplace: Mapped[Workplace | None] = relationship(lazy="joined")
    department: Mapped[Department | None] = relationship(lazy="joined")
    manager: Mapped["Employee | None"] = relationship(remote_side="Employee.id", lazy="select")

    @property
    def is_terminated(self) -> bool:
        return self.termination_date is not None

    @property
    def is_saudi(self) -> bool:
        return bool(self.nationality and self.nationality.is_saudi)


class User(IdMixin, TimestampMixin, Base):
    """Login account. `id` equals the Supabase auth user id (JWT `sub`)."""

    __tablename__ = "users"
    username: Mapped[str] = mapped_column(String(60), unique=True)
    role: Mapped[Role] = mapped_column(pg_enum(Role, "user_role"), default=Role.employee)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    employee: Mapped[Employee | None] = relationship(lazy="joined")


class Dependent(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "dependents"
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    relation: Mapped[DependentRelation] = mapped_column(pg_enum(DependentRelation, "dependent_relation"))
    name_ar: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str | None] = mapped_column(String(200))
    birth_date: Mapped[date | None] = mapped_column(Date)
    national_id: Mapped[str | None] = mapped_column(String(20))
    national_id_expiry: Mapped[date | None] = mapped_column(Date)
    passport_no: Mapped[str | None] = mapped_column(String(30))
    passport_expiry: Mapped[date | None] = mapped_column(Date)
    insurance_company: Mapped[str | None] = mapped_column(String(120))
    insurance_card_no: Mapped[str | None] = mapped_column(String(60))
    insurance_expiry: Mapped[date | None] = mapped_column(Date)
    mobile: Mapped[str | None] = mapped_column(String(30))


class ExcludedCandidate(IdMixin, TimestampMixin, Base):
    """People who never joined, and consultants whose engagement ended."""

    __tablename__ = "excluded_candidates"
    name: Mapped[str] = mapped_column(String(200))
    nationality_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("nationalities.id"))
    workplace_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("workplaces.id"))
    reason: Mapped[ExclusionReason] = mapped_column(pg_enum(ExclusionReason, "exclusion_reason"))
    notes: Mapped[str | None] = mapped_column(Text)


# --------------------------------------------------------------------------- attendance


class Location(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "locations"
    name: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str | None] = mapped_column(String(200))
    workplace_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("workplaces.id"), index=True)
    type: Mapped[LocationType] = mapped_column(pg_enum(LocationType, "location_type"))
    radius_m: Mapped[int] = mapped_column(Integer, default=200, server_default="200")
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")


class AttendanceRecord(IdMixin, TimestampMixin, Base):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("employee_id", "work_date", name="uq_attendance_employee_date"),)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    work_date: Mapped[date] = mapped_column(Date, index=True)
    time_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    time_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    location_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("locations.id"))
    status: Mapped[AttendanceStatus] = mapped_column(pg_enum(AttendanceStatus, "attendance_status"))
    late_minutes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    early_minutes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    lat_in: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lng_in: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lat_out: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lng_out: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    source: Mapped[AttendanceSource] = mapped_column(pg_enum(AttendanceSource, "attendance_source"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)


# --------------------------------------------------------------------------- documents


class Document(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A file in private Supabase Storage. Only the storage path lives in the database."""

    __tablename__ = "documents"
    employee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"), index=True)
    dependent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("dependents.id"), index=True)
    type: Mapped[DocumentType] = mapped_column(pg_enum(DocumentType, "document_type"))
    title: Mapped[str | None] = mapped_column(String(200))
    storage_path: Mapped[str] = mapped_column(String(500), unique=True)
    file_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


# --------------------------------------------------------------------------- requests & workflow


class Request(IdMixin, TimestampMixin, Base):
    __tablename__ = "requests"
    __table_args__ = (Index("ix_requests_status_stage", "status", "current_stage"),)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    type: Mapped[RequestType] = mapped_column(pg_enum(RequestType, "request_type"), index=True)
    status: Mapped[RequestStatus] = mapped_column(
        pg_enum(RequestStatus, "request_status"), default=RequestStatus.pending
    )
    current_stage: Mapped[WorkflowStage] = mapped_column(pg_enum(WorkflowStage, "workflow_stage"))
    from_date: Mapped[date | None] = mapped_column(Date)
    to_date: Mapped[date | None] = mapped_column(Date)
    days: Mapped[Decimal | None] = mapped_column(DAYS)
    on_date: Mapped[date | None] = mapped_column(Date)
    time_from: Mapped[time | None] = mapped_column(Time)
    time_to: Mapped[time | None] = mapped_column(Time)
    hours: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    amount: Mapped[Decimal | None] = mapped_column(MONEY)
    punch_kind: Mapped[PunchKind | None] = mapped_column(pg_enum(PunchKind, "punch_kind"))
    notes: Mapped[str | None] = mapped_column(Text)
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    attachment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id"))
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RequestStep(IdMixin, TimestampMixin, Base):
    """History of every action on a request."""

    __tablename__ = "request_steps"
    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("requests.id"), index=True)
    stage: Mapped[WorkflowStage] = mapped_column(pg_enum(WorkflowStage, "workflow_stage"))
    action: Mapped[StepAction] = mapped_column(pg_enum(StepAction, "step_action"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(Text)


# --------------------------------------------------------------------------- leave


class LeaveYearLedger(IdMixin, TimestampMixin, Base):
    __tablename__ = "leave_year_ledgers"
    __table_args__ = (UniqueConstraint("employee_id", "year", name="uq_leave_ledger_employee_year"),)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    opening: Mapped[Decimal] = mapped_column(DAYS, default=0, server_default="0")
    entitlement: Mapped[Decimal] = mapped_column(DAYS, default=0, server_default="0")
    used: Mapped[Decimal] = mapped_column(DAYS, default=0, server_default="0")
    adjustment: Mapped[Decimal] = mapped_column(DAYS, default=0, server_default="0")
    closing: Mapped[Decimal] = mapped_column(DAYS, default=0, server_default="0")
    carry: Mapped[Decimal] = mapped_column(DAYS, default=0, server_default="0")
    eos_bank: Mapped[Decimal] = mapped_column(DAYS, default=0, server_default="0")
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")


class LeaveAdjustment(IdMixin, TimestampMixin, Base):
    """HR override of one ledger field for one year, with a reason."""

    __tablename__ = "leave_adjustments"
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    field: Mapped[LeaveField] = mapped_column(pg_enum(LeaveField, "leave_field"))
    value: Mapped[Decimal] = mapped_column(DAYS)
    effective_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


# --------------------------------------------------------------------------- payroll


class PayrollRun(IdMixin, TimestampMixin, Base):
    """A month's payroll. Once approved it is immutable and archived."""

    __tablename__ = "payroll_runs"
    __table_args__ = (UniqueConstraint("year", "month", "workplace_id", name="uq_payroll_run_period"),)
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)
    days_in_month: Mapped[int] = mapped_column(Integer)
    workplace_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("workplaces.id"))
    status: Mapped[PayrollStatus] = mapped_column(
        pg_enum(PayrollStatus, "payroll_status"), default=PayrollStatus.draft
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class PayrollRow(IdMixin, TimestampMixin, Base):
    __tablename__ = "payroll_rows"
    __table_args__ = (UniqueConstraint("run_id", "employee_id", name="uq_payroll_row_run_employee"),)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payroll_runs.id"), index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    basic_salary: Mapped[Decimal] = mapped_column(MONEY)
    housing_allowance: Mapped[Decimal] = mapped_column(MONEY)
    transport_allowance: Mapped[Decimal] = mapped_column(MONEY)
    project_allowance: Mapped[Decimal] = mapped_column(MONEY)
    other_allowances: Mapped[Decimal] = mapped_column(MONEY)
    total_salary: Mapped[Decimal] = mapped_column(MONEY)
    work_days: Mapped[Decimal] = mapped_column(DAYS)
    gosi_days: Mapped[Decimal] = mapped_column(DAYS)
    salary_by_days: Mapped[Decimal] = mapped_column(MONEY)
    overtime: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    leave_compensation: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    extra_allowances: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    total_due: Mapped[Decimal] = mapped_column(MONEY)
    gosi_base: Mapped[Decimal] = mapped_column(MONEY)
    gosi_employee: Mapped[Decimal] = mapped_column(MONEY)
    gosi_employer: Mapped[Decimal] = mapped_column(MONEY)
    loan_deduction: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    other_deductions: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    total_deductions: Mapped[Decimal] = mapped_column(MONEY)
    net: Mapped[Decimal] = mapped_column(MONEY)
    currency: Mapped[Currency] = mapped_column(pg_enum(Currency, "currency"))
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    net_sar: Mapped[Decimal] = mapped_column(MONEY)
    payment_method: Mapped[PaymentMethod] = mapped_column(pg_enum(PaymentMethod, "payment_method"))
    iban: Mapped[str | None] = mapped_column(String(34))
    notes: Mapped[str | None] = mapped_column(Text)


# --------------------------------------------------------------------------- end of service


class Settlement(IdMixin, TimestampMixin, Base):
    __tablename__ = "settlements"
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    end_date: Mapped[date] = mapped_column(Date)
    article: Mapped[TerminationArticle] = mapped_column(pg_enum(TerminationArticle, "termination_article"))
    service_years: Mapped[Decimal] = mapped_column(Numeric(8, 4))
    eos_base: Mapped[Decimal] = mapped_column(MONEY)
    eos_amount: Mapped[Decimal] = mapped_column(MONEY)
    leave_remaining_days: Mapped[Decimal] = mapped_column(DAYS)
    leave_compensation: Mapped[Decimal] = mapped_column(MONEY)
    excess_leave_deduction: Mapped[Decimal] = mapped_column(MONEY)
    final_period_days: Mapped[Decimal] = mapped_column(DAYS)
    final_period_salary: Mapped[Decimal] = mapped_column(MONEY)
    total: Mapped[Decimal] = mapped_column(MONEY)
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class SettlementItem(IdMixin, TimestampMixin, Base):
    __tablename__ = "settlement_items"
    settlement_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("settlements.id"), index=True)
    kind: Mapped[SettlementItemKind] = mapped_column(pg_enum(SettlementItemKind, "settlement_item_kind"))
    label: Mapped[str] = mapped_column(String(200))
    amount: Mapped[Decimal | None] = mapped_column(MONEY)
    days: Mapped[Decimal | None] = mapped_column(DAYS)
    daily_rate: Mapped[Decimal | None] = mapped_column(MONEY)


# --------------------------------------------------------------------------- templates


class TemplateLetter(IdMixin, TimestampMixin, Base):
    __tablename__ = "template_letters"
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    type: Mapped[TemplateType] = mapped_column(pg_enum(TemplateType, "template_type"))
    title: Mapped[str] = mapped_column(String(200))
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id"))
    status: Mapped[TemplateStatus] = mapped_column(
        pg_enum(TemplateStatus, "template_status"), default=TemplateStatus.sent
    )
    sent_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)


# --------------------------------------------------------------------------- audit


class AuditLog(IdMixin, Base):
    __tablename__ = "audit_logs"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(60))
    entity: Mapped[str] = mapped_column(String(60), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), index=True)
    # Free-form context (changed field names, filters). Never contains secrets or raw PII values.
    details: Mapped[dict | None] = mapped_column(JSON)
    ip: Mapped[str | None] = mapped_column(String(64))
    request_id: Mapped[str | None] = mapped_column(String(64))
