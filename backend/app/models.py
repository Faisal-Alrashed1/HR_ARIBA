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
    CheckConstraint,
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
    # Leave days above the 10-day carry from before the system (legacy leaveEosExcess); added to the EOS leave bank.
    leave_eos_excess: Mapped[Decimal] = mapped_column(DAYS, default=0, server_default="0")

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
    """Login account (username = employee number). The password lives in `credentials`."""

    __tablename__ = "users"
    username: Mapped[str] = mapped_column(String(60), unique=True)
    role: Mapped[Role] = mapped_column(pg_enum(Role, "user_role"), default=Role.employee)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    employee: Mapped[Employee | None] = relationship(lazy="joined")


class Credential(TimestampMixin, Base):
    """Argon2id password hash for a user. `token_version` is bumped on every password change,
    which invalidates all previously issued session tokens."""

    __tablename__ = "credentials"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


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
    # Several sessions a day are allowed (legacy V117 groups them: first check-in, last check-out).
    __table_args__ = (Index("ix_attendance_employee_date", "employee_id", "work_date"),)
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
    """An uploaded file on disk (STORAGE_DIR). Only the storage path lives in the database."""

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
    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), index=True)
    stage: Mapped[WorkflowStage] = mapped_column(pg_enum(WorkflowStage, "workflow_stage"))
    action: Mapped[StepAction] = mapped_column(pg_enum(StepAction, "step_action"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(Text)


# --------------------------------------------------------------------------- leave


class LeaveYearOverride(IdMixin, TimestampMixin, Base):
    """HR's figures for one employee and year (legacy e.leaveYearOverrides[year], saved by the year-by-year editor).

    Any column left NULL is computed by the leave engine (app/services/leave.py)."""

    __tablename__ = "leave_year_overrides"
    __table_args__ = (UniqueConstraint("employee_id", "year", name="uq_leave_override_employee_year"),)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    carry: Mapped[Decimal | None] = mapped_column(DAYS)
    entitlement: Mapped[Decimal | None] = mapped_column(DAYS)
    used: Mapped[Decimal | None] = mapped_column(DAYS)
    adjustment: Mapped[Decimal | None] = mapped_column(DAYS)
    year_end: Mapped[Decimal | None] = mapped_column(DAYS)
    carry_next: Mapped[Decimal | None] = mapped_column(DAYS)
    current_balance: Mapped[Decimal | None] = mapped_column(DAYS)
    eos: Mapped[Decimal | None] = mapped_column(DAYS)
    # Imported usage for the year (legacy leaveUsed<year> / leaveHistoryByYear) and the date it was taken at.
    used_history: Mapped[Decimal | None] = mapped_column(DAYS)
    as_of: Mapped[date | None] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(Text)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class LeaveAdjustment(IdMixin, TimestampMixin, Base):
    """Leave balance history (legacy leave_balance_adjustments): a +/- delta, or a `replace_year` snapshot."""

    __tablename__ = "leave_adjustments"
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    entry_date: Mapped[date] = mapped_column(Date)
    action: Mapped[str] = mapped_column(String(20), default="delta", server_default="delta")
    delta: Mapped[Decimal | None] = mapped_column(DAYS)
    snapshot: Mapped[dict | None] = mapped_column(JSON)
    note: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


# --------------------------------------------------------------------------- payroll


class PayrollRun(IdMixin, TimestampMixin, Base):
    """A month's payroll (legacy hr7_pay_YYYY_MM). Once approved it is frozen."""

    __tablename__ = "payroll_runs"
    __table_args__ = (
        UniqueConstraint("year", "month", name="uq_payroll_run_period"),
        CheckConstraint("status IN ('draft', 'approved')", name="ck_payroll_run_status"),
    )
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10), default="draft", server_default="draft")
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class PayrollRow(IdMixin, TimestampMixin, Base):
    """One payroll line. `data` is the full Excel-column row exactly as the payroll screen computed it
    (frontend/hr-web/src/lib/calc/payx.ts); the main totals are copied to columns for reports and payslips.
    `employee_id` is NULL only for a manual row added with «إضافة صف»."""

    __tablename__ = "payroll_rows"
    __table_args__ = (Index("ix_payroll_rows_run_position", "run_id", "position"),)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payroll_runs.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"), index=True)
    emp_no: Mapped[str | None] = mapped_column(String(40))
    name_ar: Mapped[str | None] = mapped_column(String(200))
    total_due: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    total_deductions: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    gosi_employee: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    gosi_employer: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    net: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    net_sar: Mapped[Decimal] = mapped_column(MONEY, default=0, server_default="0")
    data: Mapped[dict] = mapped_column(JSON)


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


class Sheet(IdMixin, TimestampMixin, Base):
    """A saved working sheet keyed like the V114 HTML's storage (e.g. `pay_2026_09` = September payroll rows).

    `data` holds the rows exactly as the screen edits them; `approved` freezes the sheet (payroll approval)."""

    __tablename__ = "sheets"
    key: Mapped[str] = mapped_column(String(80), unique=True)
    data: Mapped[dict | list | None] = mapped_column(JSON)
    approved: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class SentLetter(IdMixin, TimestampMixin, Base):
    """A form/letter HR sends to an employee to approve or object (legacy V71/V114 ariba_hr_send_template).

    `type` keeps the legacy keys: onboarding, custody, extension, termination, clearance, experience, evaluation,
    contract_end, salary_cert. `html` is the printed document (Arabic, optionally followed by <!--ARIBA_EN--> + English)."""

    __tablename__ = "sent_letters"
    __table_args__ = (
        CheckConstraint(
            "type IN ('onboarding', 'custody', 'extension', 'termination', 'clearance', 'experience', "
            "'evaluation', 'contract_end', 'salary_cert')",
            name="ck_sent_letters_type",
        ),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_sent_letters_status"),
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), index=True)
    type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    html: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
